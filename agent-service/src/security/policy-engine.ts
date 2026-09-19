import { createHash, randomUUID } from "node:crypto";

import type { AgentMode, AuthenticatedUser, SSHHost } from "../types.js";
import { addSecurityAuditEvent } from "./audit.js";
import { analyzeCommandRisk } from "./command-risk-analyzer.js";
import { classifyIntent } from "./intent-classifier.js";
import { detectPromptInjection } from "./prompt-injection-detector.js";
import type { InputSecurityContext, SecurityDecisionResult } from "./types.js";

export function securityInputHash(value: unknown): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

export async function evaluateInputSecurity(
  context: InputSecurityContext
): Promise<SecurityDecisionResult> {
  const traceId = context.traceId || randomUUID();
  const inputHash = securityInputHash(context.text);
  await addSecurityAuditEvent({
    traceId,
    orgId: context.user.orgId,
    userId: context.user.id,
    eventType: "intent.received",
    source: context.source,
    target: context.threadId,
    inputHash,
    details: { mode: context.mode, length: context.text.length },
  });

  const injection = detectPromptInjection(context.text);
  await addSecurityAuditEvent({
    traceId,
    orgId: context.user.orgId,
    userId: context.user.id,
    eventType: "prompt_injection.scanned",
    source: context.source,
    target: context.threadId,
    inputHash,
    riskScore: injection.score,
    details: { detected: injection.detected, findings: injection.findings },
  });

  const intent = classifyIntent(injection.normalizedText);
  await addSecurityAuditEvent({
    traceId,
    orgId: context.user.orgId,
    userId: context.user.id,
    eventType: "intent.classified",
    source: context.source,
    target: context.threadId,
    inputHash,
    details: { ...intent },
  });

  const reasons = [
    ...injection.findings.map((finding) => finding.description),
    ...intent.reasons,
  ];
  let decision: SecurityDecisionResult["decision"] = "allow";
  let riskScore = Math.max(injection.score, intent.requestedChange ? 55 : 10);
  if (
    injection.score >= 60 ||
    intent.intent === "privilege-escalation" ||
    intent.intent === "secret-access"
  ) {
    decision = "deny";
    riskScore = Math.max(riskScore, 90);
  } else if (intent.requestedChange || context.mode === "operate") {
    decision = "require-approval";
    riskScore = Math.max(riskScore, 60);
  }
  await addSecurityAuditEvent({
    traceId,
    orgId: context.user.orgId,
    userId: context.user.id,
    eventType:
      decision === "deny"
        ? "policy.denied"
        : decision === "require-approval"
        ? "policy.approval_required"
        : "policy.allowed",
    source: context.source,
    target: context.threadId,
    decision,
    riskScore,
    inputHash,
    details: { intent: intent.intent, reasons },
  });
  return {
    traceId,
    decision,
    riskScore,
    intent: intent.intent,
    reasons,
    inputHash,
  };
}

export async function authorizeSSHExecution(input: {
  user: AuthenticatedUser;
  host: SSHHost;
  toolId: string;
  commandId: string;
  command: string;
  mode?: AgentMode;
  traceId?: string;
}): Promise<SecurityDecisionResult> {
  const traceId = input.traceId || randomUUID();
  const inputHash = securityInputHash({
    hostId: input.host.id,
    toolId: input.toolId,
    commandId: input.commandId,
    command: input.command,
  });
  const analysis = analyzeCommandRisk(input.command);
  const root =
    input.host.username.trim().toLowerCase() === "root" ||
    input.host.username.trim() === "0";
  const decision =
    root || analysis.decision === "deny"
      ? "deny"
      : input.host.simulated || input.toolId === "ssh-execute-command"
      ? "require-approval"
      : "allow";
  const reasons = [
    ...analysis.reasons,
    ...(input.host.simulated ? ["调试模拟设备仍强制执行人工审批"] : []),
    ...(root ? ["禁止使用 root 账户纳管或执行命令"] : []),
  ];
  const riskScore = root
    ? 100
    : input.host.simulated
    ? Math.max(60, analysis.riskScore)
    : input.toolId === "ssh-readonly-inspect"
    ? 20
    : analysis.riskScore;
  await addSecurityAuditEvent({
    traceId,
    orgId: input.user.orgId,
    userId: input.user.id,
    eventType: "command.risk_evaluated",
    source: "tool",
    target: `${input.host.id}:${input.commandId}`,
    decision,
    riskScore,
    inputHash,
    details: {
      toolId: input.toolId,
      executable: analysis.executable,
      simulated: Boolean(input.host.simulated),
      reasons,
    },
  });
  await addSecurityAuditEvent({
    traceId,
    orgId: input.user.orgId,
    userId: input.user.id,
    eventType:
      decision === "deny"
        ? "policy.denied"
        : decision === "require-approval"
        ? "approval.enforced"
        : "policy.allowed",
    source: "tool",
    target: `${input.host.id}:${input.commandId}`,
    decision,
    riskScore,
    inputHash,
    details: {
      toolId: input.toolId,
      commandId: input.commandId,
      simulated: Boolean(input.host.simulated),
      reasons,
    },
  });
  return {
    traceId,
    decision,
    riskScore,
    intent: decision === "allow" ? "observe" : "change",
    reasons,
    inputHash,
  };
}
