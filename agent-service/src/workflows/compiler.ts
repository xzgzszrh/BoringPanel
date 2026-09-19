import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

import { createScryAgent } from '../agent.js';
import { updateWorkflowRunRecord, upsertUIMessage } from '../db.js';
import { executeScryReadOperation, type ScryReadOperation } from '../tools/scry.js';
import { createScryMCPToolset } from '../mcp/client.js';
import { evaluateInputSecurity } from '../security/policy-engine.js';
import { addSecurityAuditEvent } from '../security/audit.js';
import { securityInputHash } from '../security/policy-engine.js';
import { listEvidence } from '../evidence.js';
import { learnMemoryFromWorkflowOutcome } from '../memory/index.js';
import type {
  AuthenticatedUser,
  ModelSettings,
  WorkflowConditionRule,
  WorkflowRecord,
  WorkflowStepDefinition,
} from '../types.js';

const contextSchema = z.object({
  message: z.string(),
  results: z.record(z.string(), z.unknown()),
  text: z.string(),
});
const branchOutputSchema = z.record(z.string(), z.unknown());

type WorkflowContext = z.infer<typeof contextSchema>;
type WorkflowWriter = { custom: (data: { type: `data-${string}`; data: unknown }) => Promise<void> };

function containsStepType(steps: WorkflowStepDefinition[], type: WorkflowStepDefinition['type']): boolean {
  return steps.some((step) => step.type === type
    || Boolean(step.condition && containsStepType([...step.condition.whenTrue, ...step.condition.whenFalse], type))
    || Boolean(step.parallel && containsStepType(step.parallel.branches.flatMap((branch) => branch.steps), type))
    || Boolean(step.loop && containsStepType(step.loop.steps, type)));
}

async function publishStep(
  writer: WorkflowWriter,
  runId: string,
  step: WorkflowStepDefinition,
  status: 'running' | 'completed' | 'suspended' | 'failed',
  detail?: unknown,
): Promise<void> {
  await writer.custom({
    type: 'data-scry-workflow-step',
    data: { runId, stepId: step.id, title: step.name, stepType: step.type, status, detail },
  });
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').filter(Boolean).reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function compareRule(context: WorkflowContext, rule: WorkflowConditionRule): boolean {
  const actual = readPath(context, rule.path);
  if (rule.operator === 'exists') return actual !== undefined && actual !== null;
  if (rule.operator === 'equals') return String(actual ?? '') === String(rule.value ?? '');
  if (rule.operator === 'not_equals') return String(actual ?? '') !== String(rule.value ?? '');
  const left = Number(actual);
  const right = Number(rule.value);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (rule.operator === 'gt') return left > right;
  if (rule.operator === 'gte') return left >= right;
  if (rule.operator === 'lt') return left < right;
  return left <= right;
}

function asContext(value: unknown): WorkflowContext | null {
  const parsed = contextSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (!value || typeof value !== 'object') return null;
  for (const child of Object.values(value as Record<string, unknown>)) {
    const nested = asContext(child);
    if (nested) return nested;
  }
  return null;
}

function mergeContexts(value: unknown): WorkflowContext {
  const contexts: WorkflowContext[] = [];
  const collect = (candidate: unknown): void => {
    const parsed = contextSchema.safeParse(candidate);
    if (parsed.success) {
      contexts.push(parsed.data);
      return;
    }
    if (candidate && typeof candidate === 'object') Object.values(candidate as Record<string, unknown>).forEach(collect);
  };
  collect(value);
  const base = contexts[0] || { message: '', results: {}, text: '' };
  return {
    message: base.message,
    text: contexts.map((context) => context.text).filter(Boolean).join('\n\n'),
    results: Object.assign({}, ...contexts.map((context) => context.results)),
  };
}

function controlMarker(step: WorkflowStepDefinition, suffix: string) {
  return createStep({
    id: `__scry_${step.id}_${suffix}`,
    inputSchema: contextSchema,
    outputSchema: contextSchema,
    execute: async ({ inputData, runId, writer }) => {
      await publishStep(writer, runId, step, suffix === 'start' ? 'running' : 'completed');
      await updateWorkflowRunRecord(runId, {
        status: 'running',
        stepId: step.id,
        stepState: { status: suffix === 'start' ? 'running' : 'completed', updatedAt: Date.now() },
      });
      return inputData;
    },
  });
}

