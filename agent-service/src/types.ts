export type ModelProvider = "openai" | "anthropic";
export type ModelEndpointMode = "official" | "custom";
export type AgentToolChoice = "auto" | "none" | "required";
export type AgentMode = "diagnose" | "plan" | "operate";
export type EvidenceStatus = "active" | "accepted" | "rejected" | "suspended";
export type EvidenceSourceType =
  | "telemetry"
  | "service"
  | "alert"
  | "dashboard"
  | "ssh"
  | "mcp"
  | "workflow"
  | "document"
  | "url";
export type EvidenceRelationType =
  | "same_trace"
  | "related"
  | "corroborates"
  | "derived_from";
export type MemoryType = "working" | "episodic" | "semantic" | "procedural";
export type MemoryScope =
  | "organization"
  | "user"
  | "agent"
  | "thread"
  | "workflow";
export type MemoryStatus =
  | "active"
  | "verified"
  | "suspended"
  | "archived"
  | "forgotten";
export type MemorySourceType =
  | "evidence"
  | "message"
  | "workflow"
  | "manual"
  | "memory"
  | "document";
export type MemoryRelationType =
  | "supports"
  | "conflicts"
  | "duplicates"
  | "derived_from"
  | "same_service";
export type MemoryRetrievalStrategy =
  | "topomem"
  | "topomem-mp"
  | "lexical-fallback";
export type SSHAuthType = "password" | "private_key";
export type WorkflowStepType =
  | "agent"
  | "services"
  | "alerts"
  | "dashboards"
  | "mcp-tool"
  | "security-check"
  | "operation"
  | "verify"
  | "approval"
  | "condition"
  | "parallel"
  | "loop";

export type WorkflowConditionOperator =
  | "exists"
  | "equals"
  | "not_equals"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface WorkflowConditionRule {
  path: string;
  operator: WorkflowConditionOperator;
  value?: string;
}

export interface WorkflowBranchDefinition {
  id: string;
  name: string;
  steps: WorkflowStepDefinition[];
}

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  type: WorkflowStepType;
  prompt?: string;
  approvalMessage?: string;
  toolId?: string;
  toolInput?: Record<string, unknown>;
  retries?: number;
  condition?: {
    rule: WorkflowConditionRule;
    whenTrue: WorkflowStepDefinition[];
    whenFalse: WorkflowStepDefinition[];
  };
  parallel?: {
    branches: WorkflowBranchDefinition[];
  };
  loop?: {
    mode: "while" | "until" | "foreach";
    rule: WorkflowConditionRule;
    maxIterations: number;
    sourcePath?: string;
    concurrency?: number;
    steps: WorkflowStepDefinition[];
  };
}

export interface WorkflowDefinition {
  version: 1 | 2;
  steps: WorkflowStepDefinition[];
}

export interface WorkflowScheduleConfig {
  enabled: boolean;
  cron: string;
  timezone: string;
}

export interface WorkflowEventTrigger {
  id: string;
  eventType: string;
  filter: string;
  enabled: boolean;
}

export interface WorkflowInputField {
  id: string;
  label: string;
  type: "text" | "number" | "boolean" | "json";
  required: boolean;
  description?: string;
  defaultValue?: string;
}

export interface WorkflowVersionRecord {
  version: number;
  name: string;
  definition: WorkflowDefinition;
  createdAt: number;
}

