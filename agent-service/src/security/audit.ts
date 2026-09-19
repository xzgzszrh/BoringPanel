import { db } from '../db.js';
import type { SecurityAuditEvent, SecurityDecision } from './types.js';

export async function addSecurityAuditEvent(input: {
  traceId: string;
  orgId: string;
  userId: string;
  eventType: string;
  source: string;
  target?: string;
  decision?: SecurityDecision | '';
  riskScore?: number;
  inputHash?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO scry_security_audit_events
      (trace_id, org_id, user_id, event_type, source, target, decision, risk_score, input_hash, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [input.traceId, input.orgId, input.userId, input.eventType, input.source, input.target || '',
      input.decision || '', input.riskScore || 0, input.inputHash || '', JSON.stringify(input.details || {}), Date.now()],
  });
}

export async function listSecurityAuditEvents(orgId: string, limit = 100): Promise<SecurityAuditEvent[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM scry_security_audit_events WHERE org_id = ? ORDER BY id DESC LIMIT ?',
    args: [orgId, Math.min(Math.max(limit, 1), 500)],
  });
  return result.rows.map((row) => ({
    id: Number(row.id), traceId: String(row.trace_id), orgId: String(row.org_id), userId: String(row.user_id),
    eventType: String(row.event_type), source: String(row.source), target: String(row.target),
    decision: String(row.decision) as SecurityAuditEvent['decision'], riskScore: Number(row.risk_score),
    inputHash: String(row.input_hash), details: JSON.parse(String(row.details_json || '{}')) as Record<string, unknown>,
    createdAt: Number(row.created_at),
  }));
}