function normalizeControlOutput(
  step: WorkflowStepDefinition,
  mode: 'branch' | 'parallel' | 'loop' | 'foreach',
) {
  return createStep({
    id: `__scry_${step.id}_normalize`,
    inputSchema: mode === 'loop'
      ? contextSchema
      : mode === 'foreach'
        ? z.array(contextSchema)
        : branchOutputSchema,
    outputSchema: contextSchema,
    execute: async ({ inputData, runId, writer }) => {
      const context = mode === 'parallel' || mode === 'foreach' ? mergeContexts(inputData) : asContext(inputData);
      if (!context) throw new Error(`控制节点“${step.name}”没有产生有效上下文`);
      await publishStep(writer, runId, step, 'completed', { mode });
      await updateWorkflowRunRecord(runId, {
        status: 'running',
        stepId: step.id,
        stepState: { status: 'completed', completedAt: Date.now(), mode },
      });
      return context;
    },
  });
}

function prepareForeachStep(step: WorkflowStepDefinition) {
  return createStep({
    id: `__scry_${step.id}_items`,
    inputSchema: contextSchema,
    outputSchema: z.array(contextSchema),
    execute: async ({ inputData }) => {
      const items = readPath(inputData, step.loop?.sourcePath || '');
      if (!Array.isArray(items)) throw new Error(`foreach 数据路径“${step.loop?.sourcePath}”不是数组`);
      return items.slice(0, step.loop?.maxIterations || 50).map((item, index) => ({
        ...inputData,
        results: {
          ...inputData.results,
          [`${step.id}.item`]: item,
          [`${step.id}.index`]: index,
        },
      }));
    },
  });
}

