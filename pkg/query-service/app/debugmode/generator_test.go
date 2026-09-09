package debugmode

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type capturedOTLP struct {
	mu       sync.Mutex
	requests map[string][]string
}

func newCaptureServer(t *testing.T) (*httptest.Server, *capturedOTLP) {
	t.Helper()
	captured := &capturedOTLP{requests: map[string][]string{}}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var payload map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&payload))
		require.NotEmpty(t, payload)
		encoded, err := json.Marshal(payload)
		require.NoError(t, err)
		captured.mu.Lock()
		captured.requests[r.URL.Path] = append(captured.requests[r.URL.Path], string(encoded))
		captured.mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	return server, captured
}

func (c *capturedOTLP) joined(path string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return strings.Join(c.requests[path], "\n")
}

func TestGeneratorSendsAllOTLPSignals(t *testing.T) {
	server, captured := newCaptureServer(t)
	defer server.Close()

	config := DefaultConfig()
	config.Profile = ProfileLight
	generator := NewGenerator(server.URL)
	require.NoError(t, generator.Generate(context.Background(), "org-1", config, time.Now()))

	captured.mu.Lock()
	defer captured.mu.Unlock()
	require.Equal(t, 2, len(captured.requests["/v1/traces"]))
	require.Equal(t, 2, len(captured.requests["/v1/logs"]))
	require.Equal(t, 1, len(captured.requests["/v1/metrics"]))
}

func TestScenarioCatalogIsCompleteAndHasGroundTruth(t *testing.T) {
	catalog := ScenarioCatalog()
	require.Len(t, catalog, 20)
	seen := map[string]bool{}
	for _, item := range catalog {
		require.False(t, seen[item.ID], "duplicate scenario id: %s", item.ID)
		seen[item.ID] = true
		require.Regexp(t, `^case-[0-9]{3}$`, item.ID)
		require.NotEmpty(t, item.Name)
		require.NotEmpty(t, item.Category)
		require.NotEmpty(t, item.Difficulty)
		require.NotEmpty(t, item.Symptom)
		require.GreaterOrEqual(t, len(item.Topology), 2)
		require.Contains(t, item.Signals, "链路")
		truth, ok := ScenarioTruth(item.ID)
		require.True(t, ok)
		require.Equal(t, item.ID, truth.ScenarioID)
		require.NotEmpty(t, truth.ExpectedDiagnosis)
		require.NotEmpty(t, truth.KeyEvidence)
		require.NotEmpty(t, truth.Remediation)
		require.NotEmpty(t, truth.Verification)
	}
}

func TestLegacyScenarioAliasesAreCanonicalized(t *testing.T) {
	tests := map[string]string{
		"normal":           ScenarioNormal,
		"slow":             ScenarioDiskIO,
		"errors":           ScenarioSchemaMismatch,
		"disk_full":        ScenarioDiskFull,
		"zombie_process":   ScenarioZombieProcess,
		"disk_io":          ScenarioDiskIO,
		"config_drift":     ScenarioConfigDrift,
		"service_down":     ScenarioServiceDown,
		"network_exposure": ScenarioNetworkExposure,
		"mixed":            ScenarioMixed,
	}
	for legacy, expected := range tests {
		actual, ok := CanonicalScenarioID(legacy)
		require.True(t, ok, legacy)
		require.Equal(t, expected, actual)
	}
}

func TestFaultScenariosEmitMechanismSpecificTelemetry(t *testing.T) {
	tests := map[string][]string{
		ScenarioPostgresPool:     {"db.client.connections.timeouts", "PoolAcquireTimeoutError", "remaining connection slots"},
		ScenarioPostgresBloat:    {"postgresql.table.dead_rows", "QueryTimeoutError", "automatic vacuum"},
		ScenarioRedisMaxClients:  {"redis.connections.rejected", "RedisConnectionError", "max number of clients"},
		ScenarioRedisPersistence: {"redis.latest_fork.duration", "RedisTimeoutError", "fork operation took"},
		ScenarioKafkaLag:         {"kafka.consumer.group.lag", "MessageProcessingTimeout", "rebalance"},
		ScenarioTLSExpiry:        {"tls.certificate.validity.remaining", "CertificateExpiredError", "certificate has expired"},
		ScenarioDNSFailure:       {"dns.lookup.failures", "DNSResolutionError", "SERVFAIL"},
		ScenarioGRPCDeadline:     {"rpc.client.errors", "DeadlineExceeded", "deadline_ms=800"},
		ScenarioRateLimit:        {"http.client.rate_limit.remaining", "RateLimitExceeded", "retry_after_s=30"},
		ScenarioSchemaMismatch:   {"application.response.validation.errors", "SchemaValidationError", "expected=number actual=string"},
		ScenarioMemoryLeak:       {"system.oom.events", "ContainerTerminated", "OOMKilled"},
		ScenarioCPUSaturation:    {"executor.queue.depth", "RejectedExecutionError", "queue_depth=500"},
		ScenarioDiskFull:         {"system.filesystem.write.errors", "NoSpaceLeftOnDevice", "ENOSPC"},
		ScenarioDiskIO:           {"system.disk.operation.duration", "StorageTimeoutError", "DataFileExtend"},
		ScenarioConfigDrift:      {"deployment.config.revision.match", "JWTSignatureError", "checksum differs"},
		ScenarioServiceDown:      {"service.health", "ConnectionRefused", "CrashLoopBackOff"},
		ScenarioNetworkExposure:  {"security.listener.approved", "UnauthorizedListener", "port=2375"},
		ScenarioZombieProcess:    {"system.processes.zombies", "ProcessSpawnError", "zombie process"},
		ScenarioMixed:            {"container.memory.limit", "ContainerTerminated", "rebalance"},
	}
	for scenarioID, expected := range tests {
		t.Run(scenarioID, func(t *testing.T) {
			server, captured := newCaptureServer(t)
			defer server.Close()

			config := DefaultConfig()
			config.Profile = ProfileLight
			config.Scenario = scenarioID
			generator := NewGenerator(server.URL)
			require.NoError(t, generator.Generate(context.Background(), "org-1", config, time.Unix(1784419200, 0)))

			allPayloads := captured.joined("/v1/traces") + captured.joined("/v1/logs") + captured.joined("/v1/metrics")
			for _, fragment := range expected {
				require.Contains(t, allPayloads, fragment)
			}
			require.Contains(t, allPayloads, scenarioID)
			require.NotContains(t, allPayloads, "scry.debug.scenario")
			require.NotContains(t, allPayloads, "root_cause")
			require.NotContains(t, allPayloads, "root_service")
		})
	}
}

func TestLogsAreCorrelatedWithServiceSpans(t *testing.T) {
	server, captured := newCaptureServer(t)
	defer server.Close()

	config := DefaultConfig()
	config.Profile = ProfileLight
	config.Scenario = ScenarioPostgresPool
	require.NoError(t, NewGenerator(server.URL).Generate(context.Background(), "org-1", config, time.Now()))

	logs := captured.joined("/v1/logs")
	require.Contains(t, logs, `"traceId"`)
	require.Contains(t, logs, `"spanId"`)
	require.Contains(t, logs, "调试-PostgreSQL")
	require.Contains(t, logs, "调试-订单服务")
}
