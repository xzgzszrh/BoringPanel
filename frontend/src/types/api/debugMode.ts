export type DebugProfile = 'light' | 'standard' | 'high';
export type DebugScenario = 'normal' | 'slow' | 'errors';

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
