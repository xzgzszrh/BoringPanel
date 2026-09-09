import { Mastra } from '@mastra/core/mastra';
import { createScryAgent, storage } from './agent.js';
import { compileWorkflow } from './workflows/compiler.js';
export async function createAgentRuntime(user, settings, mode, evidenceContext) {
    const { agent, disconnect } = await createScryAgent(user, settings, mode, evidenceContext);
    return {
        agent,
        mastra: new Mastra({ storage, agents: { [agent.id]: agent } }),
        disconnect,
    };
}
export function createWorkflowRuntime(user, settings, record, threadId = '') {
    const workflow = compileWorkflow(record, user, settings, threadId);
    return {
        workflow,
        mastra: new Mastra({ storage, workflows: { [record.id]: workflow } }),
    };
}
//# sourceMappingURL=runtime.js.map