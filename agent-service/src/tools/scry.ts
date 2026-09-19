import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { config } from "../config.js";
import type { AuthenticatedUser } from "../types.js";
import { a2ui } from "./a2ui.js";
import { createSSHTools } from "./ssh-tools.js";
import { evaluateInputSecurity } from "../security/policy-engine.js";
import { addSecurityAuditEvent } from "../security/audit.js";
import { securityInputHash } from "../security/policy-engine.js";
import { getEvidenceByIds, listEvidence, recordEvidence } from "../evidence.js";
import {
  createMemory,
  forgetMemory,
  getMemory,
  maintainMemories,
  retrieveMemories,
} from "../memory/index.js";
import { extractServiceNames } from "../memory/index.js";
import type { EvidenceCaptureContext, EvidenceSourceType } from "../types.js";
import {
  buildSignalQueryPayload,
  signalQueryInputSchema,
} from "./signal-query.js";

export async function callScry(
  user: AuthenticatedUser,
  path: string,
  init?: RequestInit,
  evidenceContext?: EvidenceCaptureContext,
  evidence?: {
    sourceType: EvidenceSourceType;
    sourceName: string;
    title: string;
  },
): Promise<unknown> {
  const traceId = evidenceContext?.traceId || crypto.randomUUID();
  const inputHash = securityInputHash({
    path,
    method: init?.method || "GET",
    body: init?.body || "",
  });
  const startedAt = Date.now();
  await addSecurityAuditEvent({
    traceId,
    orgId: user.orgId,
    userId: user.id,
    eventType: "tool.execution.started",
    source: "mcp",
    target: path,
    decision: "allow",
    riskScore: 10,
    inputHash,
    details: { method: init?.method || "GET" },
  });
  try {
    const response = await fetch(`${config.queryServiceUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
        ...(init?.headers || {}),
      },
    });
    const text = await response.text();
    if (!response.ok)
      throw new Error(`Scry API ${response.status}: ${text.slice(0, 500)}`);
    if (text.length > config.maxToolResultBytes)
      throw new Error("工具结果过大，请缩小查询范围");
    const data = text ? JSON.parse(text) : null;
    await addSecurityAuditEvent({
      traceId,
      orgId: user.orgId,
      userId: user.id,
      eventType: "tool.execution.completed",
      source: "mcp",
      target: path,
      decision: "allow",
      riskScore: 10,
      inputHash,
      details: {
        durationMs: Date.now() - startedAt,
        responseBytes: Buffer.byteLength(text),
      },
    });
    if (evidenceContext && evidence) {
      await recordEvidence({
        user,
        context: evidenceContext,
        ...evidence,
        content: data,
      }).catch((error) =>
        console.error(`Failed to record evidence for ${path}:`, error),
      );
    }
    return data;
  } catch (error) {
    await addSecurityAuditEvent({
      traceId,
      orgId: user.orgId,
      userId: user.id,
      eventType: "tool.execution.failed",
      source: "mcp",
      target: path,
      decision: "deny",
      riskScore: 30,
      inputHash,
      details: {
        durationMs: Date.now() - startedAt,
        error:
          error instanceof Error ? error.message.slice(0, 300) : "调用失败",
      },
    });
    throw error;
  }
}

export type ScryReadOperation = "services" | "alerts" | "dashboards";

export async function executeScryReadOperation(
  user: AuthenticatedUser,
  operation: ScryReadOperation,
  evidenceContext?: EvidenceCaptureContext,
): Promise<unknown> {
  const paths: Record<ScryReadOperation, string> = {
    services: "/api/v1/services/list",
    alerts: "/api/v1/alerts",
    dashboards: "/api/v1/dashboards",
  };
  const evidence: Record<
    ScryReadOperation,
    { sourceType: EvidenceSourceType; sourceName: string; title: string }
  > = {
    services: {
      sourceType: "service",
      sourceName: "list-services",
      title: "服务状态证据",
    },
    alerts: {
      sourceType: "alert",
      sourceName: "list-alerts",
      title: "告警证据",
    },
    dashboards: {
      sourceType: "dashboard",
      sourceName: "list-dashboards",
      title: "仪表盘证据",
    },
  };
  return callScry(
    user,
    paths[operation],
    undefined,
    evidenceContext,
    evidence[operation],
  );
}

export function createScryTools(
  user: AuthenticatedUser,
  evidenceContext?: EvidenceCaptureContext,
) {
  const publishPlan = createTool({
    id: "publish-plan",
    description: `在执行多步骤诊断前发布一份简短、可追踪的计划。复杂诊断应先调用本工具，再按步骤取证。
示例：{"title":"定位订单服务错误率升高","steps":[{"id":"step-1","title":"确认受影响服务","description":"读取服务与当前告警"},{"id":"step-2","title":"检索异常信号","description":"查询错误日志和失败链路"}]}`,
    inputSchema: z
      .object({
        title: z
          .string()
          .min(1)
          .max(240)
          .describe("计划标题，概括本次诊断目标，不写最终结论。"),
        steps: z
          .array(
            z
              .object({
                id: z
                  .string()
                  .min(1)
                  .max(40)
                  .describe("当前计划内唯一且稳定的步骤 ID，例如 step-1。"),
                title: z
                  .string()
                  .min(1)
                  .max(160)
                  .describe("简短的动作型步骤标题，例如“检索异常日志”。"),
                description: z
                  .string()
                  .max(500)
                  .optional()
                  .describe("该步骤准备调用的工具、目标信号或预期获得的证据。"),
              })
              .describe("单个诊断步骤对象。"),
          )
          .min(1)
          .max(8)
          .describe("按执行顺序排列的 1 到 8 个步骤；通常使用 2 到 6 个。"),
      })
      .describe("直接传 title 和 steps，不要添加 plan、input 或 args 包装层。"),
    outputSchema: z.object({ a2ui: z.any() }),
    execute: async ({ title, steps }) => ({
      a2ui: a2ui("diagnostic-plan", "plan", title, { steps }),
    }),
  });

  const listServices = createTool({
    id: "list-services",
    description: "读取 Scry 当前发现的服务列表，用于确定服务名称和观测范围。",
    inputSchema: z.object({}).describe("无参数；调用时传空对象 {}。"),
    outputSchema: z.object({ data: z.any(), a2ui: z.any() }),
    execute: async () => {
      const data = await executeScryReadOperation(
        user,
        "services",
        evidenceContext,
      );
      return { data, a2ui: a2ui("services", "table", "服务列表", data) };
    },
  });

  const listAlerts = createTool({
    id: "list-alerts",
    description: "读取当前告警实例，用于检查正在触发或等待处理的告警。",
    inputSchema: z.object({}).describe("无参数；调用时传空对象 {}。"),
    outputSchema: z.object({ data: z.any(), a2ui: z.any() }),
    execute: async () => {
      const data = await executeScryReadOperation(
        user,
        "alerts",
        evidenceContext,
      );
      return { data, a2ui: a2ui("alerts", "table", "当前告警", data) };
    },
  });

  const listDashboards = createTool({
    id: "list-dashboards",
    description: "读取仪表盘列表，用于定位已有监控视图。",
    inputSchema: z.object({}).describe("无参数；调用时传空对象 {}。"),
    outputSchema: z.object({ data: z.any(), a2ui: z.any() }),
    execute: async () => {
      const data = await executeScryReadOperation(
        user,
        "dashboards",
        evidenceContext,
      );
      return { data, a2ui: a2ui("dashboards", "table", "仪表盘", data) };
    },
  });

  const querySignals = createTool({
    id: "query-signals",
    description: `查询 Scry 日志、链路或指标。直接传 signal 和高层参数，工具会自动生成 Query Range V3 请求。
不要传 query 包装层，不要传 compositeQuery、logQueries 或 builderQueries。
日志：{"signal":"logs","lookbackMinutes":15,"caseId":"case-013","searchText":"ENOSPC","limit":100}
链路：{"signal":"traces","lookbackMinutes":15,"caseId":"case-013","errorOnly":true,"limit":100}
指标：{"signal":"metrics","lookbackMinutes":15,"caseId":"case-013","metricName":"system.filesystem.utilization","aggregation":"max"}`,
    inputSchema: signalQueryInputSchema,
    outputSchema: z.object({ data: z.any(), a2ui: z.any() }),
    execute: async (input) => {
      const query = buildSignalQueryPayload(input);
      const data = await callScry(
        user,
        "/api/v3/query_range",
        { method: "POST", body: JSON.stringify(query) },
        evidenceContext,
        {
          sourceType: "telemetry",
          sourceName: "query-signals",
          title: "可观测信号证据",
        },
      );
      return {
        data,
        a2ui: a2ui("query-result", "key_value", "查询结果", data),
      };
    },
  });

  const evaluateSecurityIntent = createTool({
    id: "evaluate-security-intent",
    description:
      "执行 Scry 系统安全决策 Loop 的输入检查，返回意图、风险和 allow/require-approval/deny 裁决。",
    inputSchema: z.object({
      text: z
        .string()
        .min(1)
        .max(50_000)
        .describe(
          "需要裁决的原始用户意图或拟执行动作，保留目标、对象和动作，不要只传关键词。",
        ),
      mode: z
        .enum(["diagnose", "plan", "operate"])
        .optional()
        .default("diagnose")
        .describe(
          "当前阶段：diagnose=只读诊断，plan=仅规划，operate=准备执行受控动作。",
        ),
    }).describe(`直接传 text 和 mode。
示例：{"text":"检查订单服务最近 30 分钟的错误日志","mode":"diagnose"}`),
    outputSchema: z.object({
      traceId: z.string(),
      decision: z.enum(["allow", "require-approval", "deny"]),
      riskScore: z.number(),
      intent: z.enum([
        "observe",
        "diagnose",
        "change",
        "privilege-escalation",
        "secret-access",
        "unknown",
      ]),
      reasons: z.array(z.string()),
      inputHash: z.string(),
      a2ui: z.any(),
    }),
    execute: async ({ text, mode }) => {
      const result = await evaluateInputSecurity({
        user,
        text,
        mode,
        source: "mcp",
      });
      return {
        ...result,
        a2ui: a2ui(`security-${result.traceId}`, "status", "安全决策", result),
      };
    },
  });

  const listEvidenceTool = createTool({
    id: "list-evidence",
    description:
      "读取当前对话中有效、已接受或被用户处置的证据及其置信度和关联度。不得使用已驳回或挂起的证据形成结论。",
    inputSchema: z
      .object({
        includeInactive: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "为 false 时排除 rejected 和 suspended；只有审查用户处置历史时才设为 true。",
          ),
      })
      .describe(
        `读取当前对话证据。通常传 {}；审查全部状态时传 {"includeInactive":true}。`,
      ),
    outputSchema: z.object({ evidence: z.array(z.any()), a2ui: z.any() }),
    execute: async ({ includeInactive }) => {
      if (!evidenceContext?.threadId)
        throw new Error("当前工具调用没有对话证据上下文");
      const evidence = (
        await listEvidence(evidenceContext.threadId, user.orgId)
      )
        .filter(
          (item) =>
            includeInactive ||
            (item.status !== "rejected" && item.status !== "suspended"),
        )
        .map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          sourceType: item.sourceType,
          sourceName: item.sourceName,
          confidence: item.confidence,
          relevance: item.relevance,
          status: item.status,
          selected: item.selected,
          note: item.note,
        }));
      return {
        evidence,
        a2ui: a2ui("evidence-list", "table", "当前证据", evidence),
      };
    },
  });

  const getEvidenceChain = createTool({
    id: "get-evidence-chain",
    description:
      "读取当前对话的证据关系链，包括同一执行链、交叉印证和派生关系。",
    inputSchema: z.object({}).describe("无参数；调用时传空对象 {}。"),
    outputSchema: z.object({
      evidence: z.array(z.any()),
      relations: z.array(z.any()),
      a2ui: z.any(),
    }),
    execute: async () => {
      if (!evidenceContext?.threadId)
        throw new Error("当前工具调用没有对话证据上下文");
      const evidence = await listEvidence(evidenceContext.threadId, user.orgId);
      const relations = Array.from(
        new Map(
          evidence
            .flatMap((item) => item.relations)
            .map((relation) => [relation.id, relation]),
        ).values(),
      );
      const nodes = evidence.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        confidence: item.confidence,
        relevance: item.relevance,
        sourceType: item.sourceType,
      }));
      return {
        evidence: nodes,
        relations,
        a2ui: a2ui("evidence-chain", "key_value", "证据链", {
          evidence: nodes,
          relations,
        }),
      };
    },
  });

  const searchMemory = createTool({
    id: "search-memory",
    description:
      "使用 TopoMem 检索运行记忆。优先依据当前 Trace 异常路径定位服务，再以错误签名重排；没有可用拓扑时确定性回退。记忆只能用于形成待验证假设。",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(20_000)
        .optional()
        .describe(
          "用于检索历史经验的故障现象、服务名、错误签名或处置目标；省略时使用当前用户问题。",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe("最多返回的记忆数量，范围 1 到 20。"),
    }).describe(`直接传 query 和 limit。
示例：{"query":"订单服务连接池耗尽 HTTP 500","limit":5}`),
    outputSchema: z.object({ packet: z.any(), a2ui: z.any() }),
    execute: async ({ query, limit }) => {
      const evidence = evidenceContext?.threadId
        ? await listEvidence(evidenceContext.threadId, user.orgId)
        : [];
      const packet = await retrieveMemories({
        user,
        query: query?.trim() || evidenceContext?.query || "",
        context: { ...evidenceContext, evidence },
        limit,
      });
      return {
        packet,
        a2ui: a2ui(
          `memory-search-${packet.runId}`,
          "table",
          "TopoMem 检索结果",
          packet.results.map((result) => ({
            id: result.memory.id,
            title: result.memory.title,
            service: result.memory.serviceName,
            type: result.memory.type,
            score: result.score,
            confidence: result.memory.confidence,
            vitality: result.memory.vitality,
            strategy: packet.strategy,
          })),
        ),
      };
    },
  });

  const remember = createTool({
    id: "remember",
    description:
      "将已经由当前证据验证、且对未来事件可复用的经验写入 Scry 记忆。必须引用当前对话证据，禁止写入猜测、密钥或凭证。",
    inputSchema: z.object({
      type: z
        .enum(["working", "episodic", "semantic", "procedural"])
        .describe(
          "记忆类型：working=短期上下文，episodic=一次事件经验，semantic=稳定知识，procedural=可复用处置步骤。",
        ),
      scope: z
        .enum(["user", "thread", "organization"])
        .optional()
        .default("user")
        .describe(
          "可见范围：user=当前用户，thread=当前对话，organization=组织共享且仅管理员可写。",
        ),
      title: z
        .string()
        .min(1)
        .max(240)
        .describe("可检索的短标题，应包含服务或故障机制。"),
      summary: z
        .string()
        .min(1)
        .max(4000)
        .describe("一段自包含摘要，说明现象、已验证根因和适用边界。"),
      content: z
        .string()
        .min(1)
        .max(80_000)
        .describe(
          "记忆正文字符串，按“现象、诊断、处置、验证、限制”组织；不要传任意 JSON 对象。",
        ),
      evidenceIds: z
        .array(
          z.string().uuid().describe("来自 listEvidence 结果的真实证据 UUID。"),
        )
        .min(1)
        .max(50)
        .describe(
          "支撑该记忆的当前对话证据 ID；不得自行编造，也不得引用 rejected 或 suspended 证据。",
        ),
      serviceName: z
        .string()
        .min(1)
        .max(160)
        .optional()
        .describe("关联服务的精确名称；省略时从证据中自动提取。"),
      tags: z
        .array(z.string().min(1).max(80))
        .max(40)
        .optional()
        .default([])
        .describe("用于检索的短标签，例如 connection-pool、http-500。"),
      importance: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .default(70)
        .describe("长期保留重要度，0 到 100；普通已验证经验使用 70。"),
    })
      .describe(`写入前先调用 listEvidence 获取证据 UUID。直接传下列字段，不要添加 memory 或 input 包装层。
示例：{"type":"episodic","scope":"user","title":"订单服务连接池耗尽","summary":"订单服务因数据库连接池耗尽产生 HTTP 500。","content":"现象：HTTP 500 增长。诊断：失败链路显示 pool_exhausted。处置：检查慢查询并调整连接池。验证：错误率与等待队列恢复。","evidenceIds":["00000000-0000-4000-8000-000000000001"],"serviceName":"order-service","tags":["connection-pool","http-500"],"importance":80}`),
    outputSchema: z.object({ memory: z.any(), a2ui: z.any() }),
    execute: async ({
      type,
      scope,
      title,
      summary,
      content,
      evidenceIds,
      serviceName,
      tags,
      importance,
    }) => {
      if (!evidenceContext?.threadId)
        throw new Error("当前工具调用没有对话证据上下文");
      const evidence = await getEvidenceByIds(
        evidenceContext.threadId,
        user.orgId,
        evidenceIds,
      );
      if (evidence.length !== new Set(evidenceIds).size)
        throw new Error("部分来源证据不存在或不属于当前对话");
      const usable = evidence.filter(
        (item) => item.status !== "rejected" && item.status !== "suspended",
      );
      if (usable.length !== evidence.length)
        throw new Error("已驳回或挂起的证据不能用于写入记忆");
      const memory = await createMemory({
        user,
        type,
        scope,
        title,
        summary,
        content,
        threadId: evidenceContext.threadId,
        serviceName:
          serviceName ||
          usable.flatMap((item) => extractServiceNames(item.content))[0] ||
          "",
        tags,
        importance,
        confidence: Math.round(
          usable.reduce((sum, item) => sum + item.confidence, 0) /
            usable.length,
        ),
        status: usable.every((item) => item.status === "accepted")
          ? "verified"
          : "active",
        sources: usable.map((item) => ({
          sourceType: "evidence" as const,
          sourceId: item.id,
          traceId: item.traceId,
          relation: "grounded_in",
          weight: item.confidence,
        })),
      });
      return {
        memory,
        a2ui: a2ui(`memory-${memory.id}`, "status", "记忆已写入", {
          id: memory.id,
          type: memory.type,
          scope: memory.scope,
          status: memory.status,
          vitality: memory.vitality,
        }),
      };
    },
  });

  const inspectMemory = createTool({
    id: "inspect-memory",
    description: "检查一项记忆的正文、状态、活性、来源证据、关系和维护历史。",
    inputSchema: z
      .object({
        memoryId: z
          .string()
          .uuid()
          .describe("来自 searchMemory 结果的 memory.id UUID。"),
      })
      .describe(
        `直接传 memoryId，例如 {"memoryId":"00000000-0000-4000-8000-000000000001"}。`,
      ),
    outputSchema: z.object({ memory: z.any(), a2ui: z.any() }),
    execute: async ({ memoryId }) => {
      const memory = await getMemory(memoryId, user, {
        threadId: evidenceContext?.threadId,
      });
      if (!memory) throw new Error("记忆不存在或当前用户不可见");
      return {
        memory,
        a2ui: a2ui(
          `memory-inspect-${memory.id}`,
          "key_value",
          "记忆详情",
          memory,
        ),
      };
    },
  });

  const maintainMemory = createTool({
    id: "maintain-memory",
    description:
      "执行有界记忆维护：衰减、强化、重复合并、冲突标记、到期处理与低活性归档。不会硬删除记忆。",
    inputSchema: z
      .object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .default(300)
          .describe("本次最多扫描的记忆数量，范围 1 到 500。"),
      })
      .describe(`执行有界维护。通常传 {}；缩小批次时传 {"limit":100}。`),
    outputSchema: z.object({ report: z.any(), a2ui: z.any() }),
    execute: async ({ limit }) => {
      const report = await maintainMemories(user, limit);
      return {
        report,
        a2ui: a2ui(
          `memory-maintenance-${report.completedAt}`,
          "status",
          "记忆维护完成",
          report,
        ),
      };
    },
  });

  const forgetMemoryTool = createTool({
    id: "forget-memory",
    description:
      "按用户明确要求遗忘一项记忆。清除正文、摘要、标签、关键词和服务标识，仅保留不可逆审计骨架。",
    inputSchema: z.object({
      memoryId: z
        .string()
        .uuid()
        .describe("用户明确要求遗忘的 memory.id UUID。"),
      confirmation: z
        .literal("FORGET")
        .describe('固定确认字符串，必须精确传 "FORGET"。'),
    }).describe(`仅在用户明确要求遗忘后调用。
示例：{"memoryId":"00000000-0000-4000-8000-000000000001","confirmation":"FORGET"}`),
    outputSchema: z.object({ memory: z.any(), a2ui: z.any() }),
    execute: async ({ memoryId }) => {
      const memory = await forgetMemory(memoryId, user);
      if (!memory) throw new Error("记忆不存在或当前用户不可见");
      return {
        memory,
        a2ui: a2ui(`memory-forgotten-${memory.id}`, "status", "记忆已遗忘", {
          id: memory.id,
          status: memory.status,
        }),
      };
    },
  });

  return {
    publishPlan,
    listServices,
    listAlerts,
    listDashboards,
    querySignals,
    evaluateSecurityIntent,
    listEvidence: listEvidenceTool,
    getEvidenceChain,
    searchMemory,
    remember,
    inspectMemory,
    maintainMemory,
    forgetMemory: forgetMemoryTool,
    ...createSSHTools(user, evidenceContext),
  };
}