function compileLeafStep(
  workflow: WorkflowRecord,
  step: WorkflowStepDefinition,
  user: AuthenticatedUser,
  settings: ModelSettings,
  threadId: string,
) {
  const approval = step.type === 'approval';
  return createStep({
    id: step.id,
    description: step.name,
    inputSchema: contextSchema,
    outputSchema: contextSchema,
    retries: step.retries || 0,
    ...(approval ? {
      resumeSchema: z.object({ approved: z.boolean(), comment: z.string().max(2000).optional() }),
      suspendSchema: z.object({ message: z.string(), stepId: z.string() }),
    } : {}),
    execute: async ({ inputData, runId, writer, resumeData, suspend }) => {
      const evidenceContext = { threadId, traceId: runId, query: inputData.message };
      await publishStep(writer, runId, step, 'running', { retries: step.retries || 0 });
      await updateWorkflowRunRecord(runId, {
        status: 'running',
        stepId: step.id,
        stepState: { status: 'running', startedAt: Date.now(), retries: step.retries || 0 },
      });
      try {
        if (step.type === 'approval') {
          const decision = resumeData as { approved?: boolean; comment?: string } | undefined;
          if (!decision) {
            const message = step.approvalMessage || `Loop“${workflow.name}”需要人工确认后继续。`;
            await addSecurityAuditEvent({
              traceId: runId, orgId: user.orgId, userId: user.id, eventType: 'approval.requested',
              source: 'workflow', target: step.id, decision: 'require-approval', riskScore: 70,
              inputHash: securityInputHash({ workflowId: workflow.id, stepId: step.id, input: inputData }),
              details: { workflowId: workflow.id, stepName: step.name },
            });
            await publishStep(writer, runId, step, 'suspended', { message });
            await updateWorkflowRunRecord(runId, {
              status: 'suspended',
              stepId: step.id,
              stepState: { status: 'suspended', message, suspendedAt: Date.now() },
              suspendedStep: step.id,
            });
            return suspend({ message, stepId: step.id }, { resumeLabel: step.id });
          }
          await addSecurityAuditEvent({
            traceId: runId, orgId: user.orgId, userId: user.id,
            eventType: decision.approved ? 'approval.approved' : 'approval.denied', source: 'workflow', target: step.id,
            decision: decision.approved ? 'allow' : 'deny', riskScore: 70,
            inputHash: securityInputHash({ workflowId: workflow.id, stepId: step.id, input: inputData }),
            details: { workflowId: workflow.id, stepName: step.name, hasComment: Boolean(decision.comment) },
          });
          if (!decision.approved) throw new Error(decision.comment || '用户拒绝了 Loop 审批');
          const output = {
            ...inputData,
            results: { ...inputData.results, [step.id]: { approved: true, comment: decision.comment || '' } },
          };
          await publishStep(writer, runId, step, 'completed', { approved: true });
          await updateWorkflowRunRecord(runId, {
            status: 'running',
            stepId: step.id,
            stepState: { status: 'completed', completedAt: Date.now(), approved: true },
            suspendedStep: '',
          });
          return output;
        }

        if (step.type === 'agent') {
          const { agent, disconnect } = await createScryAgent(user, settings, 'diagnose', evidenceContext);
          const evidence = JSON.stringify(inputData.results).slice(0, 50000);
          const prompt = `${step.prompt || '根据已有信息给出结论。'}\n\n用户问题：${inputData.message}\n\n本轮 Loop 前序结果：${evidence}`;
          let response;
          try {
            response = await agent.generate(prompt, { maxSteps: settings.maxSteps });
          } finally {
            await disconnect();
          }
          const output = {
            ...inputData,
            text: response.text,
            results: { ...inputData.results, [step.id]: { text: response.text } },
          };
          await publishStep(writer, runId, step, 'completed', { text: response.text });
          await updateWorkflowRunRecord(runId, {
            status: 'running', stepId: step.id, stepState: { status: 'completed', completedAt: Date.now() },
          });
          return output;
        }

        if (step.type === 'security-check') {
          const result = await evaluateInputSecurity({
            user,
            text: inputData.message,
            mode: 'operate',
            source: 'workflow',
          });
          if (result.decision === 'deny') throw new Error(`安全决策拒绝执行：${result.reasons.join('；')}`);
          const output = { ...inputData, results: { ...inputData.results, [step.id]: result } };
          await publishStep(writer, runId, step, 'completed', result);
          await updateWorkflowRunRecord(runId, {
            status: 'running', stepId: step.id, stepState: { status: 'completed', completedAt: Date.now(), ...result },
          });
          return output;
        }

        if (step.type === 'mcp-tool') {
          const mcp = await createScryMCPToolset(user, evidenceContext);
          try {
            const tool = mcp.tools[step.toolId || ''];
            if (!tool?.execute) throw new Error(`MCP 工具不存在或不可执行：${step.toolId || '未配置'}`);
            const data = await tool.execute(step.toolInput || {}, { toolCallId: `${runId}:${step.id}`, messages: [] });
            const output = { ...inputData, results: { ...inputData.results, [step.id]: data } };
            await publishStep(writer, runId, step, 'completed', data);
            await updateWorkflowRunRecord(runId, {
              status: 'running', stepId: step.id, stepState: { status: 'completed', completedAt: Date.now(), toolId: step.toolId },
            });
            return output;
          } finally {
            await mcp.disconnect();
          }
        }

        if (step.type === 'operation' || step.type === 'verify') {
          const mode = step.type === 'operation' ? 'operate' : 'diagnose';
          const { agent, disconnect } = await createScryAgent(user, settings, mode, evidenceContext);
          const evidence = JSON.stringify(inputData.results).slice(0, 50_000);
          const prompt = `${step.prompt || (step.type === 'operation' ? '按已审批计划执行操作并返回结果。' : '验证操作结果并判断目标是否达成。')}\n\n用户问题：${inputData.message}\n\n前序结果：${evidence}`;
          try {
            const response = await agent.generate(prompt, { maxSteps: settings.maxSteps });
            const output = { ...inputData, text: response.text, results: { ...inputData.results, [step.id]: { text: response.text } } };
            await publishStep(writer, runId, step, 'completed', { text: response.text });
            await updateWorkflowRunRecord(runId, {
              status: 'running', stepId: step.id, stepState: { status: 'completed', completedAt: Date.now(), mode },
            });
            return output;
          } finally {
            await disconnect();
          }
        }

        const operation = step.type as ScryReadOperation;
        const data = await executeScryReadOperation(user, operation, evidenceContext);
        const output = { ...inputData, results: { ...inputData.results, [step.id]: data } };
        await publishStep(writer, runId, step, 'completed', data);
        await updateWorkflowRunRecord(runId, {
          status: 'running', stepId: step.id, stepState: { status: 'completed', completedAt: Date.now() },
        });
        return output;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Loop 节点执行失败';
        await publishStep(writer, runId, step, 'failed', { message });
        await updateWorkflowRunRecord(runId, {
          status: 'failed', stepId: step.id, stepState: { status: 'failed', failedAt: Date.now(), message },
        });
        throw error;
      }
    },
  });
}

