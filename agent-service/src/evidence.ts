import { createHash, randomUUID } from 'node:crypto';

import { db } from './db.js';
import { addSecurityAuditEvent } from './security/audit.js';
import { detectPromptInjection } from './security/prompt-injection-detector.js';
import { learnMemoryFromEvidence } from './memory/index.js';
import type {
  AuthenticatedUser,
  EvidenceActionRecord,
  EvidenceCaptureContext,
  EvidenceItem,
  EvidenceRelationRecord,
  EvidenceRelationType,
  EvidenceScoreFactors,
  EvidenceSourceType,
  EvidenceStatus,
} from './types.js';

const SECRET_KEY = /(?:authorization|api.?key|token|password|private.?key|passphrase|credential|secret)/i;
const SECRET_VALUE = /(?:bearer\s+[a-z0-9._~-]+|sk-[a-z0-9._-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/gi;
const MAX_CONTENT_BYTES = 160_000;

const SOURCE_RELIABILITY: Record<EvidenceSourceType, number> = {
  ssh: 96,
  telemetry: 92,
  alert: 88,
  service: 86,
  dashboard: 78,
  mcp: 72,
  workflow: 64,
  document: 68,
  url: 60,
};

const SOURCE_DIRECTNESS: Record<EvidenceSourceType, number> = {
  ssh: 100,
  telemetry: 96,
  alert: 88,
  service: 88,
  dashboard: 72,
  mcp: 74,
  workflow: 58,
  document: 64,
  url: 52,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function redactString(value: string): string {
  return value.replace(SECRET_VALUE, '[敏感信息已隐藏]');
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[内容层级过深]';
  if (typeof value === 'string') return redactString(value).slice(0, 80_000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 300).map((item) => sanitizeValue(item, depth + 1));
  if (!value || typeof value !== 'object') return String(value ?? '');
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 300)
      .map(([key, child]) => [key, SECRET_KEY.test(key) ? '[敏感信息已隐藏]' : sanitizeValue(child, depth + 1)]),
  );
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

function serializeContent(value: unknown): { content: unknown; json: string; truncated: boolean } {
  const sanitized = sanitizeValue(value);
  let json = JSON.stringify(stableValue(sanitized));
  if (Buffer.byteLength(json) <= MAX_CONTENT_BYTES) return { content: sanitized, json, truncated: false };
  const content = { truncated: true, preview: json.slice(0, MAX_CONTENT_BYTES) };
  json = JSON.stringify(content);
  return { content, json, truncated: true };
}

function evidenceTokens(value: string): Set<string> {
  const normalized = value.toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ').trim();
  const tokens = new Set(normalized.split(/\s+/).filter((token) => token.length > 1));
  for (const run of normalized.match(/[\u3400-\u9fff]{2,}/g) || []) {
    for (let index = 0; index < run.length - 1; index += 1) tokens.add(run.slice(index, index + 2));
  }
  return tokens;
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = evidenceTokens(left);
  const rightTokens = evidenceTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) overlap += 1;
  return overlap / new Set([...leftTokens, ...rightTokens]).size;
}

function dataQuality(value: unknown, truncated: boolean): number {
  if (truncated) return 68;
  if (value === null || value === undefined || value === '') return 30;
  if (Array.isArray(value)) return value.length ? 92 : 48;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length ? 90 : 48;
  return String(value).trim() ? 82 : 30;
}

function sourceCueMatch(query: string, sourceType: EvidenceSourceType, sourceName: string): number {
  const cues: Record<EvidenceSourceType, RegExp> = {
    telemetry: /指标|日志|链路|trace|metric|log|延迟|错误率|吞吐|i\/o|io/i,
    service: /服务|应用|service|进程|实例|健康/i,
    alert: /告警|异常|风险|alert|故障/i,
    dashboard: /仪表盘|趋势|视图|dashboard/i,
    ssh: /主机|系统|磁盘|内存|端口|进程|日志|配置|ssh|linux/i,
    mcp: /工具|插件|mcp|外部/i,
    workflow: /结论|分析|根因|验证|loop|流程/i,
    document: /附件|文档|文件|配置/i,
    url: /链接|网页|来源|url/i,
  };
  if (cues[sourceType].test(query)) return 100;
  return tokenSimilarity(query, sourceName) > 0 ? 62 : 38;
}

export function calculateEvidenceScores(input: {
  query: string;
  sourceType: EvidenceSourceType;
  sourceName: string;
  title: string;
  summary: string;
  content: unknown;
  truncated?: boolean;
  completed?: boolean;
}): { confidence: number; relevance: number; factors: EvidenceScoreFactors } {
  const serialized = JSON.stringify(input.content).slice(0, 20_000);
  const lexicalMatch = clampScore(tokenSimilarity(input.query, `${input.title} ${input.summary} ${serialized}`) * 100);
  const factors: EvidenceScoreFactors = {
    sourceReliability: SOURCE_RELIABILITY[input.sourceType],
    dataQuality: dataQuality(input.content, Boolean(input.truncated)),
    freshness: 100,
    executionIntegrity: input.completed === false ? 45 : 100,
    directness: SOURCE_DIRECTNESS[input.sourceType],
    lexicalMatch,
  };
  const confidence = clampScore(
    factors.sourceReliability * 0.34
      + factors.dataQuality * 0.24
      + factors.freshness * 0.12
      + factors.executionIntegrity * 0.18
      + factors.directness * 0.12,
  );
  const relevance = clampScore(lexicalMatch * 0.62 + sourceCueMatch(input.query, input.sourceType, input.sourceName) * 0.38);
  return { confidence, relevance, factors };
}

function summaryFor(value: unknown): string {
  if (Array.isArray(value)) return value.length ? `返回 ${value.length} 项结构化记录。` : '查询成功，但未返回记录。';
  if (typeof value === 'string') return redactString(value).replace(/\s+/g, ' ').trim().slice(0, 180) || '返回空文本。';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const data = record.data;
    if (Array.isArray(data)) return data.length ? `返回 ${data.length} 项结构化记录。` : '查询成功，但数据集合为空。';
    const keys = Object.keys(record).filter((key) => key !== 'a2ui').slice(0, 6);
    return keys.length ? `返回结构化字段：${keys.join('、')}。` : '返回结构化空对象。';
  }
  return `返回值：${String(value ?? '空')}`.slice(0, 180);
}

