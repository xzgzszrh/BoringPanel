import { randomUUID } from "node:crypto";

import { config } from "../config.js";
import { decryptSecret, encryptSecret } from "../crypto.js";
import { getSimulatedSSHHost } from "../debug/simulation.js";
import { db } from "../db.js";
import type {
  SSHAuditRecord,
  SSHAuthType,
  SSHCommandDefinition,
  SSHHost,
  SSHHostSecret,
  SSHToolPolicy,
} from "../types.js";

const POLICY_IDS = ["ssh-readonly-inspect", "ssh-execute-command"] as const;

function hostFromRow(row: Record<string, unknown>): SSHHost {
  return {
    id: String(row.id),
    name: String(row.name),
    hostname: String(row.hostname),
    port: Number(row.port),
    username: String(row.username),
    authType: String(row.auth_type) as SSHAuthType,
    hostKeyFingerprint: String(row.host_key_fingerprint),
    enabled: Boolean(Number(row.enabled)),
    hasSecret: Boolean(String(row.secret_encrypted || "")),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function listSSHHosts(
  enabledOnly = false,
  orgId = ""
): Promise<SSHHost[]> {
  const result = await db.execute(
    `SELECT * FROM scry_ssh_hosts ${
      enabledOnly ? "WHERE enabled = 1" : ""
    } ORDER BY name, created_at`
  );
  const hosts = result.rows.map((row) => hostFromRow(row));
  const simulated = orgId ? await getSimulatedSSHHost(orgId) : null;
  return simulated ? [simulated, ...hosts] : hosts;
}

export async function getSSHHost(
  id: string,
  orgId = ""
): Promise<SSHHost | null> {
  const simulated = orgId ? await getSimulatedSSHHost(orgId) : null;
  if (simulated?.id === id) return simulated;
  const result = await db.execute({
    sql: "SELECT * FROM scry_ssh_hosts WHERE id = ?",
    args: [id],
  });
  return result.rows[0] ? hostFromRow(result.rows[0]) : null;
}

export async function getSSHHostWithSecret(
  id: string,
  orgId = ""
): Promise<(SSHHost & SSHHostSecret) | null> {
  const simulated = orgId ? await getSimulatedSSHHost(orgId) : null;
  if (simulated?.id === id) return simulated;
  const result = await db.execute({
    sql: "SELECT * FROM scry_ssh_hosts WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  const encrypted = String(row.secret_encrypted || "");
  const secret = encrypted
    ? (JSON.parse(decryptSecret(encrypted, config.masterKey)) as SSHHostSecret)
    : {};
  return { ...hostFromRow(row), ...secret };
}

function validateSecret(authType: SSHAuthType, secret: SSHHostSecret): void {
  if (authType === "password" && !secret.password)
    throw new Error("密码认证必须填写密码");
  if (authType === "private_key" && !secret.privateKey)
    throw new Error("密钥认证必须填写私钥");
}

function validateManagedUsername(username: string): void {
  const normalized = username.trim().toLowerCase();
  if (normalized !== "scry-ops")
    throw new Error("受管 SSH 主机必须使用最小权限账户 scry-ops");
}

export async function createSSHHost(input: {
  name: string;
  hostname: string;
  port: number;
  username: string;
  authType: SSHAuthType;
  hostKeyFingerprint: string;
  enabled: boolean;
  secret: SSHHostSecret;
}): Promise<SSHHost> {
  validateManagedUsername(input.username);
  if (input.authType !== "private_key")
    throw new Error("scry-ops 账户只允许公钥认证");
  validateSecret(input.authType, input.secret);
  const id = randomUUID();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO scry_ssh_hosts
      (id, name, hostname, port, username, auth_type, secret_encrypted, host_key_fingerprint, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.name,
      input.hostname,
      input.port,
      input.username,
      input.authType,
      encryptSecret(JSON.stringify(input.secret), config.masterKey),
      input.hostKeyFingerprint,
      input.enabled ? 1 : 0,
      now,
      now,
    ],
  });
  return (await getSSHHost(id)) as SSHHost;
}

export async function updateSSHHost(
  id: string,
  input: {
    name: string;
    hostname: string;
    port: number;
    username: string;
    authType: SSHAuthType;
    hostKeyFingerprint: string;
    enabled: boolean;
    secret?: SSHHostSecret;
  }
): Promise<SSHHost | null> {
  validateManagedUsername(input.username);
  if (input.authType !== "private_key")
    throw new Error("scry-ops 账户只允许公钥认证");
  const current = await getSSHHostWithSecret(id);
  if (!current) return null;
  const nextSecret: SSHHostSecret = {
    privateKey: input.secret?.privateKey || current.privateKey,
    passphrase: input.secret?.passphrase || current.passphrase,
  };
  validateSecret(input.authType, nextSecret);
  await db.execute({
    sql: `UPDATE scry_ssh_hosts SET name = ?, hostname = ?, port = ?, username = ?, auth_type = ?,
      secret_encrypted = ?, host_key_fingerprint = ?, enabled = ?, updated_at = ? WHERE id = ?`,
    args: [
      input.name,
      input.hostname,
      input.port,
      input.username,
      input.authType,
      encryptSecret(JSON.stringify(nextSecret), config.masterKey),
      input.hostKeyFingerprint,
      input.enabled ? 1 : 0,
      Date.now(),
      id,
    ],
  });
  return getSSHHost(id);
}

export async function deleteSSHHost(id: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM scry_ssh_hosts WHERE id = ?",
    args: [id],
  });
}

