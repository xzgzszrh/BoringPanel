package debugmode

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
)

type CleanupExecutor interface {
	Exec(ctx context.Context, query string, args ...any) error
}

const (
	ProfileLight    = "light"
	ProfileStandard = "standard"
	ProfileHigh     = "high"

	ScenarioNormal = "normal"
	ScenarioSlow   = "slow"
	ScenarioErrors = "errors"
)

type Signals struct {
	Traces         bool `json:"traces"`
	Logs           bool `json:"logs"`
	Metrics        bool `json:"metrics"`
	Infrastructure bool `json:"infrastructure"`
	Messaging      bool `json:"messaging"`
}

type Config struct {
	Enabled         bool    `json:"enabled"`
	Profile         string  `json:"profile"`
	Scenario        string  `json:"scenario"`
	IntervalSeconds int     `json:"intervalSeconds"`
	BackfillMinutes int     `json:"backfillMinutes"`
	Signals         Signals `json:"signals"`
}

type Status struct {
	Available        bool       `json:"available"`
	Running          bool       `json:"running"`
	Config           Config     `json:"config"`
	LastGeneratedAt  *time.Time `json:"lastGeneratedAt,omitempty"`
	GeneratedBatches uint64     `json:"generatedBatches"`
	LastError        string     `json:"lastError,omitempty"`
	Cleaning         bool       `json:"cleaning"`
	LastCleanupAt    *time.Time `json:"lastCleanupAt,omitempty"`
	CleanupError     string     `json:"cleanupError,omitempty"`
}

type workerState struct {
	cancel           context.CancelFunc
	lastGeneratedAt  *time.Time
	generatedBatches uint64
	lastError        string
	cleaning         bool
	lastCleanupAt    *time.Time
	cleanupError     string
}

type Manager struct {
	db        *sqlx.DB
	available bool
	generator *Generator
	executor  CleanupExecutor

	mu      sync.RWMutex
	workers map[string]*workerState
}

func DefaultConfig() Config {
	return Config{
		Profile:         ProfileStandard,
		Scenario:        ScenarioNormal,
		IntervalSeconds: 10,
		BackfillMinutes: 30,
		Signals: Signals{
			Traces:         true,
			Logs:           true,
			Metrics:        true,
			Infrastructure: true,
			Messaging:      true,
		},
	}
}

func NewManager(db *sqlx.DB, executor CleanupExecutor, endpoint string, available bool) (*Manager, error) {
	m := &Manager{
		db:        db,
		available: available,
		generator: NewGenerator(endpoint),
		executor:  executor,
		workers:   make(map[string]*workerState),
	}

	if err := m.ensureSchema(); err != nil {
		return nil, err
	}
	if available {
		if err := m.resumeEnabled(); err != nil {
			return nil, err
		}
	}
	return m, nil
}

func (m *Manager) ensureSchema() error {
	_, err := m.db.Exec(`CREATE TABLE IF NOT EXISTS debug_mode_config (
		org_id TEXT PRIMARY KEY,
		enabled INTEGER NOT NULL DEFAULT 0,
		profile TEXT NOT NULL,
		scenario TEXT NOT NULL,
		interval_seconds INTEGER NOT NULL,
		backfill_minutes INTEGER NOT NULL,
		signals_json TEXT NOT NULL,
		updated_at INTEGER NOT NULL
	)`)
	return err
}

func (m *Manager) resumeEnabled() error {
	rows, err := m.db.Queryx(`SELECT org_id FROM debug_mode_config WHERE enabled = 1`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var orgID string
		if err := rows.Scan(&orgID); err != nil {
			return err
		}
		config, err := m.getConfig(orgID)
		if err != nil {
			return err
		}
		m.startWorker(orgID, config, false)
	}
	return rows.Err()
}

