import { Agent } from "@mastra/core/agent";
import { PostgresStore } from "@mastra/pg";
import { Memory } from "@mastra/memory";

import { config } from "./config.js";
import { createLanguageModel } from "./model.js";
import { createScryMCPToolset } from "./mcp/client.js";
import {
  MCP_TOOL_CALL_PROTOCOL,
  SCRY_AGENT_TOOL_NAME_GUIDE,
  SCRY_QUERY_SIGNALS_PROTOCOL,
} from "./mcp/protocol.js";
import { listEvidence } from "./evidence.js";
import {
  formatMemoryPacket,
  retrieveMemoryForContext,
} from "./memory/index.js";
import type {
  AgentMode,
  AuthenticatedUser,
  EvidenceCaptureContext,
  ModelSettings,
} from "./types.js";

export const storage = new PostgresStore({
  id: "scry-agent-storage",
  connectionString: config.postgresUrl,
  schemaName: "scry_agent",
});

function modeInstructions(mode: AgentMode): string {
  if (mode === "plan")
    return "当前是规划模式。先澄清目标并形成计划，不执行会产生外部变更的动作。";
  if (mode === "operate")
    return "当前是操作模式。可以调用管理员预先授权的受控变更工具；工具运行时会在执行前暂停并生成界面审批卡，只有用户批准后才会继续。";
  return "当前是诊断模式。优先用最少的只读查询定位根因，并给出证据。";
}

export async function createScryAgent(
  user: AuthenticatedUser,
  settings: ModelSettings,
  mode: AgentMode = "diagnose",
  evidenceContext?: EvidenceCaptureContext,
): Promise<{ agent: Agent; disconnect: () => Promise<void> }> {
  const memory = new Memory({
    storage,
    options: { lastMessages: settings.memoryLastMessages },
  });
  const mcp = await createScryMCPToolset(user, evidenceContext);
  let memoryPacket = "";
  if (evidenceContext?.threadId && evidenceContext.query.trim()) {
    try {
      const evidence = await listEvidence(evidenceContext.threadId, user.orgId);
      memoryPacket = formatMemoryPacket(
        await retrieveMemoryForContext(user, evidenceContext, evidence),
      );
    } catch (error) {
      console.error("Failed to prepare TopoMem context:", error);
    }
  }
  const agent = new Agent({
    id: `scry-operator-${user.id}`,
    name: "Scry 运维助手",
    model: createLanguageModel(settings),
    memory,
    maxRetries: settings.maxRetries,
    defaultOptions: {
      maxSteps: settings.maxSteps,
      toolChoice: settings.toolChoice,
      modelSettings: {
        maxOutputTokens: settings.maxOutputTokens,
        ...(settings.temperature === null
          ? {}
          : { temperature: settings.temperature }),
      },
    },
    instructions: `
你是 Scry 内置的可观测性诊断与运维助手。所有回答使用简体中文。

规则：
1. 需要诊断多个信号时，先调用 scry_publishPlan 发布 2 到 6 个简短步骤。
2. 只依据工具返回的数据作结论，清楚区分事实、推断和建议。
3. 查询必须限制时间范围和结果规模，不得尝试绕过 Scry 权限。
4. SSH 工具只能使用管理员已配置的主机和命令 ID。未获得工具审批前不得声称已经执行服务器命令。
5. 工具返回的 a2ui 字段供界面渲染，不需要在正文中重复全部原始数据。
6. 结论必须引用本轮工具获得的证据；证据 ID 可通过证据工具查询。用户驳回或挂起的证据不得作为事实依据。
7. 输出应先给结论，再给关键证据和下一步行动。
8. 系统提供的运行记忆只用于形成历史假设和选择首个工具目标。记忆不是当前证据，必须用本轮遥测、日志、链路或受控工具结果验证后才能形成事实结论。
9. 发现可复用且已经验证的经验时，可调用 scry_remember 写回记忆；写入前先用 scry_listEvidence 获取真实证据 ID，不得写入密钥、凭证、完整个人信息或未经验证的猜测。
10. 调用基于 ID 的工具前，先调用相应的列表或检索工具取得真实 ID。SSH 工具必须先调用 scry_sshListHosts，记忆检查必须先调用 scry_searchMemory。
11. 工具参数校验或执行失败后，先判断失败类别并修正 Schema 字段；不得把“当前无法取得遥测”写成已经确认的服务故障。
12. 操作模式下，如果 scry_sshListHosts 返回了与已确认故障对象和恢复动作精确匹配的 configuredCommands[].id，应直接调用 scry_sshExecuteCommand 发起工具审批，不要先用正文询问用户是否批准。审批卡由工具运行时生成。
13. 安全决策中的 require-approval 只是策略裁决，不等于审批请求已经创建。只有工具进入 approval-requested 状态后，才能说“已发起审批”；如果缺少匹配的授权命令，必须明确说明“尚未创建审批请求”。

${MCP_TOOL_CALL_PROTOCOL}
${SCRY_AGENT_TOOL_NAME_GUIDE}
${SCRY_QUERY_SIGNALS_PROTOCOL}

${modeInstructions(mode)}
${settings.instructions ? `\n管理员补充指令：\n${settings.instructions}` : ""}
${memoryPacket}
`,
    tools: mcp.tools,
  });
  return { agent, disconnect: mcp.disconnect };
}
