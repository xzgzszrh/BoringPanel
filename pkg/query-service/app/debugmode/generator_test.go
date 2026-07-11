package debugmode

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestGeneratorSendsAllOTLPSignals(t *testing.T) {
	var mu sync.Mutex
	received := map[string]int{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var payload map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&payload))
		require.NotEmpty(t, payload)
		mu.Lock()
		received[r.URL.Path]++
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	config := DefaultConfig()
	config.Profile = ProfileLight
	generator := NewGenerator(server.URL)
	require.NoError(t, generator.Generate(context.Background(), "org-1", config, time.Now()))

	mu.Lock()
	defer mu.Unlock()
	require.Equal(t, 1, received["/v1/traces"])
	require.Equal(t, 1, received["/v1/logs"])
	require.Equal(t, 1, received["/v1/metrics"])
}