function sourceTypeForTool(toolName: string): EvidenceSourceType {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('ssh')) return 'ssh';
  if (normalized.includes('query-signals') || normalized.includes('querysignals')) return 'telemetry';
  if (normalized.includes('list-services') || normalized.includes('listservices')) return 'service';
  if (normalized.includes('list-alerts') || normalized.includes('listalerts')) return 'alert';
  if (normalized.includes('list-dashboards') || normalized.includes('listdashboards')) return 'dashboard';
  return 'mcp';
}

function canonicalToolName(toolName: string): string {
  const withoutServer = toolName.replace(/^scry[_-]/i, '');
  const aliases: Record<string, string> = {
    listServices: 'list-services',
    listAlerts: 'list-alerts',
    listDashboards: 'list-dashboards',
    querySignals: 'query-signals',
    sshReadonlyInspect: 'ssh-readonly-inspect',
    sshExecuteCommand: 'ssh-execute-command',
    listEvidence: 'list-evidence',
    getEvidenceChain: 'get-evidence-chain',
  };
  return aliases[withoutServer] || withoutServer;
}

function toolTitle(toolName: string): string {
  const labels: Record<string, string> = {
    'list-services': '服务状态证据',
    listServices: '服务状态证据',
    'list-alerts': '告警证据',
    listAlerts: '告警证据',
    'list-dashboards': '仪表盘证据',
    listDashboards: '仪表盘证据',
    'query-signals': '可观测信号证据',
    querySignals: '可观测信号证据',
    'ssh-readonly-inspect': '主机只读巡检证据',
    sshReadonlyInspect: '主机只读巡检证据',
    'ssh-execute-command': '受控操作结果证据',
    sshExecuteCommand: '受控操作结果证据',
  };
  return labels[toolName] || `工具证据 · ${toolName}`;
}

function evidenceFromRow(row: Record<string, unknown>): EvidenceItem {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    orgId: String(row.org_id),
    userId: String(row.user_id),
    traceId: String(row.trace_id),
    messageId: String(row.message_id || ''),
    sourceType: String(row.source_type) as EvidenceSourceType,
    sourceName: String(row.source_name),
    title: String(row.title),
    summary: String(row.summary),
    content: JSON.parse(String(row.content_json || 'null')),
    contentHash: String(row.content_hash),
    confidence: Number(row.confidence),
    relevance: Number(row.relevance),
    scoreFactors: JSON.parse(String(row.score_factors_json || '{}')) as EvidenceScoreFactors,
    status: String(row.status) as EvidenceStatus,
    selected: Boolean(Number(row.selected)),
    note: String(row.note || ''),
    capturedAt: Number(row.captured_at),
    updatedAt: Number(row.updated_at),
    relations: [],
    actions: [],
  };
}

