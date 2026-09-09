import { randomUUID } from 'node:crypto';

import { config } from './config.js';
import { decryptSecret, encryptSecret } from './crypto.js';
import { createWasmSQLiteClient, type DatabaseClient } from './database/wasm-sqlite.js';
import { workflowPresets } from './workflows/presets.js';
import type {
  AgentToolChoice,
  ModelEndpointMode,
  ModelProvider,
  ModelSettings,
  MCPServerRecord,
  WorkflowDefinition,
  WorkflowRecord,
  WorkflowRunRecord,
  WorkflowEventTrigger,
  WorkflowInputField,
  WorkflowScheduleConfig,
  WorkflowVersionRecord,
} from './types.js';

export const db: DatabaseClient = await createWasmSQLiteClient(config.databaseUrl);

export async function initializeDatabase(): Promise<void> {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS scry_model_settings (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        base_url TEXT NOT NULL DEFAULT '',
        api_key_encrypted TEXT NOT NULL DEFAULT '',
        endpoint_mode TEXT NOT NULL DEFAULT 'official',
        temperature REAL,
        max_output_tokens INTEGER NOT NULL DEFAULT 8192,
        max_steps INTEGER NOT NULL DEFAULT 8,
        timeout_seconds INTEGER NOT NULL DEFAULT 120,
        max_retries INTEGER NOT NULL DEFAULT 1,
        tool_choice TEXT NOT NULL DEFAULT 'auto',
        instructions TEXT NOT NULL DEFAULT '',
        memory_last_messages INTEGER NOT NULL DEFAULT 30,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_agent_threads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_agent_ui_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        message_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(thread_id) REFERENCES scry_agent_threads(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS scry_evidence_items (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        trace_id TEXT NOT NULL,
        message_id TEXT NOT NULL DEFAULT '',
        source_type TEXT NOT NULL,
        source_name TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        relevance INTEGER NOT NULL,
        score_factors_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active',
        selected INTEGER NOT NULL DEFAULT 1,
        note TEXT NOT NULL DEFAULT '',
        captured_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(thread_id) REFERENCES scry_agent_threads(id) ON DELETE CASCADE
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_scry_evidence_dedupe
        ON scry_evidence_items(thread_id, trace_id, source_name, content_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_scry_evidence_thread_time
        ON scry_evidence_items(thread_id, captured_at)`,
      `CREATE TABLE IF NOT EXISTS scry_evidence_relations (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        from_evidence_id TEXT NOT NULL,
        to_evidence_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        score INTEGER NOT NULL,
        rationale TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        UNIQUE(from_evidence_id, to_evidence_id, relation_type)
      )`,
      `CREATE TABLE IF NOT EXISTS scry_evidence_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evidence_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        previous_status TEXT NOT NULL,
        next_status TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_evidence_revisions (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        assistant_message_id TEXT NOT NULL,
        selected_ids_json TEXT NOT NULL,
        excluded_ids_json TEXT NOT NULL,
        instruction TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_memory_items (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        thread_id TEXT NOT NULL DEFAULT '',
        workflow_id TEXT NOT NULL DEFAULT '',
        agent_id TEXT NOT NULL DEFAULT 'scry-operator',
        memory_type TEXT NOT NULL,
        scope TEXT NOT NULL,
        service_name TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        keywords_json TEXT NOT NULL DEFAULT '[]',
        confidence INTEGER NOT NULL,
        importance INTEGER NOT NULL,
        vitality INTEGER NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        reinforcement_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        pinned INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        last_reinforced_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_scry_memory_scope
        ON scry_memory_items(org_id, scope, user_id, status, updated_at)`,
      `CREATE INDEX IF NOT EXISTS idx_scry_memory_service
        ON scry_memory_items(org_id, service_name, status, vitality)`,
      `CREATE INDEX IF NOT EXISTS idx_scry_memory_hash
        ON scry_memory_items(org_id, content_hash, status)`,
      `CREATE TABLE IF NOT EXISTS scry_memory_chunks (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        token_count INTEGER NOT NULL DEFAULT 0,
        keywords_json TEXT NOT NULL DEFAULT '[]',
        service_name TEXT NOT NULL DEFAULT '',
        confidence INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(memory_id, chunk_index)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_scry_memory_chunks_memory
        ON scry_memory_chunks(memory_id, chunk_index)`,
      `CREATE TABLE IF NOT EXISTS scry_memory_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        trace_id TEXT NOT NULL DEFAULT '',
        relation TEXT NOT NULL DEFAULT 'derived_from',
        weight INTEGER NOT NULL DEFAULT 100,
        created_at INTEGER NOT NULL,
        UNIQUE(memory_id, source_type, source_id, relation)
      )`,
      `CREATE TABLE IF NOT EXISTS scry_memory_relations (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        from_memory_id TEXT NOT NULL,
        to_memory_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        score INTEGER NOT NULL,
        rationale TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        UNIQUE(from_memory_id, to_memory_id, relation_type)
      )`,
      `CREATE TABLE IF NOT EXISTS scry_memory_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        previous_status TEXT NOT NULL,
        next_status TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_memory_topology_edges (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        from_service TEXT NOT NULL,
        to_service TEXT NOT NULL,
        observation_count INTEGER NOT NULL DEFAULT 0,
        error_observation_count INTEGER NOT NULL DEFAULT 0,
        cumulative_error_rate REAL NOT NULL DEFAULT 0,
        confidence INTEGER NOT NULL DEFAULT 0,
        last_trace_id TEXT NOT NULL DEFAULT '',
        last_observed_at INTEGER NOT NULL,
        UNIQUE(org_id, from_service, to_service)
      )`,
      `CREATE TABLE IF NOT EXISTS scry_memory_retrieval_runs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        thread_id TEXT NOT NULL DEFAULT '',
        trace_id TEXT NOT NULL DEFAULT '',
        query_text TEXT NOT NULL,
        strategy TEXT NOT NULL,
        symptom_service TEXT NOT NULL DEFAULT '',
        signature_json TEXT NOT NULL DEFAULT '[]',
        paths_json TEXT NOT NULL DEFAULT '[]',
        fallback_reason TEXT NOT NULL DEFAULT '',
        candidate_count INTEGER NOT NULL DEFAULT 0,
        returned_ids_json TEXT NOT NULL DEFAULT '[]',
        latency_ms INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_mcp_servers (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        headers_encrypted TEXT NOT NULL DEFAULT '',
        timeout_ms INTEGER NOT NULL DEFAULT 30000,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_scry_mcp_servers_org
        ON scry_mcp_servers(org_id, enabled, updated_at)`,
      `CREATE TABLE IF NOT EXISTS scry_security_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '',
        decision TEXT NOT NULL DEFAULT '',
        risk_score INTEGER NOT NULL DEFAULT 0,
        input_hash TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_scry_security_audit_org_time
        ON scry_security_audit_events(org_id, created_at)`,
      `CREATE TABLE IF NOT EXISTS scry_ssh_hosts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 22,
        username TEXT NOT NULL,
        auth_type TEXT NOT NULL,
        secret_encrypted TEXT NOT NULL,
        host_key_fingerprint TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_debug_simulation_settings (
        org_id TEXT PRIMARY KEY,
        simulated_ssh_enabled INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_tool_policies (
        tool_id TEXT PRIMARY KEY,
        risk_level INTEGER NOT NULL,
        enabled INTEGER NOT NULL,
        require_approval INTEGER NOT NULL,
        policy_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_ssh_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        host_id TEXT NOT NULL,
        host_name TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        command_id TEXT NOT NULL,
        status TEXT NOT NULL,
        exit_code INTEGER,
        duration_ms INTEGER NOT NULL,
        stdout_bytes INTEGER NOT NULL DEFAULT 0,
        stderr_bytes INTEGER NOT NULL DEFAULT 0,
        error_text TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        definition_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        tags_json TEXT NOT NULL DEFAULT '[]',
        schedule_json TEXT NOT NULL DEFAULT '{}',
        event_triggers_json TEXT NOT NULL DEFAULT '[]',
        input_schema_json TEXT NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL DEFAULT 1,
        versions_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scry_workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        thread_id TEXT NOT NULL DEFAULT '',
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        input_json TEXT NOT NULL DEFAULT '{}',
        output_json TEXT NOT NULL DEFAULT '{}',
        step_state_json TEXT NOT NULL DEFAULT '{}',
        suspended_step TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(workflow_id) REFERENCES scry_workflows(id) ON DELETE CASCADE
      )`,
    ],
    'write',
  );

  // Add metadata columns for databases created by the earlier Loop editor.
  for (const statement of [
    `ALTER TABLE scry_workflows ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE scry_workflows ADD COLUMN schedule_json TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE scry_workflows ADD COLUMN event_triggers_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE scry_workflows ADD COLUMN input_schema_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE scry_workflows ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE scry_workflows ADD COLUMN versions_json TEXT NOT NULL DEFAULT '[]'`,
  ]) {
    try {
      await db.execute(statement);
    } catch (error) {
      if (!String(error).toLowerCase().includes('duplicate column')) throw error;
    }
  }

  const now = Date.now();
  await db.execute({
    sql: `INSERT OR IGNORE INTO scry_model_settings
      (id, provider, model, base_url, api_key_encrypted, updated_at)
      VALUES ('default', 'openai', 'gpt-4o-mini', '', '', ?)`,
    args: [now],
  });
  await db.execute({
    sql: `INSERT OR IGNORE INTO scry_tool_policies
      (tool_id, risk_level, enabled, require_approval, policy_json, updated_at)
      VALUES ('ssh-readonly-inspect', 1, 0, 1, ?, ?)`,
    args: [JSON.stringify({
      commandIds: ['system_overview', 'disk_usage', 'memory_usage', 'failed_services', 'network_listeners', 'recent_errors'],
      maxSeconds: 30,
    }), now],
  });
  await db.execute({
    sql: `INSERT OR IGNORE INTO scry_tool_policies
      (tool_id, risk_level, enabled, require_approval, policy_json, updated_at)
      VALUES ('ssh-execute-command', 3, 0, 1, ?, ?)`,
    args: [JSON.stringify({ mode: 'configured-only', maxSeconds: 30, commands: [] }), now],
  });

  const defaultWorkflow: WorkflowDefinition = {
    version: 1,
    steps: [
      { id: 'services', name: '读取服务列表', type: 'services' },
      { id: 'alerts', name: '读取当前告警', type: 'alerts' },
      {
        id: 'analysis',
        name: '生成健康诊断',
        type: 'agent',
        prompt: '根据前序步骤获得的服务与告警数据，给出系统健康结论、关键证据和下一步行动。',
      },
    ],
  };
  await db.execute({
    sql: `INSERT OR IGNORE INTO scry_workflows
      (id, name, description, definition_json, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)`,
    args: [
      'system-health-diagnosis',
      '系统健康诊断',
      '读取服务和告警信息，再由 Agent 生成诊断结论。',
      JSON.stringify(defaultWorkflow),
      now,
      now,
    ],
  });

  const securityWorkflow: WorkflowDefinition = {
    version: 2,
    steps: [
      { id: 'security', name: '安全意图与注入检查', type: 'security-check' },
      {
        id: 'approval_gate',
        name: '高风险审批分支',
        type: 'condition',
        condition: {
          rule: { path: 'results.security.decision', operator: 'equals', value: 'require-approval' },
          whenTrue: [{ id: 'approval', name: '人工审批', type: 'approval', approvalMessage: '安全决策判定本次请求会改变系统状态，请确认后继续。' }],
          whenFalse: [{ id: 'read_plan', name: '只读诊断计划', type: 'agent', prompt: '根据请求生成只读诊断计划，不执行任何变更。' }],
        },
      },
      { id: 'operation', name: '受控执行', type: 'operation', prompt: '仅使用已授权工具执行请求；工具审批与底层安全复检不可绕过。' },
      { id: 'verify', name: '结果验证', type: 'verify', prompt: '核验执行结果、目标状态和残余风险，并给出可审计结论。' },
    ],
  };
  await db.execute({
    sql: `INSERT OR IGNORE INTO scry_workflows
      (id, name, description, definition_json, enabled, tags_json, schedule_json, event_triggers_json,
       input_schema_json, version, versions_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, '{}', '[]', '[]', 1, '[]', ?, ?)`,
    args: ['system-security-decision', '安全决策 Loop', '系统锁定的输入检测、风险分类、审批、受控执行与结果验证流程。',
      JSON.stringify(securityWorkflow), JSON.stringify(['system', 'locked', 'security']), now, now],
  });

  for (const preset of workflowPresets()) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO scry_workflows
        (id, name, description, definition_json, enabled, tags_json, schedule_json, event_triggers_json,
         input_schema_json, version, versions_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, '{}', '[]', '[]', 1, '[]', ?, ?)`,
      args: [preset.id, preset.name, preset.description, JSON.stringify(preset.definition), JSON.stringify(preset.tags), now, now],
    });
  }
}

function mcpServerFromRow(row: Record<string, unknown>, includeSecrets: boolean): MCPServerRecord {
  const encrypted = String(row.headers_encrypted || '');
  let headers: Record<string, string> = {};
  if (includeSecrets && encrypted) {
    try {
      headers = JSON.parse(decryptSecret(encrypted, config.masterKey)) as Record<string, string>;
    } catch {
      headers = {};
    }
  }
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    description: String(row.description || ''),
    url: String(row.url),
    enabled: Boolean(Number(row.enabled)),
    headers,
    hasHeaders: Boolean(encrypted),
    timeoutMs: Number(row.timeout_ms || 30_000),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function listMCPServers(
  orgId: string,
  enabledOnly = false,
  includeSecrets = false,
): Promise<MCPServerRecord[]> {
  const result = await db.execute({
    sql: `SELECT * FROM scry_mcp_servers WHERE org_id = ? ${enabledOnly ? 'AND enabled = 1' : ''}
      ORDER BY updated_at DESC`,
    args: [orgId],
  });
  return result.rows.map((row) => mcpServerFromRow(row, includeSecrets));
}

export async function getMCPServer(
  id: string,
  orgId: string,
  includeSecrets = false,
): Promise<MCPServerRecord | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM scry_mcp_servers WHERE id = ? AND org_id = ?',
    args: [id, orgId],
  });
  return result.rows[0] ? mcpServerFromRow(result.rows[0], includeSecrets) : null;
}

export async function createMCPServerRecord(input: {
  orgId: string;
  name: string;
  description?: string;
  url: string;
  enabled?: boolean;
  headers?: Record<string, string>;
  timeoutMs: number;
}): Promise<MCPServerRecord> {
  const id = randomUUID();
  const now = Date.now();
  const headers = input.headers && Object.keys(input.headers).length
    ? encryptSecret(JSON.stringify(input.headers), config.masterKey)
    : '';
  await db.execute({
    sql: `INSERT INTO scry_mcp_servers
      (id, org_id, name, description, url, enabled, headers_encrypted, timeout_ms, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.orgId, input.name, input.description || '', input.url, input.enabled === false ? 0 : 1,
      headers, input.timeoutMs, now, now],
  });
  return (await getMCPServer(id, input.orgId)) as MCPServerRecord;
}

export async function updateMCPServerRecord(id: string, orgId: string, input: {
  name: string;
  description?: string;
  url: string;
  enabled: boolean;
  headers?: Record<string, string>;
  timeoutMs: number;
}): Promise<MCPServerRecord | null> {
  const current = await getMCPServer(id, orgId, true);
  if (!current) return null;
  const existing = (await db.execute({
    sql: 'SELECT headers_encrypted FROM scry_mcp_servers WHERE id = ? AND org_id = ?',
    args: [id, orgId],
  })).rows[0];
  const headers = input.headers === undefined
    ? String(existing?.headers_encrypted || '')
    : Object.keys(input.headers).length
      ? encryptSecret(JSON.stringify(input.headers), config.masterKey)
      : '';
  await db.execute({
    sql: `UPDATE scry_mcp_servers SET name = ?, description = ?, url = ?, enabled = ?,
      headers_encrypted = ?, timeout_ms = ?, updated_at = ? WHERE id = ? AND org_id = ?`,
    args: [input.name, input.description || '', input.url, input.enabled ? 1 : 0, headers,
      input.timeoutMs, Date.now(), id, orgId],
  });
  return getMCPServer(id, orgId);
}

export async function deleteMCPServerRecord(id: string, orgId: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM scry_mcp_servers WHERE id = ? AND org_id = ?', args: [id, orgId] });
}

export async function getModelSettings(includeSecret = false): Promise<ModelSettings> {
  const result = await db.execute("SELECT * FROM scry_model_settings WHERE id = 'default'");
  const row = result.rows[0];
  const encrypted = String(row?.api_key_encrypted || '');
  return {
    provider: String(row?.provider || 'openai') as ModelProvider,
    endpointMode: String(row?.endpoint_mode || 'official') as ModelEndpointMode,
    model: String(row?.model || 'gpt-4o-mini'),
    baseUrl: String(row?.base_url || ''),
    apiKey: includeSecret && encrypted ? decryptSecret(encrypted, config.masterKey) : '',
    hasApiKey: Boolean(encrypted),
    temperature: row?.temperature === null || row?.temperature === undefined ? null : Number(row.temperature),
    maxOutputTokens: Number(row?.max_output_tokens || 8192),
    maxSteps: Number(row?.max_steps || 8),
    timeoutSeconds: Number(row?.timeout_seconds || 120),
    maxRetries: Number(row?.max_retries ?? 1),
    toolChoice: String(row?.tool_choice || 'auto') as AgentToolChoice,
    instructions: String(row?.instructions || ''),
    memoryLastMessages: Number(row?.memory_last_messages || 30),
  };
}

export async function updateModelSettings(input: {
  provider: ModelProvider;
  endpointMode: ModelEndpointMode;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number | null;
  maxOutputTokens: number;
  maxSteps: number;
  timeoutSeconds: number;
  maxRetries: number;
  toolChoice: AgentToolChoice;
  instructions?: string;
  memoryLastMessages: number;
}): Promise<ModelSettings> {
  const current = await getModelSettings(false);
  const encrypted = input.apiKey
    ? encryptSecret(input.apiKey, config.masterKey)
    : current.hasApiKey
      ? String((await db.execute("SELECT api_key_encrypted FROM scry_model_settings WHERE id = 'default'")).rows[0]?.api_key_encrypted || '')
      : '';
  await db.execute({
    sql: `UPDATE scry_model_settings
      SET provider = ?, endpoint_mode = ?, model = ?, base_url = ?, api_key_encrypted = ?,
        temperature = ?, max_output_tokens = ?, max_steps = ?, timeout_seconds = ?,
        max_retries = ?, tool_choice = ?, instructions = ?, memory_last_messages = ?, updated_at = ?
      WHERE id = 'default'`,
    args: [
      input.provider,
      input.endpointMode,
      input.model,
      input.baseUrl || '',
      encrypted,
      input.temperature ?? null,
      input.maxOutputTokens,
      input.maxSteps,
      input.timeoutSeconds,
      input.maxRetries,
      input.toolChoice,
      input.instructions || '',
      input.memoryLastMessages,
      Date.now(),
    ],
  });
  return getModelSettings(false);
}

export async function createThread(userId: string, orgId: string, title = '新对话'): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO scry_agent_threads (id, user_id, org_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, userId, orgId, title, now, now],
  });
  return id;
}

export async function upsertUIMessage(threadId: string, message: Record<string, unknown>): Promise<void> {
  const id = String(message.id || randomUUID());
  const role = String(message.role || 'assistant');
  const now = Date.now();
  await db.batch([
    {
      sql: `INSERT INTO scry_agent_ui_messages (id, thread_id, role, message_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET message_json = excluded.message_json, role = excluded.role, updated_at = excluded.updated_at`,
      args: [id, threadId, role, JSON.stringify({ ...message, id }), now, now],
    },
    { sql: 'UPDATE scry_agent_threads SET updated_at = ? WHERE id = ?', args: [now, threadId] },
  ]);
}

export async function getThreadUIMessages(threadId: string): Promise<Record<string, unknown>[]> {
  const result = await db.execute({
    sql: 'SELECT message_json FROM scry_agent_ui_messages WHERE thread_id = ? ORDER BY created_at, id',
    args: [threadId],
  });
  return result.rows.map((row) => JSON.parse(String(row.message_json)) as Record<string, unknown>);
}

export async function updateThreadTitleFromMessage(threadId: string, content: string): Promise<void> {
  const result = await db.execute({
    sql: 'SELECT title FROM scry_agent_threads WHERE id = ?',
    args: [threadId],
  });
  if (String(result.rows[0]?.title || '') !== '新对话') return;
  const title = content.replace(/\s+/g, ' ').trim().slice(0, 28) || '新对话';
  await db.execute({
    sql: 'UPDATE scry_agent_threads SET title = ?, updated_at = ? WHERE id = ?',
    args: [title, Date.now(), threadId],
  });
}

function workflowFromRow(row: Record<string, unknown>): WorkflowRecord {
  const parse = <T>(value: unknown, fallback: T): T => {
    try { return JSON.parse(String(value ?? '')) as T; } catch { return fallback; }
  };
  const schedule = parse<Partial<WorkflowScheduleConfig>>(row.schedule_json, {});
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description || ''),
    enabled: Boolean(Number(row.enabled)),
    definition: JSON.parse(String(row.definition_json)) as WorkflowDefinition,
    tags: parse<string[]>(row.tags_json, []),
    schedule: {
      enabled: Boolean(schedule.enabled),
      cron: String(schedule.cron || ''),
      timezone: String(schedule.timezone || 'Asia/Shanghai'),
    },
    eventTriggers: parse<WorkflowEventTrigger[]>(row.event_triggers_json, []),
    inputSchema: parse<WorkflowInputField[]>(row.input_schema_json, []),
    version: Number(row.version || 1),
    versions: parse<WorkflowVersionRecord[]>(row.versions_json, []),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function listWorkflows(enabledOnly = false): Promise<WorkflowRecord[]> {
  const result = await db.execute(
    `SELECT * FROM scry_workflows ${enabledOnly ? 'WHERE enabled = 1' : ''} ORDER BY updated_at DESC`,
  );
  return result.rows.map((row) => workflowFromRow(row));
}

export async function getWorkflow(id: string): Promise<WorkflowRecord | null> {
  const result = await db.execute({ sql: 'SELECT * FROM scry_workflows WHERE id = ?', args: [id] });
  return result.rows[0] ? workflowFromRow(result.rows[0]) : null;
}

export async function createWorkflowRecord(input: {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  enabled?: boolean;
  tags?: string[];
  schedule?: WorkflowScheduleConfig;
  eventTriggers?: WorkflowEventTrigger[];
  inputSchema?: WorkflowInputField[];
}): Promise<WorkflowRecord> {
  const id = randomUUID();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO scry_workflows
      (id, name, description, definition_json, enabled, tags_json, schedule_json, event_triggers_json,
       input_schema_json, version, versions_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '[]', ?, ?)`,
    args: [id, input.name, input.description || '', JSON.stringify(input.definition), input.enabled === false ? 0 : 1,
      JSON.stringify(input.tags || []), JSON.stringify(input.schedule || { enabled: false, cron: '', timezone: 'Asia/Shanghai' }),
      JSON.stringify(input.eventTriggers || []), JSON.stringify(input.inputSchema || []), now, now],
  });
  return (await getWorkflow(id)) as WorkflowRecord;
}

export async function updateWorkflowRecord(id: string, input: {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  enabled: boolean;
  tags?: string[];
  schedule?: WorkflowScheduleConfig;
  eventTriggers?: WorkflowEventTrigger[];
  inputSchema?: WorkflowInputField[];
}): Promise<WorkflowRecord | null> {
  const current = await getWorkflow(id);
  if (!current) return null;
  const definitionChanged = JSON.stringify(current.definition) !== JSON.stringify(input.definition);
  const versions = definitionChanged
    ? [
        ...current.versions,
        { version: current.version, name: current.name, definition: current.definition, createdAt: current.updatedAt },
      ].slice(-30)
    : current.versions;
  await db.execute({
    sql: `UPDATE scry_workflows
      SET name = ?, description = ?, definition_json = ?, enabled = ?, tags_json = ?, schedule_json = ?,
      event_triggers_json = ?, input_schema_json = ?, version = ?, versions_json = ?, updated_at = ? WHERE id = ?`,
    args: [input.name, input.description || '', JSON.stringify(input.definition), input.enabled ? 1 : 0,
      JSON.stringify(input.tags || []), JSON.stringify(input.schedule || current.schedule), JSON.stringify(input.eventTriggers || []),
      JSON.stringify(input.inputSchema || []), definitionChanged ? current.version + 1 : current.version,
      JSON.stringify(versions), Date.now(), id],
  });
  return getWorkflow(id);
}

export async function deleteWorkflowRecord(id: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM scry_workflow_runs WHERE workflow_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM scry_workflows WHERE id = ?', args: [id] });
}

export async function createWorkflowRunRecord(input: {
  id: string;
  workflowId: string;
  threadId?: string;
  userId: string;
  input: unknown;
}): Promise<void> {
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO scry_workflow_runs
      (id, workflow_id, thread_id, user_id, status, input_json, output_json, step_state_json, suspended_step, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'running', ?, '{}', '{}', '', ?, ?)`,
    args: [input.id, input.workflowId, input.threadId || '', input.userId, JSON.stringify(input.input), now, now],
  });
}

export async function updateWorkflowRunRecord(id: string, patch: {
  status?: string;
  output?: unknown;
  stepId?: string;
  stepState?: unknown;
  suspendedStep?: string;
}): Promise<void> {
  const current = await db.execute({ sql: 'SELECT step_state_json FROM scry_workflow_runs WHERE id = ?', args: [id] });
  if (!current.rows.length) return;
  const stepState = JSON.parse(String(current.rows[0].step_state_json || '{}')) as Record<string, unknown>;
  if (patch.stepId) stepState[patch.stepId] = patch.stepState;
  await db.execute({
    sql: `UPDATE scry_workflow_runs SET status = COALESCE(?, status), output_json = COALESCE(?, output_json),
      step_state_json = ?, suspended_step = COALESCE(?, suspended_step), updated_at = ? WHERE id = ?`,
    args: [
      patch.status ?? null,
      patch.output === undefined ? null : JSON.stringify(patch.output),
      JSON.stringify(stepState),
      patch.suspendedStep ?? null,
      Date.now(),
      id,
    ],
  });
}

function workflowRunFromRow(row: Record<string, unknown>): WorkflowRunRecord {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    threadId: String(row.thread_id || ''),
    status: String(row.status),
    input: JSON.parse(String(row.input_json || '{}')),
    output: JSON.parse(String(row.output_json || '{}')),
    stepState: JSON.parse(String(row.step_state_json || '{}')) as Record<string, unknown>,
    suspendedStep: String(row.suspended_step || ''),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function listWorkflowRuns(workflowId: string, userId: string): Promise<WorkflowRunRecord[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM scry_workflow_runs WHERE workflow_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 100',
    args: [workflowId, userId],
  });
  return result.rows.map((row) => workflowRunFromRow(row));
}

export async function getWorkflowRun(id: string, userId: string): Promise<WorkflowRunRecord | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM scry_workflow_runs WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  return result.rows[0] ? workflowRunFromRow(result.rows[0]) : null;
}
