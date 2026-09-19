import { Mastra } from '@mastra/core/mastra';

import { createScryAgent, storage } from './agent.js';
import { compileWorkflow } from './workflows/compiler.js';
import type { AgentMode, AuthenticatedUser, EvidenceCaptureContext, ModelSettings, WorkflowRecord } from './types.js';

export async function createAgentRuntime(
  user: AuthenticatedUser,
  settings: ModelSettings,
  mode: AgentMode,
  evidenceContext?: EvidenceCaptureContext,
) {
  const { agent, disconnect } = await createScryAgent(user, settings, mode, evidenceContext);
  return {
    agent,
    mastra: new Mastra({ storage, agents: { [agent.id]: agent } }),
    disconnect,
  };
}

export function createWorkflowRuntime(
  user: AuthenticatedUser,
  settings: ModelSettings,
  record: WorkflowRecord,
  threadId = '',
) {
  const workflow = compileWorkflow(record, user, settings, threadId);
  return {
    workflow,
    mastra: new Mastra({ storage, workflows: { [record.id]: workflow } }),
  };
}
