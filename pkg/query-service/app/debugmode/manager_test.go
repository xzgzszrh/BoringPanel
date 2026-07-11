package debugmode

import (
	"context"
	"strings"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

type recordingCleanupExecutor struct {
	queries []string
}

func (e *recordingCleanupExecutor) Exec(_ context.Context, query string, _ ...any) error {
	e.queries = append(e.queries, query)
	return nil
}

func TestManagerPersistsOrganizationConfig(t *testing.T) {
	db, err := sqlx.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	defer db.Close()

	manager, err := NewManager(db, nil, "http://127.0.0.1:4318", true)
	require.NoError(t, err)
	defer manager.Close()

	config := DefaultConfig()
	config.Profile = ProfileLight
	config.Scenario = ScenarioSlow
	config.IntervalSeconds = 15
	config.BackfillMinutes = 0
	config.Signals.Messaging = false

	status, err := manager.Update("org-1", config)
	require.NoError(t, err)
	require.Equal(t, config, status.Config)
	require.False(t, status.Running)

	stored, err := manager.GetStatus("org-1")
	require.NoError(t, err)
	require.Equal(t, ProfileLight, stored.Config.Profile)
	require.Equal(t, ScenarioSlow, stored.Config.Scenario)
	require.False(t, stored.Config.Signals.Messaging)
}

func TestValidateConfigRejectsUnsafeRates(t *testing.T) {
	config := DefaultConfig()
	config.IntervalSeconds = 1
	require.Error(t, validateConfig(config))

	config = DefaultConfig()
	config.Signals = Signals{}
	require.Error(t, validateConfig(config))
}

func TestCleanupQueriesAreScopedToDebugData(t *testing.T) {
	executor := &recordingCleanupExecutor{}
	manager := &Manager{executor: executor}
	require.NoError(t, manager.deleteDebugData(context.Background()))
	require.NotEmpty(t, executor.queries)

	for _, query := range executor.queries {
		require.Contains(t, query, "DELETE WHERE")
		require.True(t,
			strings.Contains(query, "scry.debug") ||
				strings.Contains(query, "scry-debug") ||
				strings.Contains(query, "调试-") ||
				strings.Contains(query, "deployment_environment = 'debug'") ||
				strings.Contains(query, "scry_debug_"),
			"cleanup query is not scoped to debug data: %s", query,
		)
	}
}
