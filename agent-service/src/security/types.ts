import type { AgentMode, AuthenticatedUser } from '../types.js';

export type SecurityDecision = 'allow' | 'require-approval' | 'deny';
export type SecurityIntent = 'observe' | 'diagnose' | 'change' | 'privilege-escalation' | 'secret-access' | 'unknown';

export interface PromptInjectionFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
}

export interface PromptInjectionResult {
  detected: boolean;
  score: number;
  normalizedText: string;
  findings: PromptInjectionFinding[];
}

export interface IntentClassification {
  intent: SecurityIntent;
  confidence: number;
  requestedChange: boolean;
  reasons: string[];
}

export interface CommandRiskResult {
  decision: SecurityDecision;
  riskScore: number;
  executable: string;
  tokens: string[];
  reasons: string[];
}

export interface SecurityDecisionResult {
  traceId: string;
  decision: SecurityDecision;
  riskScore: number;
  intent: SecurityIntent;
  reasons: string[];
  inputHash: string;
}

export interface InputSecurityContext {
  user: AuthenticatedUser;
  text: string;
  mode: AgentMode;
  source: 'chat' | 'workflow' | 'mcp';
  threadId?: string;
  traceId?: string;
}

export interface SecurityAuditEvent {
  id: number;
  traceId: string;
  orgId: string;
  userId: string;
  eventType: string;
  source: string;
  target: string;
  decision: SecurityDecision | '';
  riskScore: number;
  inputHash: string;
  details: Record<string, unknown>;
  createdAt: number;
}
