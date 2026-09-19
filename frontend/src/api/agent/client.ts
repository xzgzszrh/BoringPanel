export interface AgentThread {
	id: string;
	title: string;
	created_at: number;
	updated_at: number;
}

export interface AgentUIMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	parts: Array<Record<string, unknown>>;
	metadata?: Record<string, unknown>;
}

export type WorkflowStepType =
	| 'agent'
	| 'services'
	| 'alerts'
	| 'dashboards'
	| 'mcp-tool'
	| 'security-check'
	| 'operation'
	| 'verify'
	| 'approval'
	| 'condition'
	| 'parallel'
	| 'loop';

export type WorkflowConditionOperator =
	| 'exists'
	| 'equals'
	| 'not_equals'
	| 'gt'
	| 'gte'
	| 'lt'
	| 'lte';

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
	parallel?: { branches: WorkflowBranchDefinition[] };
	loop?: {
		mode: 'while' | 'until' | 'foreach';
		rule: WorkflowConditionRule;
		maxIterations: number;
		sourcePath?: string;
		concurrency?: number;
		steps: WorkflowStepDefinition[];
	};
}

export interface WorkflowRecord {
	id: string;
	name: string;
	description: string;
	enabled: boolean;
	definition: { version: 1 | 2; steps: WorkflowStepDefinition[] };
	tags: string[];
	schedule: { enabled: boolean; cron: string; timezone: string };
	eventTriggers: Array<{
		id: string;
		eventType: string;
		filter: string;
		enabled: boolean;
	}>;
	inputSchema: Array<{
		id: string;
		label: string;
		type: 'text' | 'number' | 'boolean' | 'json';
		required: boolean;
		description?: string;
		defaultValue?: string;
	}>;
	version: number;
	versions: Array<{
		version: number;
		name: string;
		definition: { version: 1 | 2; steps: WorkflowStepDefinition[] };
		createdAt: number;
	}>;
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

export interface AgentModelSettings {
	provider: 'openai' | 'anthropic';
	endpointMode: 'official' | 'custom';
	model: string;
	baseUrl: string;
	hasApiKey: boolean;
	temperature: number | null;
	maxOutputTokens: number;
	maxSteps: number;
	timeoutSeconds: number;
	maxRetries: number;
	toolChoice: 'auto' | 'none' | 'required';
	instructions: string;
	memoryLastMessages: number;
}

export interface AgentModelTestResult {
	ok: boolean;
	provider: 'openai' | 'anthropic';
	protocol: 'OpenAI Responses API' | 'Anthropic Messages API';
	model: string;
	endpoint: string;
	latencyMs: number;
	category:
		| 'success'
		| 'configuration'
		| 'authentication'
		| 'model'
		| 'rate_limit'
		| 'timeout'
		| 'network'
		| 'provider';
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
	hasHeaders: boolean;
	timeoutMs: number;
	createdAt: number;
	updatedAt: number;
}

export interface MCPServerInput {
	name: string;
	description: string;
	url: string;
	enabled: boolean;
	headers?: Record<string, string>;
	timeoutMs: number;
}

export type SSHAuthType = 'password' | 'private_key';

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

export interface SSHCommandDefinition {
	id: string;
	name: string;
	description: string;
	command: string;
}

export interface SSHToolPolicy {
	toolId: 'ssh-readonly-inspect' | 'ssh-execute-command';
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
	status: 'success' | 'failed';
	exitCode: number | null;
	durationMs: number;
	stdoutBytes: number;
	stderrBytes: number;
	error: string;
	createdAt: number;
}

export interface SecurityAuditEvent {
	id: number;
	traceId: string;
	orgId: string;
	userId: string;
	eventType: string;
	source: string;
	target: string;
	decision: 'allow' | 'require-approval' | 'deny' | '';
	riskScore: number;
	inputHash: string;
	details: Record<string, unknown>;
	createdAt: number;
}

export type EvidenceStatus = 'active' | 'accepted' | 'rejected' | 'suspended';
export type EvidenceSourceType =
	| 'telemetry'
	| 'service'
	| 'alert'
	| 'dashboard'
	| 'ssh'
	| 'mcp'
	| 'workflow'
	| 'document'
	| 'url';

export interface EvidenceRelation {
	id: string;
	fromEvidenceId: string;
	toEvidenceId: string;
	type: 'same_trace' | 'related' | 'corroborates' | 'derived_from';
	score: number;
	rationale: string;
	createdAt: number;
}

export interface EvidenceAction {
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
	scoreFactors: {
		sourceReliability: number;
		dataQuality: number;
		freshness: number;
		executionIntegrity: number;
		directness: number;
		lexicalMatch: number;
	};
	status: EvidenceStatus;
	selected: boolean;
	note: string;
	capturedAt: number;
	updatedAt: number;
	relations: EvidenceRelation[];
	actions: EvidenceAction[];
}

export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural';
export type MemoryScope =
	| 'organization'
	| 'user'
	| 'agent'
	| 'thread'
	| 'workflow';
export type MemoryStatus =
	| 'active'
	| 'verified'
	| 'suspended'
	| 'archived'
	| 'forgotten';

export interface MemorySource {
	id: number;
	memoryId: string;
	sourceType:
		| 'evidence'
		| 'message'
		| 'workflow'
		| 'manual'
		| 'memory'
		| 'document';
	sourceId: string;
	traceId: string;
	relation: string;
	weight: number;
	createdAt: number;
}

export interface MemoryRelation {
	id: string;
	fromMemoryId: string;
	toMemoryId: string;
	type:
		| 'supports'
		| 'conflicts'
		| 'duplicates'
		| 'derived_from'
		| 'same_service';
	score: number;
	rationale: string;
	createdAt: number;
}

export interface MemoryAction {
	id: number;
	memoryId: string;
	userId: string;
	action: string;
	previousStatus: MemoryStatus;
	nextStatus: MemoryStatus;
	detail: string;
	createdAt: number;
}

export interface MemoryChunk {
	id: string;
	memoryId: string;
	index: number;
	type: 'summary' | 'observation' | 'procedure' | 'evidence' | 'metadata';
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
	sources: MemorySource[];
	relations: MemoryRelation[];
	actions: MemoryAction[];
	chunks: MemoryChunk[];
}

export type MemorySampleCategory =
	| 'database-storage'
	| 'cache-capacity'
	| 'messaging-async'
	| 'config-contract'
	| 'security-external';

export interface MemorySampleCatalogItem {
	id: string;
	category: MemorySampleCategory;
	categoryLabel: string;
	type: MemoryType;
	title: string;
	summary: string;
	serviceName: string;
	confidence: number;
	importance: number;
	sourceDocument: {
		id: string;
		path: string;
		updatedAt: string;
	};
	generatedMemoryId: string;
}

export interface MemorySampleGenerationResult {
	memories: MemoryItem[];
	createdCount: number;
	existingCount: number;
}

export interface MemorySearchResult {
	memory: MemoryItem;
	score: number;
	factors: {
		lexical: number;
		dense: number;
		topology: number;
		signature: number;
		quality: number;
		final: number;
	};
	matchedPath: string[];
	signatureMatches: string[];
	matchedChunks: Array<{
		chunk: MemoryChunk;
		lexical: number;
		dense: number;
		signature: number;
		score: number;
	}>;
}

export interface MemoryRetrievalPacket {
	runId: string;
	strategy: 'topomem' | 'topomem-mp' | 'lexical-fallback';
	query: string;
	symptomService: string;
	signature: string[];
	paths: string[][];
	fallbackReason: string;
	latencyMs: number;
	results: MemorySearchResult[];
}

export interface MemoryStats {
	total: number;
	online: number;
	verified: number;
	suspended: number;
	averageVitality: number;
	byType: Record<MemoryType, number>;
	byStatus: Record<MemoryStatus, number>;
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

export interface SSHHostInput {
	name: string;
	hostname: string;
	port: number;
	username: string;
	authType: SSHAuthType;
	hostKeyFingerprint: string;
	enabled: boolean;
	secret?: { password?: string; privateKey?: string; passphrase?: string };
}

export type AgentMode = 'diagnose' | 'plan' | 'operate';

export const AGENT_BASE_URL =
	process.env.AGENT_API_ENDPOINT || 'http://localhost:4111';

async function request<T>(
	path: string,
	token: string,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(`${AGENT_BASE_URL}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			...(init?.headers || {}),
		},
	});
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || `Agent API ${response.status}`);
	}
	return response.status === 204 ? (undefined as T) : response.json();
}

export const agentApi = {
	listThreads: (token: string): Promise<AgentThread[]> =>
		request('/api/threads', token),
	createThread: (token: string, title = '新对话'): Promise<{ id: string }> =>
		request('/api/threads', token, {
			method: 'POST',
			body: JSON.stringify({ title }),
		}),
	getThread: (
		token: string,
		id: string,
	): Promise<{
		uiMessages: AgentUIMessage[];
	}> => request(`/api/threads/${id}`, token),
	deleteThread: (token: string, id: string): Promise<void> =>
		request(`/api/threads/${id}`, token, { method: 'DELETE' }),
	getModelSettings: (token: string): Promise<AgentModelSettings> =>
		request('/api/settings/model', token),
	updateModelSettings: (
		token: string,
		settings: AgentModelSettings & { apiKey?: string },
	): Promise<AgentModelSettings> =>
		request('/api/settings/model', token, {
			method: 'PUT',
			body: JSON.stringify(settings),
		}),
	testModel: (
		token: string,
		settings: AgentModelSettings & { apiKey?: string },
	): Promise<AgentModelTestResult> =>
		request('/api/settings/model/test', token, {
			method: 'POST',
			body: JSON.stringify(settings),
		}),
	getDebugSimulation: (token: string): Promise<DebugSimulationSettings> =>
		request('/api/debug/simulation', token),
	updateDebugSimulation: (
		token: string,
		simulatedSSHEnabled: boolean,
	): Promise<DebugSimulationSettings> =>
		request('/api/debug/simulation', token, {
			method: 'PUT',
			body: JSON.stringify({ simulatedSSHEnabled }),
		}),
	listSSHHosts: (token: string): Promise<SSHHost[]> =>
		request('/api/ssh/hosts', token),
	probeSSHHost: (
		token: string,
		hostname: string,
		port: number,
	): Promise<{ fingerprint: string }> =>
		request('/api/ssh/hosts/probe', token, {
			method: 'POST',
			body: JSON.stringify({ hostname, port }),
		}),
	createSSHHost: (token: string, host: SSHHostInput): Promise<SSHHost> =>
		request('/api/ssh/hosts', token, {
			method: 'POST',
			body: JSON.stringify(host),
		}),
	updateSSHHost: (
		token: string,
		id: string,
		host: SSHHostInput,
	): Promise<SSHHost> =>
		request(`/api/ssh/hosts/${id}`, token, {
			method: 'PUT',
			body: JSON.stringify(host),
		}),
	deleteSSHHost: (token: string, id: string): Promise<void> =>
		request(`/api/ssh/hosts/${id}`, token, { method: 'DELETE' }),
	testSSHHost: (
		token: string,
		id: string,
	): Promise<{ ok: boolean; latencyMs: number }> =>
		request(`/api/ssh/hosts/${id}/test`, token, { method: 'POST' }),
	listSSHPolicies: (token: string): Promise<SSHToolPolicy[]> =>
		request('/api/ssh/policies', token),
	updateSSHPolicy: (
		token: string,
		policy: SSHToolPolicy,
	): Promise<SSHToolPolicy> =>
		request(`/api/ssh/policies/${policy.toolId}`, token, {
			method: 'PUT',
			body: JSON.stringify(policy),
		}),
	listSSHAudits: (token: string, limit = 50): Promise<SSHAuditRecord[]> =>
		request(`/api/ssh/audits?limit=${limit}`, token),
	listSecurityAudits: (
		token: string,
		limit = 100,
	): Promise<SecurityAuditEvent[]> =>
		request(`/api/security/audits?limit=${limit}`, token),
	listEvidence: (token: string, threadId: string): Promise<EvidenceItem[]> =>
		request(`/api/threads/${threadId}/evidence`, token),
	listMemories: (
		token: string,
		filters: Partial<{
			query: string;
			type: MemoryType;
			scope: MemoryScope;
			status: MemoryStatus;
			serviceName: string;
			includeInactive: boolean;
			limit: number;
		}> = {},
	): Promise<MemoryItem[]> => {
		const params = new URLSearchParams();
		Object.entries(filters).forEach(([key, value]) => {
			if (value !== undefined && value !== '') params.set(key, String(value));
		});
		return request(`/api/memories?${params.toString()}`, token);
	},
	getMemoryStats: (token: string): Promise<MemoryStats> =>
		request('/api/memories/stats', token),
	listMemorySamples: (token: string): Promise<MemorySampleCatalogItem[]> =>
		request('/api/memory-samples', token),
	generateMemorySamples: (
		token: string,
		sampleIds: string[],
	): Promise<MemorySampleGenerationResult> =>
		request('/api/memory-samples/generate', token, {
			method: 'POST',
			body: JSON.stringify({ sampleIds }),
		}),
	deleteMemorySample: (
		token: string,
		memoryId: string,
	): Promise<{ memoryId: string; sampleId: string }> =>
		request(`/api/memory-samples/${memoryId}`, token, { method: 'DELETE' }),
	createMemory: (
		token: string,
		memory: {
			type: MemoryType;
			scope: MemoryScope;
			title: string;
			summary: string;
			content: unknown;
			threadId?: string;
			workflowId?: string;
			serviceName?: string;
			tags?: string[];
			confidence?: number;
			importance?: number;
			pinned?: boolean;
			note?: string;
			expiresAt?: number;
			evidenceIds?: string[];
		},
	): Promise<MemoryItem> =>
		request('/api/memories', token, {
			method: 'POST',
			body: JSON.stringify(memory),
		}),
	updateMemory: (
		token: string,
		memoryId: string,
		patch: Partial<
			Pick<MemoryItem, 'status' | 'pinned' | 'note' | 'confidence' | 'importance'>
		>,
	): Promise<MemoryItem> =>
		request(`/api/memories/${memoryId}`, token, {
			method: 'PATCH',
			body: JSON.stringify(patch),
		}),
	forgetMemory: (token: string, memoryId: string): Promise<MemoryItem> =>
		request(`/api/memories/${memoryId}`, token, { method: 'DELETE' }),
	searchMemory: (
		token: string,
		query: string,
		threadId?: string,
		limit = 10,
	): Promise<MemoryRetrievalPacket> =>
		request('/api/memories/search', token, {
			method: 'POST',
			body: JSON.stringify({ query, threadId, limit }),
		}),
	getThreadMemories: (
		token: string,
		threadId: string,
	): Promise<MemoryRetrievalPacket> =>
		request(`/api/threads/${threadId}/memories`, token),
	maintainMemories: (
		token: string,
		limit = 500,
	): Promise<MemoryMaintenanceReport> =>
		request('/api/memories/maintenance', token, {
			method: 'POST',
			body: JSON.stringify({ limit }),
		}),
	updateEvidence: (
		token: string,
		evidenceId: string,
		patch: { status?: EvidenceStatus; selected?: boolean; note?: string },
	): Promise<EvidenceItem> =>
		request(`/api/evidence/${evidenceId}`, token, {
			method: 'PATCH',
			body: JSON.stringify(patch),
		}),
	reviseWithEvidence: (
		token: string,
		threadId: string,
		evidenceIds: string[],
		instruction = '',
	): Promise<{ revisionId: string; message: AgentUIMessage }> =>
		request(`/api/threads/${threadId}/evidence/revise`, token, {
			method: 'POST',
			body: JSON.stringify({ evidenceIds, instruction }),
		}),
	listMCPServers: (token: string): Promise<MCPServerRecord[]> =>
		request('/api/mcp/servers', token),
	createMCPServer: (
		token: string,
		server: MCPServerInput,
	): Promise<MCPServerRecord> =>
		request('/api/mcp/servers', token, {
			method: 'POST',
			body: JSON.stringify(server),
		}),
	updateMCPServer: (
		token: string,
		id: string,
		server: MCPServerInput,
	): Promise<MCPServerRecord> =>
		request(`/api/mcp/servers/${id}`, token, {
			method: 'PUT',
			body: JSON.stringify(server),
		}),
	deleteMCPServer: (token: string, id: string): Promise<void> =>
		request(`/api/mcp/servers/${id}`, token, { method: 'DELETE' }),
	testMCPServer: (
		token: string,
		id: string,
	): Promise<{
		ok: boolean;
		tools: Array<{ id: string; description: string }>;
		error: string;
	}> => request(`/api/mcp/servers/${id}/test`, token, { method: 'POST' }),
	listWorkflows: (
		token: string,
		enabledOnly = false,
	): Promise<WorkflowRecord[]> =>
		request(`/api/workflows?enabledOnly=${enabledOnly}`, token),
	createWorkflow: (
		token: string,
		workflow: Omit<WorkflowRecord, 'id' | 'createdAt' | 'updatedAt'>,
	): Promise<WorkflowRecord> =>
		request('/api/workflows', token, {
			method: 'POST',
			body: JSON.stringify(workflow),
		}),
	updateWorkflow: (
		token: string,
		workflow: WorkflowRecord,
	): Promise<WorkflowRecord> =>
		request(`/api/workflows/${workflow.id}`, token, {
			method: 'PUT',
			body: JSON.stringify(workflow),
		}),
	deleteWorkflow: (token: string, id: string): Promise<void> =>
		request(`/api/workflows/${id}`, token, { method: 'DELETE' }),
	listWorkflowRuns: (token: string, id: string): Promise<WorkflowRunRecord[]> =>
		request(`/api/workflows/${id}/runs`, token),
};