func (m *Manager) GetStatus(orgID string) (Status, error) {
	config, err := m.getConfig(orgID)
	if err != nil {
		return Status{}, err
	}

	status := Status{Available: m.available, Config: config}
	m.mu.RLock()
	defer m.mu.RUnlock()
	if worker, ok := m.workers[orgID]; ok {
		status.Running = worker.cancel != nil
		status.LastGeneratedAt = worker.lastGeneratedAt
		status.GeneratedBatches = worker.generatedBatches
		status.LastError = worker.lastError
		status.Cleaning = worker.cleaning
		status.LastCleanupAt = worker.lastCleanupAt
		status.CleanupError = worker.cleanupError
	}
	return status, nil
}

func (m *Manager) Update(orgID string, config Config) (Status, error) {
	if !m.available {
		return Status{}, errors.New("debug mode is not available")
	}
	if err := validateConfig(config); err != nil {
		return Status{}, err
	}
	previousConfig, err := m.getConfig(orgID)
	if err != nil {
		return Status{}, err
	}

	signals, err := json.Marshal(config.Signals)
	if err != nil {
		return Status{}, err
	}
	_, err = m.db.Exec(`INSERT INTO debug_mode_config (
		org_id, enabled, profile, scenario, interval_seconds, backfill_minutes, signals_json, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(org_id) DO UPDATE SET
		enabled = excluded.enabled,
		profile = excluded.profile,
		scenario = excluded.scenario,
		interval_seconds = excluded.interval_seconds,
		backfill_minutes = excluded.backfill_minutes,
		signals_json = excluded.signals_json,
		updated_at = excluded.updated_at`,
		orgID, config.Enabled, config.Profile, config.Scenario, config.IntervalSeconds,
		config.BackfillMinutes, string(signals), time.Now().Unix(),
	)
	if err != nil {
		return Status{}, err
	}

	m.stopWorker(orgID)
	if config.Enabled {
		m.startWorker(orgID, config, !previousConfig.Enabled)
	}
	return m.GetStatus(orgID)
}

func (m *Manager) GenerateNow(ctx context.Context, orgID string) (Status, error) {
	if !m.available {
		return Status{}, errors.New("debug mode is not available")
	}
	config, err := m.getConfig(orgID)
	if err != nil {
		return Status{}, err
	}
	if err := m.generator.Generate(ctx, orgID, config, time.Now()); err != nil {
		m.recordResult(orgID, err)
		return Status{}, err
	}
	m.recordResult(orgID, nil)
	return m.GetStatus(orgID)
}

func (m *Manager) Cleanup(orgID string) (Status, error) {
	if !m.available {
		return Status{}, errors.New("debug mode is not available")
	}
	if m.executor == nil {
		return Status{}, errors.New("debug data cleanup is unavailable")
	}

	config, err := m.getConfig(orgID)
	if err != nil {
		return Status{}, err
	}
	config.Enabled = false
	if _, err := m.Update(orgID, config); err != nil {
		return Status{}, err
	}

	m.mu.Lock()
	state := m.ensureStateLocked(orgID)
	if state.cleaning {
		m.mu.Unlock()
		return m.GetStatus(orgID)
	}
	state.cleaning = true
	state.cleanupError = ""
	m.mu.Unlock()

	go m.runCleanup(orgID)
	return m.GetStatus(orgID)
}

func (m *Manager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, worker := range m.workers {
		if worker.cancel != nil {
			worker.cancel()
		}
	}
	m.workers = make(map[string]*workerState)
}

func (m *Manager) getConfig(orgID string) (Config, error) {
	config := DefaultConfig()
	var signalsJSON string
	err := m.db.QueryRowx(`SELECT enabled, profile, scenario, interval_seconds,
		backfill_minutes, signals_json FROM debug_mode_config WHERE org_id = ?`, orgID).Scan(
		&config.Enabled, &config.Profile, &config.Scenario, &config.IntervalSeconds,
		&config.BackfillMinutes, &signalsJSON,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return config, nil
	}
	if err != nil {
		return Config{}, err
	}
	if err := json.Unmarshal([]byte(signalsJSON), &config.Signals); err != nil {
		return Config{}, err
	}
	return config, nil
}