async function hydrateEvidence(items: EvidenceItem[]): Promise<EvidenceItem[]> {
  if (!items.length) return items;
  const ids = new Set(items.map((item) => item.id));
  const threadId = items[0].threadId;
  const [relationRows, actionRows] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM scry_evidence_relations WHERE thread_id = ? ORDER BY created_at', args: [threadId] }),
    db.execute({ sql: 'SELECT * FROM scry_evidence_actions WHERE thread_id = ? ORDER BY created_at', args: [threadId] }),
  ]);
  const relations = relationRows.rows.map((row): EvidenceRelationRecord => ({
    id: String(row.id),
    fromEvidenceId: String(row.from_evidence_id),
    toEvidenceId: String(row.to_evidence_id),
    type: String(row.relation_type) as EvidenceRelationType,
    score: Number(row.score),
    rationale: String(row.rationale || ''),
    createdAt: Number(row.created_at),
  }));
  const actions = actionRows.rows.map((row): EvidenceActionRecord => ({
    id: Number(row.id),
    evidenceId: String(row.evidence_id),
    userId: String(row.user_id),
    action: String(row.action),
    previousStatus: String(row.previous_status) as EvidenceStatus,
    nextStatus: String(row.next_status) as EvidenceStatus,
    note: String(row.note || ''),
    createdAt: Number(row.created_at),
  }));
  return items.map((item) => ({
    ...item,
    relations: relations.filter((relation) =>
      ids.has(relation.fromEvidenceId) && ids.has(relation.toEvidenceId)
      && (relation.fromEvidenceId === item.id || relation.toEvidenceId === item.id)),
    actions: actions.filter((action) => action.evidenceId === item.id),
  }));
}