function compileSequence(
  record: WorkflowRecord,
  definitions: WorkflowStepDefinition[],
  user: AuthenticatedUser,
  settings: ModelSettings,
  id: string,
  threadId: string,
) {
  let workflow: any = createWorkflow({ id, inputSchema: contextSchema, outputSchema: contextSchema });

  for (const step of definitions) {
    if (step.type === 'condition' && step.condition) {
      const whenTrue = compileSequence(record, step.condition.whenTrue, user, settings, `${id}_${step.id}_true`, threadId);
      const whenFalse = compileSequence(record, step.condition.whenFalse, user, settings, `${id}_${step.id}_false`, threadId);
      workflow = workflow
        .then(controlMarker(step, 'start'))
        .branch([
          [async ({ inputData }: { inputData: WorkflowContext }) => compareRule(inputData, step.condition!.rule), whenTrue],
          [async ({ inputData }: { inputData: WorkflowContext }) => !compareRule(inputData, step.condition!.rule), whenFalse],
        ])
        .then(normalizeControlOutput(step, 'branch'));
      continue;
    }

    if (step.type === 'parallel' && step.parallel) {
      const branches = step.parallel.branches.map((branch) =>
        compileSequence(record, branch.steps, user, settings, `${id}_${step.id}_${branch.id}`, threadId));
      workflow = workflow
        .then(controlMarker(step, 'start'))
        .parallel(branches)
        .then(normalizeControlOutput(step, 'parallel'));
      continue;
    }

    if (step.type === 'loop' && step.loop) {
      const body = compileSequence(record, step.loop.steps, user, settings, `${id}_${step.id}_body`, threadId);
      workflow = workflow.then(controlMarker(step, 'start'));
      if (step.loop.mode === 'foreach') {
        workflow = workflow
          .then(prepareForeachStep(step))
          .foreach(body, { concurrency: step.loop.concurrency || 1 })
          .then(normalizeControlOutput(step, 'foreach'));
        continue;
      }
      if (step.loop.mode === 'while') {
        workflow = workflow.dowhile(body, async ({ inputData, iterationCount }: { inputData: WorkflowContext; iterationCount: number }) =>
          iterationCount < step.loop!.maxIterations && compareRule(inputData, step.loop!.rule));
      } else {
        workflow = workflow.dountil(body, async ({ inputData, iterationCount }: { inputData: WorkflowContext; iterationCount: number }) =>
          iterationCount >= step.loop!.maxIterations || compareRule(inputData, step.loop!.rule));
      }
      workflow = workflow.then(normalizeControlOutput(step, 'loop'));
      continue;
    }

    workflow = workflow.then(compileLeafStep(record, step, user, settings, threadId));
  }
  return workflow.commit();
}

export function compileWorkflow(
  record: WorkflowRecord,
  user: AuthenticatedUser,
  settings: ModelSettings,
  threadId = '',
) {
  let workflow: any = compileSequence(record, record.definition.steps, user, settings, `${record.id}_loop`, threadId);
  const finalize = createStep({
    id: '__scry_finalize',
    inputSchema: contextSchema,
    outputSchema: contextSchema,
    execute: async ({ inputData, runId, writer }) => {
      const text = inputData.text || '本轮 Loop 已执行完成。';
      await writer.custom({ type: 'data-scry-workflow-result', data: { runId, status: 'completed', text } });
      await updateWorkflowRunRecord(runId, { status: 'completed', output: inputData, suspendedStep: '' });
      if (threadId) {
        await upsertUIMessage(threadId, {
          id: `${runId}-result`, role: 'assistant', parts: [{ type: 'text', text }],
          metadata: { createdAt: Date.now(), workflowId: record.id, runId },
        });
        if (containsStepType(record.definition.steps, 'verify')) {
          const evidence = (await listEvidence(threadId, user.orgId)).filter((item) => item.traceId === runId);
          await learnMemoryFromWorkflowOutcome({
            user, workflowId: record.id, workflowName: record.name, runId, threadId, text, evidence,
          }).catch((error) => console.error('Failed to learn memory from verified Loop:', error));
        }
      }
      return { ...inputData, text } satisfies WorkflowContext;
    },
  });
  workflow = workflow.then(finalize);
  return workflow.commit();
}
