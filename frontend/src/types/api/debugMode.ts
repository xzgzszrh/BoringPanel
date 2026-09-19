export type DebugProfile = 'light' | 'standard' | 'high';
export type DebugScenario = string;

export interface DebugScenarioCatalogItem {
	id: string;
	name: string;
	category: string;
	difficulty: string;
	symptom: string;
	topology: string[];
	signals: string[];
	faultRatio: number;
}

export interface DebugScenarioGroundTruth {
	scenarioId: string;
	rootServices: string[];
	rootCause: string;
	expectedDiagnosis: string;
	keyEvidence: string[];
	remediation: string[];
	verification: string[];
	unsafeActions: string[];
}

export interface DebugSignals {
	traces: boolean;
	logs: boolean;
	metrics: boolean;
	infrastructure: boolean;
	messaging: boolean;
}

export interface DebugModeConfig {
	enabled: boolean;
	profile: DebugProfile;
	scenario: DebugScenario;
	intervalSeconds: number;
	backfillMinutes: number;
	signals: DebugSignals;
}

export interface DebugModeStatus {
	available: boolean;
	running: boolean;
	config: DebugModeConfig;
	lastGeneratedAt?: string;
	generatedBatches: number;
	lastError?: string;
	cleaning: boolean;
	lastCleanupAt?: string;
	cleanupError?: string;
}
