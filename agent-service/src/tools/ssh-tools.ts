import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import {
  isSimulatedSSHHost,
  SIMULATED_SSH_COMMANDS,
} from "../debug/simulation.js";
import {
  addSSHAudit,
  getSSHHostWithSecret,
  getSSHToolPolicy,
  listSSHHosts,
} from "../ssh/repository.js";
import type {
  AuthenticatedUser,
  EvidenceCaptureContext,
  SSHAuditRecord,
} from "../types.js";
import { authorizeSSHExecution } from "../security/policy-engine.js";
import { addSecurityAuditEvent } from "../security/audit.js";
import { a2ui } from "./a2ui.js";
import {
  executeSSHCommand,
  SSH_READONLY_COMMAND_LABELS,
  SSH_READONLY_COMMANDS,
  type SSHExecutionResult,
  type SSHReadonlyCommandId,
} from "./ssh.js";
import { recordEvidence } from "../evidence.js";

async function auditedExecution(input: {
  user: AuthenticatedUser;
  hostId: string;
  toolId: "ssh-readonly-inspect" | "ssh-execute-command";
  commandId: string;
  command: string;
  timeoutSeconds: number;
  evidenceContext?: EvidenceCaptureContext;
  evidenceTitle: string;
}): Promise<SSHExecutionResult & { hostName: string; commandName: string }> {
  const host = await getSSHHostWithSecret(input.hostId, input.user.orgId);
  if (!host || !host.enabled) throw new Error("SSH 主机不存在或已停用");
  const security = await authorizeSSHExecution({
    user: input.user,
    host,
    toolId: input.toolId,
    commandId: input.commandId,
    command: input.command,
    traceId: input.evidenceContext?.traceId,
  });
  if (security.decision === "deny")
    throw new Error(`安全策略拒绝执行：${security.reasons.join("；")}`);
  await addSecurityAuditEvent({
    traceId: security.traceId,
    orgId: input.user.orgId,
    userId: input.user.id,
    eventType: "tool.execution.started",
    source: "tool",
    target: `${host.id}:${input.commandId}`,
    decision: security.decision,
    riskScore: security.riskScore,
    inputHash: security.inputHash,
    details: {
      toolId: input.toolId,
      commandId: input.commandId,
      hostId: host.id,
      simulated: Boolean(host.simulated),
    },
  });
  const startedAt = Date.now();
  try {
    const result = await executeSSHCommand(
      host,
      input.command,
      input.timeoutSeconds,
    );
    await addSSHAudit({
      userId: input.user.id,
      hostId: host.id,
      hostName: host.name,
      toolId: input.toolId,
      commandId: input.commandId,
      status: result.exitCode === 0 ? "success" : "failed",
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      stdoutBytes: result.stdoutBytes,
      stderrBytes: result.stderrBytes,
      error:
        result.exitCode === 0
          ? ""
          : `远程命令退出码 ${result.exitCode ?? "未知"}`,
    });
    await addSecurityAuditEvent({
      traceId: security.traceId,
      orgId: input.user.orgId,
      userId: input.user.id,
      eventType:
        result.exitCode === 0
          ? "tool.execution.completed"
          : "tool.execution.failed",
      source: "tool",
      target: `${host.id}:${input.commandId}`,
      decision: result.exitCode === 0 ? "allow" : "deny",
      riskScore: security.riskScore,
      inputHash: security.inputHash,
      details: {
        toolId: input.toolId,
        commandId: input.commandId,
        hostId: host.id,
        simulated: Boolean(host.simulated),
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        stdoutBytes: result.stdoutBytes,
        stderrBytes: result.stderrBytes,
      },
    });
    if (input.evidenceContext) {
      await recordEvidence({
        user: input.user,
        context: input.evidenceContext,
        sourceType: "ssh",
        sourceName: `ssh:${input.commandId}`,
        title: input.evidenceTitle,
        summary: `${host.name} 执行 ${input.evidenceTitle}，退出码 ${result.exitCode ?? "未知"}，耗时 ${result.durationMs} ms。`,
        content: {
          hostId: host.id,
          hostName: host.name,
          simulated: Boolean(host.simulated),
          commandId: input.commandId,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          truncated: result.truncated,
        },
        completed: result.exitCode === 0,
      }).catch((error) =>
        console.error(
          `Failed to record SSH evidence ${input.commandId}:`,
          error,
        ),
      );
    }
    return { ...result, hostName: host.name, commandName: input.commandId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SSH 执行失败";
    const audit: Omit<SSHAuditRecord, "id" | "createdAt"> = {
      userId: input.user.id,
      hostId: host.id,
      hostName: host.name,
      toolId: input.toolId,
      commandId: input.commandId,
      status: "failed",
      exitCode: null,
      durationMs: Date.now() - startedAt,
      stdoutBytes: 0,
      stderrBytes: 0,
      error: message.slice(0, 500),
    };
    await addSSHAudit(audit);
    await addSecurityAuditEvent({
      traceId: security.traceId,
      orgId: input.user.orgId,
      userId: input.user.id,
      eventType: "tool.execution.failed",
      source: "tool",
      target: `${host.id}:${input.commandId}`,
      decision: "deny",
      riskScore: security.riskScore,
      inputHash: security.inputHash,
      details: {
        toolId: input.toolId,
        commandId: input.commandId,
        hostId: host.id,
        simulated: Boolean(host.simulated),
        error: message.slice(0, 300),
      },
    });
    throw error;
  }
}

export function createSSHTools(
  user: AuthenticatedUser,
  evidenceContext?: EvidenceCaptureContext,
) {
  const listHosts = createTool({
    id: "ssh-list-hosts",
    description:
      "列出管理员已经授权给 Agent 使用的 SSH 主机和可选择的命令 ID。调用 sshReadonlyInspect 或 sshExecuteCommand 前必须先调用本工具；结果不包含密码、私钥或精确命令文本。",
    inputSchema: z.object({}).describe("无参数；调用时传空对象 {}。"),
    outputSchema: z.object({
      hosts: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          hostname: z.string(),
          simulated: z.boolean(),
        }),
      ),
      readonlyCommands: z.array(z.object({ id: z.string(), name: z.string() })),
      configuredCommands: z.array(
        z.object({ id: z.string(), name: z.string(), description: z.string() }),
      ),
      a2ui: z.any(),
    }),
    execute: async () => {
      const [hosts, readonlyPolicy, commandPolicy] = await Promise.all([
        listSSHHosts(true, user.orgId),
        getSSHToolPolicy("ssh-readonly-inspect"),
        getSSHToolPolicy("ssh-execute-command"),
      ]);
      const hasSimulatedHost = hosts.some((host) => host.simulated);
      const safeHosts = hosts.map(({ id, name, hostname, simulated }) => ({
        id,
        name,
        hostname,
        simulated: Boolean(simulated),
      }));
      const readonlyCommandIds = [
        ...(readonlyPolicy.enabled ? readonlyPolicy.commandIds : []),
        ...(hasSimulatedHost ? Object.keys(SSH_READONLY_COMMANDS) : []),
      ].filter((id, index, values) => values.indexOf(id) === index);
      const readonlyCommands = readonlyCommandIds.map((id) => ({
        id,
        name: SSH_READONLY_COMMAND_LABELS[id as SSHReadonlyCommandId] || id,
      }));
      const configuredDefinitions = [
        ...(commandPolicy.enabled ? commandPolicy.commands : []),
        ...(hasSimulatedHost ? SIMULATED_SSH_COMMANDS : []),
      ].filter(
        (command, index, values) =>
          values.findIndex((candidate) => candidate.id === command.id) === index,
      );
      const configuredCommands = configuredDefinitions.map(
        ({ id, name, description }) => ({
          id,
          name,
          description,
        }),
      );
      return {
        hosts: safeHosts,
        readonlyCommands,
        configuredCommands,
        a2ui: a2ui("ssh-hosts", "table", "SSH 主机与授权命令", {
          hosts: safeHosts,
          readonlyCommands,
          configuredCommands,
        }),
      };
    },
  });

  const readonlyInspect = createTool({
    id: "ssh-readonly-inspect",
    description: `在指定 SSH 主机执行管理员启用的内置只读巡检。先调用 sshListHosts 获取 hostId 和已启用的 readonlyCommands[].id；只能选择固定命令 ID，不能输入 shell 命令。
示例：{"hostId":"00000000-0000-4000-8000-000000000001","commandId":"disk_usage"}`,
    inputSchema: z
      .object({
        hostId: z
          .string()
          .uuid()
          .describe(
            "来自 sshListHosts 返回的 hosts[].id UUID，不是主机名或 IP。",
          ),
        commandId: z
          .enum(
            Object.keys(SSH_READONLY_COMMANDS) as [
              SSHReadonlyCommandId,
              ...SSHReadonlyCommandId[],
            ],
          )
          .describe(
            "来自 sshListHosts 返回的 readonlyCommands[].id。可选值分别表示系统概览、磁盘、内存、失败服务、监听端口、近期错误和安全预检。",
          ),
      })
      .describe(
        "直接传 hostId 和 commandId，不要传 hostname、command、args 或 input 包装层。",
      ),
    outputSchema: z.object({
      hostName: z.string(),
      commandName: z.string(),
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number().nullable(),
      signal: z.string().nullable(),
      durationMs: z.number(),
      stdoutBytes: z.number(),
      stderrBytes: z.number(),
      truncated: z.boolean(),
      a2ui: z.any(),
    }),
    requireApproval: async ({ hostId }) =>
      (await isSimulatedSSHHost(hostId, user.orgId)) ||
      (await getSSHToolPolicy("ssh-readonly-inspect")).requireApproval,
    execute: async ({ hostId, commandId }) => {
      const policy = await getSSHToolPolicy("ssh-readonly-inspect");
      const simulated = await isSimulatedSSHHost(hostId, user.orgId);
      if (!policy.enabled && !simulated)
        throw new Error("SSH 只读巡检工具尚未启用");
      if (!simulated && !policy.commandIds.includes(commandId))
        throw new Error("该只读巡检命令未获管理员授权");
      const result = await auditedExecution({
        user,
        hostId,
        commandId,
        toolId: "ssh-readonly-inspect",
        command: SSH_READONLY_COMMANDS[commandId],
        timeoutSeconds: policy.maxSeconds,
        evidenceContext,
        evidenceTitle: SSH_READONLY_COMMAND_LABELS[commandId],
      });
      const commandName = SSH_READONLY_COMMAND_LABELS[commandId];
      return {
        ...result,
        commandName,
        a2ui: a2ui(
          `ssh-${hostId}-${commandId}`,
          "code",
          `${result.hostName} · ${commandName}`,
          {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            truncated: result.truncated,
          },
        ),
      };
    },
  });

  const executeConfiguredCommand = createTool({
    id: "ssh-execute-command",
    description: `执行管理员预先保存的精确 SSH 命令。先调用 sshListHosts 获取 hostId 和 configuredCommands[].id；只能选择命令 ID，不能传 shell 文本，每次调用都必须人工审批。
当命令与已确认的故障对象精确匹配时，直接调用本工具。调用后运行时会生成审批卡并暂停，不能用正文中的“需要审批”替代工具调用。
示例：{"hostId":"00000000-0000-4000-8000-000000000001","commandId":"rolling-restart-quote-service"}`,
    inputSchema: z
      .object({
        hostId: z
          .string()
          .uuid()
          .describe(
            "来自 sshListHosts 返回的 hosts[].id UUID，不是主机名或 IP。",
          ),
        commandId: z
          .string()
          .regex(/^[a-zA-Z0-9_-]+$/)
          .describe(
            "来自 sshListHosts 返回的 configuredCommands[].id；不得改写为命令文本。",
          ),
      })
      .describe(
        "直接传 hostId 和 commandId，不要传 hostname、command、args 或 input 包装层。",
      ),
    outputSchema: z.object({
      hostName: z.string(),
      commandName: z.string(),
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number().nullable(),
      signal: z.string().nullable(),
      durationMs: z.number(),
      stdoutBytes: z.number(),
      stderrBytes: z.number(),
      truncated: z.boolean(),
      a2ui: z.any(),
    }),
    requireApproval: true,
    execute: async ({ hostId, commandId }) => {
      const policy = await getSSHToolPolicy("ssh-execute-command");
      const simulated = await isSimulatedSSHHost(hostId, user.orgId);
      if (!policy.enabled && !simulated)
        throw new Error("SSH 扩展命令工具尚未启用");
      const definition = simulated
        ? SIMULATED_SSH_COMMANDS.find((command) => command.id === commandId)
        : policy.commands.find((command) => command.id === commandId);
      if (!definition) throw new Error("该 SSH 命令未获管理员授权");
      const result = await auditedExecution({
        user,
        hostId,
        commandId,
        toolId: "ssh-execute-command",
        command: definition.command,
        timeoutSeconds: policy.maxSeconds,
        evidenceContext,
        evidenceTitle: definition.name,
      });
      return {
        ...result,
        commandName: definition.name,
        a2ui: a2ui(
          `ssh-${hostId}-${commandId}`,
          "code",
          `${result.hostName} · ${definition.name}`,
          {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            truncated: result.truncated,
          },
        ),
      };
    },
  });

  return {
    sshListHosts: listHosts,
    sshReadonlyInspect: readonlyInspect,
    sshExecuteCommand: executeConfiguredCommand,
  };
}