func (m *Manager) startWorker(orgID string, config Config, backfill bool) {
	ctx, cancel := context.WithCancel(context.Background())
	m.mu.Lock()
	state := m.ensureStateLocked(orgID)
	state.cancel = cancel
	m.mu.Unlock()

	go func() {
		if backfill {
			for minute := config.BackfillMinutes; minute > 0; minute-- {
				if ctx.Err() != nil {
					return
				}
				err := m.generator.Generate(ctx, orgID, config, time.Now().Add(-time.Duration(minute)*time.Minute))
				m.recordResult(orgID, err)
			}
		}

		ticker := time.NewTicker(time.Duration(config.IntervalSeconds) * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case generatedAt := <-ticker.C:
				err := m.generator.Generate(ctx, orgID, config, generatedAt)
				m.recordResult(orgID, err)
			}
		}
	}()
}

func (m *Manager) stopWorker(orgID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if worker, ok := m.workers[orgID]; ok {
		if worker.cancel != nil {
			worker.cancel()
		}
		worker.cancel = nil
	}
}

func (m *Manager) recordResult(orgID string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	worker := m.ensureStateLocked(orgID)
	if err != nil {
		worker.lastError = err.Error()
		return
	}
	now := time.Now().UTC()
	worker.lastGeneratedAt = &now
	worker.generatedBatches++
	worker.lastError = ""
}

func (m *Manager) ensureStateLocked(orgID string) *workerState {
	state, ok := m.workers[orgID]
	if !ok {
		state = &workerState{}
		m.workers[orgID] = state
	}
	return state
}

func (m *Manager) runCleanup(orgID string) {
	// Allow the collector's pending batch to flush after the worker is stopped.
	time.Sleep(12 * time.Second)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	err := m.deleteDebugData(ctx)
	now := time.Now().UTC()
	m.mu.Lock()
	state := m.ensureStateLocked(orgID)
	state.cleaning = false
	state.lastCleanupAt = &now
	if err != nil {
		state.cleanupError = err.Error()
	} else {
		state.cleanupError = ""
		state.generatedBatches = 0
		state.lastGeneratedAt = nil
		state.lastError = ""
	}
	m.mu.Unlock()
}

func (m *Manager) deleteDebugData(ctx context.Context) error {
	for _, query := range debugDataCleanupQueries() {
		if err := m.executor.Exec(ctx, query); err != nil {
			return fmt.Errorf("cleanup query failed: %w", err)
		}
	}
	return nil
}