function policyFromRow(row: Record<string, unknown>): SSHToolPolicy {
  const data = JSON.parse(String(row.policy_json || "{}")) as {
    maxSeconds?: number;
    commandIds?: string[];
    commands?: SSHCommandDefinition[];
  };
  return {
    toolId: String(row.tool_id) as SSHToolPolicy["toolId"],
    riskLevel: Number(row.risk_level),
    enabled: Boolean(Number(row.enabled)),
    requireApproval: Boolean(Number(row.require_approval)),
    maxSeconds: Number(data.maxSeconds || 30),
    commandIds: Array.isArray(data.commandIds) ? data.commandIds : [],
    commands: Array.isArray(data.commands) ? data.commands : [],
    updatedAt: Number(row.updated_at),
  };
}

export async function getSSHToolPolicy(
  toolId: SSHToolPolicy["toolId"]
): Promise<SSHToolPolicy> {
  const result = await db.execute({
    sql: "SELECT * FROM scry_tool_policies WHERE tool_id = ?",
    args: [toolId],
  });
  if (!result.rows[0]) throw new Error(`SSH 工具策略不存在：${toolId}`);
  return policyFromRow(result.rows[0]);
}

export async function listSSHToolPolicies(): Promise<SSHToolPolicy[]> {
  const result = await db.execute({
    sql: `SELECT * FROM scry_tool_policies WHERE tool_id IN (?, ?) ORDER BY risk_level`,
    args: [...POLICY_IDS],
  });
  return result.rows.map((row) => policyFromRow(row));
}

export async function updateSSHToolPolicy(
  input: SSHToolPolicy
): Promise<SSHToolPolicy> {
  const requireApproval =
    input.toolId === "ssh-execute-command" ? true : input.requireApproval;
  await db.execute({
    sql: `UPDATE scry_tool_policies SET enabled = ?, require_approval = ?, policy_json = ?, updated_at = ?
      WHERE tool_id = ?`,
    args: [
      input.enabled ? 1 : 0,
      requireApproval ? 1 : 0,
      JSON.stringify({
        mode:
          input.toolId === "ssh-execute-command"
            ? "configured-only"
            : "builtin-only",
        maxSeconds: input.maxSeconds,
        commandIds: input.commandIds,
        commands: input.commands,
      }),
      Date.now(),
      input.toolId,
    ],
  });
  return getSSHToolPolicy(input.toolId);
}

export async function addSSHAudit(
  input: Omit<SSHAuditRecord, "id" | "createdAt">
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO scry_ssh_audit_logs
      (user_id, host_id, host_name, tool_id, command_id, status, exit_code, duration_ms,
       stdout_bytes, stderr_bytes, error_text, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.userId,
      input.hostId,
      input.hostName,
      input.toolId,
      input.commandId,
      input.status,
      input.exitCode,
      input.durationMs,
      input.stdoutBytes,
      input.stderrBytes,
      input.error,
      Date.now(),
    ],
  });
}

export async function listSSHAudits(limit = 50): Promise<SSHAuditRecord[]> {
  const result = await db.execute({
    sql: "SELECT * FROM scry_ssh_audit_logs ORDER BY id DESC LIMIT ?",
    args: [Math.min(Math.max(limit, 1), 200)],
  });
  return result.rows.map((row) => ({
    id: Number(row.id),
    userId: String(row.user_id),
    hostId: String(row.host_id),
    hostName: String(row.host_name),
    toolId: String(row.tool_id),
    commandId: String(row.command_id),
    status: String(row.status) as SSHAuditRecord["status"],
    exitCode: row.exit_code === null ? null : Number(row.exit_code),
    durationMs: Number(row.duration_ms),
    stdoutBytes: Number(row.stdout_bytes),
    stderrBytes: Number(row.stderr_bytes),
    error: String(row.error_text || ""),
    createdAt: Number(row.created_at),
  }));
}