async function createRelations(item: EvidenceItem): Promise<void> {
  const existing = await db.execute({
    sql: 'SELECT * FROM scry_evidence_items WHERE thread_id = ? AND id <> ? ORDER BY captured_at DESC LIMIT 200',
    args: [item.threadId, item.id],
  });
  const itemText = `${item.title} ${item.summary} ${JSON.stringify(item.content).slice(0, 10_000)}`;
  for (const row of existing.rows) {
    const other = evidenceFromRow(row);
    const sameTrace = other.traceId === item.traceId;
    const similarity = tokenSimilarity(itemText, `${other.title} ${other.summary} ${JSON.stringify(other.content).slice(0, 10_000)}`);
    let type: EvidenceRelationType | null = null;
    let score = 0;
    let rationale = '';
    if (item.sourceType === 'workflow' && sameTrace && other.sourceType !== 'workflow') {
      type = 'derived_from';
      score = 100;
      rationale = '该分析结果由同一执行链中的原始证据派生。';
    } else if (sameTrace) {
      type = 'same_trace';
      score = 100;
      rationale = '两项证据来自同一次诊断或执行链。';
    } else if (similarity >= 0.34 && item.sourceType !== other.sourceType) {
      type = 'corroborates';
      score = clampScore(similarity * 100);
      rationale = '不同来源包含高度相似的实体或状态信息。';
    } else if (similarity >= 0.18) {
      type = 'related';
      score = clampScore(similarity * 100);
      rationale = '证据内容与当前证据存在可解释的语义重合。';
    }
    if (!type) continue;
    await db.execute({
      sql: `INSERT OR IGNORE INTO scry_evidence_relations
        (id, thread_id, from_evidence_id, to_evidence_id, relation_type, score, rationale, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), item.threadId, item.id, other.id, type, score, rationale, Date.now()],
    });
  }
}

export async function recordEvidence(input: {
  user: AuthenticatedUser;
  context: EvidenceCaptureContext;
  messageId?: string;
  sourceType: EvidenceSourceType;
  sourceName: string;
  title: string;
  summary?: string;
  content: unknown;
  completed?: boolean;
}): Promise<EvidenceItem | null> {
  if (!input.context.threadId) return null;
  const owned = await db.execute({
    sql: 'SELECT id FROM scry_agent_threads WHERE id = ? AND org_id = ?',
    args: [input.context.threadId, input.user.orgId],
  });
  if (!owned.rows.length) return null;
  const serialized = serializeContent(input.content);
  const summary = input.summary || summaryFor(serialized.content);
  const scores = calculateEvidenceScores({
    query: input.context.query,
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    title: input.title,
    summary,
    content: serialized.content,
    truncated: serialized.truncated,
    completed: input.completed,
  });
  const injection = detectPromptInjection(serialized.json);
  const initialStatus: EvidenceStatus = injection.detected ? 'suspended' : 'active';
  const selected = !injection.detected;
  const note = injection.detected
    ? `系统自动挂起：检测到潜在证据注入（${injection.findings.map((finding) => finding.description).join('；')}）。`
    : '';
  const confidence = injection.detected ? Math.min(scores.confidence, 35) : scores.confidence;
  const contentHash = createHash('sha256').update(serialized.json).digest('hex');
  const id = randomUUID();
  const now = Date.now();
  const result = await db.execute({
    sql: `INSERT OR IGNORE INTO scry_evidence_items
      (id, thread_id, org_id, user_id, trace_id, message_id, source_type, source_name, title, summary,
      content_json, content_hash, confidence, relevance, score_factors_json, status, selected, note, captured_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.context.threadId, input.user.orgId, input.user.id, input.context.traceId,
      input.messageId || '', input.sourceType, input.sourceName, input.title, summary, serialized.json, contentHash,
      confidence, scores.relevance, JSON.stringify(scores.factors), initialStatus, selected ? 1 : 0, note, now, now],
  });
  const created = result.rowsAffected > 0;
  const row = (await db.execute({
    sql: `SELECT * FROM scry_evidence_items
      WHERE thread_id = ? AND trace_id = ? AND source_name = ? AND content_hash = ?`,
    args: [input.context.threadId, input.context.traceId, input.sourceName, contentHash],
  })).rows[0];
  if (!row) return null;
  const item = evidenceFromRow(row);
  if (created) {
    await db.execute({
      sql: `INSERT INTO scry_evidence_actions
        (evidence_id, thread_id, user_id, action, previous_status, next_status, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [item.id, item.threadId, input.user.id, injection.detected ? 'auto_suspended' : 'captured',
        initialStatus, initialStatus, note, now],
    });
    if (injection.detected) {
      await addSecurityAuditEvent({
        traceId: item.traceId,
        orgId: input.user.orgId,
        userId: input.user.id,
        eventType: 'evidence.auto_suspended',
        source: 'evidence',
        target: item.id,
        decision: 'deny',
        riskScore: injection.score,
        inputHash: item.contentHash,
        details: { findings: injection.findings, sourceType: item.sourceType, sourceName: item.sourceName },
      });
    }
    await createRelations(item);
  }
  return (await hydrateEvidence([item]))[0];
}

export async function listEvidence(threadId: string, orgId: string): Promise<EvidenceItem[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM scry_evidence_items WHERE thread_id = ? AND org_id = ? ORDER BY captured_at DESC',
    args: [threadId, orgId],
  });
  return hydrateEvidence(result.rows.map(evidenceFromRow));
}

export async function getEvidenceByIds(threadId: string, orgId: string, ids: string[]): Promise<EvidenceItem[]> {
  if (!ids.length) return [];
  const evidence = await listEvidence(threadId, orgId);
  const requested = new Set(ids);
  return evidence.filter((item) => requested.has(item.id));
}

export async function updateEvidence(input: {
  evidenceId: string;
  user: AuthenticatedUser;
  status?: EvidenceStatus;
  selected?: boolean;
  note?: string;
}): Promise<EvidenceItem | null> {
  const row = (await db.execute({
    sql: 'SELECT * FROM scry_evidence_items WHERE id = ? AND org_id = ?',
    args: [input.evidenceId, input.user.orgId],
  })).rows[0];
  if (!row) return null;
  const current = evidenceFromRow(row);
  const nextStatus = input.status || current.status;
  const selected = nextStatus === 'rejected' || nextStatus === 'suspended'
    ? false
    : input.selected ?? current.selected;
  const note = input.note === undefined ? current.note : input.note.trim().slice(0, 4000);
  const actions: string[] = [];
  if (input.status && input.status !== current.status) actions.push(input.status === 'active' ? 'restored' : input.status);
  if (input.selected !== undefined && selected !== current.selected) actions.push(selected ? 'selected' : 'unselected');
  if (input.note !== undefined && note !== current.note) actions.push('noted');
  await db.execute({
    sql: 'UPDATE scry_evidence_items SET status = ?, selected = ?, note = ?, updated_at = ? WHERE id = ?',
    args: [nextStatus, selected ? 1 : 0, note, Date.now(), current.id],
  });
  for (const action of actions.length ? actions : ['updated']) {
    await db.execute({
      sql: `INSERT INTO scry_evidence_actions
        (evidence_id, thread_id, user_id, action, previous_status, next_status, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [current.id, current.threadId, input.user.id, action, current.status, nextStatus,
        action === 'noted' ? note : '', Date.now()],
    });
    await addSecurityAuditEvent({
      traceId: current.traceId,
      orgId: input.user.orgId,
      userId: input.user.id,
      eventType: `evidence.${action}`,
      source: 'evidence',
      target: current.id,
      inputHash: current.contentHash,
      details: { threadId: current.threadId, previousStatus: current.status, nextStatus, selected },
    });
  }
  const updated = (await getEvidenceByIds(current.threadId, input.user.orgId, [current.id]))[0] || null;
  if (updated && current.status !== 'accepted' && updated.status === 'accepted') {
    await learnMemoryFromEvidence(updated, input.user).catch((error) =>
      console.error('Failed to learn memory from accepted evidence:', error));
  }
  return updated;
}

export async function recordEvidenceRevision(input: {
  user: AuthenticatedUser;
  threadId: string;
  assistantMessageId: string;
  selectedIds: string[];
  excludedIds: string[];
  instruction: string;
}): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO scry_evidence_revisions
      (id, thread_id, org_id, user_id, assistant_message_id, selected_ids_json, excluded_ids_json, instruction, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.threadId, input.user.orgId, input.user.id, input.assistantMessageId,
      JSON.stringify(input.selectedIds), JSON.stringify(input.excludedIds), input.instruction, now],
  });
  for (const evidenceId of input.selectedIds) {
    await db.execute({
      sql: `INSERT INTO scry_evidence_actions
        (evidence_id, thread_id, user_id, action, previous_status, next_status, note, created_at)
        SELECT id, thread_id, ?, 'used_for_revision', status, status, ?, ? FROM scry_evidence_items WHERE id = ?`,
      args: [input.user.id, input.instruction, now, evidenceId],
    });
  }
  return id;
}