export interface WorkflowRecord {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  definition: WorkflowDefinition;
  tags: string[];
  schedule: WorkflowScheduleConfig;
  eventTriggers: WorkflowEventTrigger[];
  inputSchema: WorkflowInputField[];
  version: number;
  versions: WorkflowVersionRecord[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  threadId: string;
  status: string;
  input: unknown;
  output: unknown;
  stepState: Record<string, unknown>;
  suspendedStep: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuthenticatedUser {
  id: string;
  orgId: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "VIEWER";
  token: string;
}

export interface EvidenceCaptureContext {
  threadId: string;
  traceId: string;
  query: string;
}

export interface EvidenceScoreFactors {
  sourceReliability: number;
  dataQuality: number;
  freshness: number;
  executionIntegrity: number;
  directness: number;
  lexicalMatch: number;
}

export interface EvidenceRelationRecord {
  id: string;
  fromEvidenceId: string;
  toEvidenceId: string;
  type: EvidenceRelationType;
  score: number;
  rationale: string;
  createdAt: number;
}

export interface EvidenceActionRecord {
  id: number;
  evidenceId: string;
  userId: string;
  action: string;
  previousStatus: EvidenceStatus;
  nextStatus: EvidenceStatus;
  note: string;
  createdAt: number;
}

export interface EvidenceItem {
  id: string;
  threadId: string;
  orgId: string;
  userId: string;
  traceId: string;
  messageId: string;
  sourceType: EvidenceSourceType;
  sourceName: string;
  title: string;
  summary: string;
  content: unknown;
  contentHash: string;
  confidence: number;
  relevance: number;
  scoreFactors: EvidenceScoreFactors;
  status: EvidenceStatus;
  selected: boolean;
  note: string;
  capturedAt: number;
  updatedAt: number;
  relations: EvidenceRelationRecord[];
  actions: EvidenceActionRecord[];
}

export interface MemorySourceRecord {
  id: number;
  memoryId: string;
  sourceType: MemorySourceType;
  sourceId: string;
  traceId: string;
  relation: string;
  weight: number;
  createdAt: number;
}

export interface MemoryRelationRecord {
  id: string;
  fromMemoryId: string;
  toMemoryId: string;
  type: MemoryRelationType;
  score: number;
  rationale: string;
  createdAt: number;
}

export interface MemoryActionRecord {
  id: number;
  memoryId: string;
  userId: string;
  action: string;
  previousStatus: MemoryStatus;
  nextStatus: MemoryStatus;
  detail: string;
  createdAt: number;
}

export interface MemoryChunkRecord {
  id: string;
  memoryId: string;
  index: number;
  type: "summary" | "observation" | "procedure" | "evidence" | "metadata";
  title: string;
  content: string;
  contentHash: string;
  tokenCount: number;
  keywords: string[];
  serviceName: string;
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryItem {
  id: string;
  orgId: string;
  userId: string;
  threadId: string;
  workflowId: string;
  agentId: string;
  type: MemoryType;
  scope: MemoryScope;
  serviceName: string;
  title: string;
  summary: string;
  content: unknown;
  contentHash: string;
  tags: string[];
  keywords: string[];
  confidence: number;
  importance: number;
  vitality: number;
  accessCount: number;
  reinforcementCount: number;
  status: MemoryStatus;
  pinned: boolean;
  note: string;
  createdAt: number;
  lastAccessedAt: number;
  lastReinforcedAt: number;
  expiresAt: number;
  updatedAt: number;
  sources: MemorySourceRecord[];
  relations: MemoryRelationRecord[];
  actions: MemoryActionRecord[];
  chunks: MemoryChunkRecord[];
}

export interface MemoryScoreFactors {
  lexical: number;
  dense: number;
  topology: number;
  signature: number;
  quality: number;
  final: number;
}

export interface MemorySearchResult {
  memory: MemoryItem;
  score: number;
  factors: MemoryScoreFactors;
  matchedPath: string[];
  signatureMatches: string[];
  matchedChunks: Array<{
    chunk: MemoryChunkRecord;
    lexical: number;
    dense: number;
    signature: number;
    score: number;
  }>;
}

export interface MemoryRetrievalPacket {
  runId: string;
  strategy: MemoryRetrievalStrategy;
  query: string;
  symptomService: string;
  signature: string[];
  paths: string[][];
  fallbackReason: string;
  latencyMs: number;
  results: MemorySearchResult[];
}

export interface MemoryMaintenanceReport {
  scanned: number;
  decayed: number;
  reinforced: number;
  merged: number;
  conflicts: number;
  archived: number;
  expired: number;
  completedAt: number;
}

export interface ModelSettings {
  provider: ModelProvider;
  endpointMode: ModelEndpointMode;
  model: string;
  baseUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  temperature: number | null;
  maxOutputTokens: number;
  maxSteps: number;
  timeoutSeconds: number;
  maxRetries: number;
  toolChoice: AgentToolChoice;
  instructions: string;
  memoryLastMessages: number;
}

export interface ModelTestResult {
  ok: boolean;
  provider: ModelProvider;
  protocol: "OpenAI Responses API" | "Anthropic Messages API";
  model: string;
  endpoint: string;
  latencyMs: number;
  category:
    | "success"
    | "configuration"
    | "authentication"
    | "model"
    | "rate_limit"
    | "timeout"
    | "network"
    | "provider";
  message: string;
  response?: string;
}

export interface MCPServerRecord {
  id: string;
  orgId: string;
  name: string;
  description: string;
  url: string;
  enabled: boolean;
  headers: Record<string, string>;
  hasHeaders: boolean;
  timeoutMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface SSHHost {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  authType: SSHAuthType;
  hostKeyFingerprint: string;
  enabled: boolean;
  hasSecret: boolean;
  simulated?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DebugSimulationSettings {
  simulatedSSHEnabled: boolean;
  simulatedSSHHostId: string;
  updatedAt: number;
}

export interface SSHHostSecret {
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SSHCommandDefinition {
  id: string;
  name: string;
  description: string;
  command: string;
}

export interface SSHToolPolicy {
  toolId: "ssh-readonly-inspect" | "ssh-execute-command";
  riskLevel: number;
  enabled: boolean;
  requireApproval: boolean;
  maxSeconds: number;
  commandIds: string[];
  commands: SSHCommandDefinition[];
  updatedAt: number;
}

export interface SSHAuditRecord {
  id: number;
  userId: string;
  hostId: string;
  hostName: string;
  toolId: string;
  commandId: string;
  status: "success" | "failed";
  exitCode: number | null;
  durationMs: number;
  stdoutBytes: number;
  stderrBytes: number;
  error: string;
  createdAt: number;
}

export interface A2UIComponent {
  version: "0.1";
  surfaceId: string;
  operation: "replace" | "append" | "update";
  root: {
    type: "plan" | "table" | "key_value" | "status" | "code" | "markdown";
    title: string;
    data: unknown;
  };
}