func debugDataCleanupQueries() []string {
	traceCondition := "resources_string['scry.debug'] = 'true' OR resources_string['service.namespace'] = 'scry-debug'"
	metricV4Condition := "resource_attrs['scry.debug'] = 'true' OR resource_attrs['service.namespace'] = 'scry-debug'"
	metricV2Condition := "JSONExtractString(labels, 'scry_debug') = 'true' OR JSONExtractString(labels, 'service_namespace') = 'scry-debug' OR JSONExtractString(labels, 'resource_service_namespace') = 'scry-debug'"

	return []string{
		fmt.Sprintf("ALTER TABLE signoz_traces.trace_summary DELETE WHERE trace_id IN (SELECT trace_id FROM signoz_traces.signoz_index_v3 WHERE %s) SETTINGS mutations_sync = 1", traceCondition),
		"ALTER TABLE signoz_traces.signoz_error_index_v2 DELETE WHERE resourceTagsMap['scry.debug'] = 'true' OR startsWith(serviceName, '调试-') SETTINGS mutations_sync = 1",
		"ALTER TABLE signoz_traces.dependency_graph_minutes_v2 DELETE WHERE deployment_environment = 'debug' OR startsWith(src, '调试-') OR startsWith(dest, '调试-') SETTINGS mutations_sync = 1",
		"ALTER TABLE signoz_traces.top_level_operations DELETE WHERE startsWith(serviceName, '调试-') SETTINGS mutations_sync = 1",
		fmt.Sprintf("ALTER TABLE signoz_traces.signoz_index_v3 DELETE WHERE %s SETTINGS mutations_sync = 1", traceCondition),
		"ALTER TABLE signoz_traces.traces_v3_resource DELETE WHERE labels LIKE '%scry-debug%' OR labels LIKE '%scry.debug%' SETTINGS mutations_sync = 1",
		"ALTER TABLE signoz_logs.logs_v2 DELETE WHERE resources_string['scry.debug'] = 'true' OR resources_string['service.namespace'] = 'scry-debug' SETTINGS mutations_sync = 1",
		"ALTER TABLE signoz_logs.logs_v2_resource DELETE WHERE labels LIKE '%scry-debug%' OR labels LIKE '%scry.debug%' SETTINGS mutations_sync = 1",
		fmt.Sprintf("ALTER TABLE signoz_metrics.samples_v4_agg_30m DELETE WHERE fingerprint IN (SELECT fingerprint FROM signoz_metrics.time_series_v4 WHERE %s) SETTINGS mutations_sync = 1", metricV4Condition),
		fmt.Sprintf("ALTER TABLE signoz_metrics.samples_v4_agg_5m DELETE WHERE fingerprint IN (SELECT fingerprint FROM signoz_metrics.time_series_v4 WHERE %s) SETTINGS mutations_sync = 1", metricV4Condition),
		fmt.Sprintf("ALTER TABLE signoz_metrics.samples_v4 DELETE WHERE fingerprint IN (SELECT fingerprint FROM signoz_metrics.time_series_v4 WHERE %s) SETTINGS mutations_sync = 1", metricV4Condition),
		fmt.Sprintf("ALTER TABLE signoz_metrics.time_series_v4_1day DELETE WHERE %s SETTINGS mutations_sync = 1", metricV4Condition),
		fmt.Sprintf("ALTER TABLE signoz_metrics.time_series_v4_1week DELETE WHERE %s SETTINGS mutations_sync = 1", metricV4Condition),
		fmt.Sprintf("ALTER TABLE signoz_metrics.time_series_v4_6hrs DELETE WHERE %s SETTINGS mutations_sync = 1", metricV4Condition),
		fmt.Sprintf("ALTER TABLE signoz_metrics.time_series_v4 DELETE WHERE %s SETTINGS mutations_sync = 1", metricV4Condition),
		fmt.Sprintf("ALTER TABLE signoz_metrics.samples_v2 DELETE WHERE fingerprint IN (SELECT fingerprint FROM signoz_metrics.time_series_v2 WHERE %s) SETTINGS mutations_sync = 1", metricV2Condition),
		fmt.Sprintf("ALTER TABLE signoz_metrics.time_series_v2 DELETE WHERE %s SETTINGS mutations_sync = 1", metricV2Condition),
		"ALTER TABLE signoz_metrics.metadata DELETE WHERE startsWith(metric_name, 'scry_debug_') SETTINGS mutations_sync = 1",
	}
}

func validateConfig(config Config) error {
	if config.Profile != ProfileLight && config.Profile != ProfileStandard && config.Profile != ProfileHigh {
		return fmt.Errorf("invalid profile: %s", config.Profile)
	}
	if config.Scenario != ScenarioNormal && config.Scenario != ScenarioSlow && config.Scenario != ScenarioErrors {
		return fmt.Errorf("invalid scenario: %s", config.Scenario)
	}
	if config.IntervalSeconds < 5 || config.IntervalSeconds > 60 {
		return errors.New("intervalSeconds must be between 5 and 60")
	}
	if config.BackfillMinutes < 0 || config.BackfillMinutes > 1440 {
		return errors.New("backfillMinutes must be between 0 and 1440")
	}
	if !config.Signals.Traces && !config.Signals.Logs && !config.Signals.Metrics &&
		!config.Signals.Infrastructure && !config.Signals.Messaging {
		return errors.New("at least one signal must be enabled")
	}
	return nil
}