const NON_EVIDENCE_TOOLS = new Set([
  'publish-plan', 'publishPlan', 'evaluate-security-intent', 'evaluateSecurityIntent',
  'list-evidence', 'listEvidence', 'get-evidence-chain', 'getEvidenceChain',
  'search-memory', 'searchMemory', 'remember', 'inspect-memory', 'inspectMemory',
  'maintain-memory', 'maintainMemory', 'forget-memory', 'forgetMemory',
]);
const DIRECT_CAPTURE_TOOLS = new Set([
  'list-services', 'list-alerts', 'list-dashboards', 'query-signals',
  'ssh-readonly-inspect', 'ssh-execute-command',
]);

export async function ingestEvidenceFromUIMessage(input: {
  user: AuthenticatedUser;
  context: EvidenceCaptureContext;
  message: Record<string, unknown>;
  captureBuiltInTools?: boolean;
}): Promise<void> {
  const messageId = String(input.message.id || '');
  const parts = Array.isArray(input.message.parts) ? input.message.parts : [];
  for (const value of parts) {
    if (!value || typeof value !== 'object') continue;
    const part = value as Record<string, unknown>;
    const type = String(part.type || '');
    if (type === 'source-url') {
      await recordEvidence({ user: input.user, context: input.context, messageId, sourceType: 'url',
        sourceName: String(part.url || 'url'), title: String(part.title || part.url || '网页来源'), content: part });
      continue;
    }
    if (type === 'source-document') {
      await recordEvidence({ user: input.user, context: input.context, messageId, sourceType: 'document',
        sourceName: String(part.filename || part.title || 'document'), title: String(part.title || part.filename || '文档来源'), content: part });
      continue;
    }
    if (type.startsWith('tool-') || type === 'dynamic-tool') {
      const toolName = canonicalToolName(String(part.toolName || (type.startsWith('tool-') ? type.slice(5) : 'external-tool')));
      if (NON_EVIDENCE_TOOLS.has(toolName)
        || (!input.captureBuiltInTools && DIRECT_CAPTURE_TOOLS.has(toolName))
        || part.output === undefined) continue;
      const output = part.output && typeof part.output === 'object'
        && 'data' in (part.output as Record<string, unknown>)
        ? (part.output as Record<string, unknown>).data
        : part.output;
      await recordEvidence({
        user: input.user,
        context: input.context,
        messageId,
        sourceType: sourceTypeForTool(toolName),
        sourceName: toolName,
        title: toolTitle(toolName),
        content: output,
        completed: String(part.state || '') !== 'output-error',
      });
      continue;
    }
    if (type === 'data-scry-workflow-step') {
      const data = part.data && typeof part.data === 'object' ? part.data as Record<string, unknown> : {};
      if (data.status !== 'completed' || data.detail === undefined
        || !['agent', 'verify', 'operation'].includes(String(data.stepType || ''))) continue;
      await recordEvidence({
        user: input.user,
        context: input.context,
        messageId,
        sourceType: 'workflow',
        sourceName: `workflow:${String(data.stepId || 'step')}`,
        title: String(data.title || 'Loop 分析证据'),
        content: data.detail,
      });
    }
  }
}
