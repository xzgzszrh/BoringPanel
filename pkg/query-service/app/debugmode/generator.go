package debugmode

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Generator struct {
	endpoint string
	client   *http.Client
}

type generatedTrace struct {
	traceID string
	spanIDs map[string]string
	fault   bool
}

func NewGenerator(endpoint string) *Generator {
	return &Generator{
		endpoint: strings.TrimRight(endpoint, "/"),
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (g *Generator) Generate(ctx context.Context, orgID string, config Config, generatedAt time.Time) error {
	scenario, ok := scenarioByID(config.Scenario)
	if !ok {
		return fmt.Errorf("unknown debug scenario: %s", config.Scenario)
	}
	tracesPerBatch := map[string]int{ProfileLight: 2, ProfileStandard: 6, ProfileHigh: 18}[config.Profile]
	for i := 0; i < tracesPerBatch; i++ {
		currentTime := generatedAt.Add(time.Duration(i) * 25 * time.Millisecond)
		trace := generatedTrace{spanIDs: map[string]string{}, fault: isFaultRequest(scenario, currentTime, i)}
		if config.Signals.Traces || config.Signals.Messaging {
			var err error
			trace, err = g.sendTraces(ctx, orgID, scenario, config, currentTime, i, trace.fault)
			if err != nil {
				return err
			}
		}
		if config.Signals.Logs {
			if err := g.sendLogs(ctx, orgID, scenario, currentTime, trace, i); err != nil {
				return err
			}
		}
	}

	if config.Signals.Metrics || config.Signals.Infrastructure || config.Signals.Messaging {
		if err := g.sendMetrics(ctx, orgID, scenario, config, generatedAt); err != nil {
			return err
		}
	}
	return nil
}

func isFaultRequest(scenario scenarioDefinition, at time.Time, sequence int) bool {
	if scenario.Catalog.FaultRatio <= 0 {
		return false
	}
	// Every fault scenario contains at least one failing request even in the light profile.
	if sequence == 0 {
		return true
	}
	bucket := int((at.UnixMilli()/250+int64(sequence*37))%100 + 100)
	return bucket%100 < scenario.Catalog.FaultRatio
}

func (g *Generator) sendTraces(
	ctx context.Context,
	orgID string,
	scenario scenarioDefinition,
	config Config,
	at time.Time,
	sequence int,
	fault bool,
) (generatedTrace, error) {
	traceID := randomHex(16)
	durations := make([]time.Duration, len(scenario.Services))
	for index, service := range scenario.Services {
		latencyMS := service.BaselineLatencyMS
		if fault && service.FaultLatencyMS > 0 && (scenario.RootIndex < 0 || index <= scenario.RootIndex) {
			latencyMS = service.FaultLatencyMS
		}
		latencyMS += sequence % 3
		durations[index] = time.Duration(latencyMS) * time.Millisecond
	}
	// Parent spans must include the full downstream duration.
	for index := len(durations) - 2; index >= 0; index-- {
		childEnd := time.Duration(index+1)*5*time.Millisecond + durations[index+1]
		minimum := childEnd - time.Duration(index)*5*time.Millisecond + 3*time.Millisecond
		if durations[index] < minimum {
			durations[index] = minimum
		}
	}

	parentID := ""
	resourceSpans := make([]any, 0, len(scenario.Services)+2)
	spanIDs := make(map[string]string, len(scenario.Services))
	for index, service := range scenario.Services {
		spanID := randomHex(8)
		spanIDs[service.Name] = spanID
		start := at.Add(time.Duration(index) * 5 * time.Millisecond)
		isRootError := fault && index == scenario.RootIndex
		isUpstreamError := fault && scenario.RootIndex >= 0 && index < scenario.RootIndex
		isError := isRootError || isUpstreamError
		statusCode := 200
		if isRootError && scenario.RootStatusCode != 0 {
			statusCode = scenario.RootStatusCode
		} else if isUpstreamError && scenario.UpstreamStatusCode != 0 {
			statusCode = scenario.UpstreamStatusCode
		}
		attributes := traceAttributes(scenario.Catalog.ID, service, statusCode, isRootError)
		span := map[string]any{
			"traceId":           traceID,
			"spanId":            spanID,
			"name":              service.Operation,
			"kind":              spanKind(service.Protocol),
			"startTimeUnixNano": nanoString(start),
			"endTimeUnixNano":   nanoString(start.Add(durations[index])),
			"attributes":        attributes,
			"status": map[string]any{
				"code": map[bool]string{true: "STATUS_CODE_ERROR", false: "STATUS_CODE_OK"}[isError],
			},
		}
		if parentID != "" {
			span["parentSpanId"] = parentID
		}
		if isRootError && scenario.ExceptionMessage != "" {
			span["events"] = []any{map[string]any{
				"timeUnixNano": nanoString(start.Add(durations[index] / 2)),
				"name":         "exception",
				"attributes": []any{
					attribute("exception.type", scenario.ExceptionType),
					attribute("exception.message", scenario.ExceptionMessage),
					attribute("exception.stacktrace", scenario.ExceptionStacktrace),
					attribute("exception.escaped", false),
				},
			}}
		}
		resourceSpans = append(resourceSpans, resourceWithScope(
			"scopeSpans", service.Name, orgID, scenario.Catalog.ID, "spans", []any{span},
		))
		parentID = spanID
	}

	if config.Signals.Messaging && !topologyContainsMessaging(scenario) {
		messagingSpans, producerID := makeHealthyMessagingSpans(traceID, parentID, at, orgID, scenario.Catalog.ID)
		resourceSpans = append(resourceSpans, messagingSpans...)
		spanIDs["调试-事件总线"] = producerID
	}

	err := g.post(ctx, "/v1/traces", map[string]any{"resourceSpans": resourceSpans})
	return generatedTrace{traceID: traceID, spanIDs: spanIDs, fault: fault}, err
}

func traceAttributes(caseID string, service scenarioService, statusCode int, rootError bool) []any {
	values := map[string]any{
		"scry.debug":             true,
		"scry.dataset":           "diagnostic-evaluation",
		"scry.debug.case_id":     caseID,
		"deployment.environment": "debug",
	}
	for key, value := range service.Attributes {
		values[key] = value
	}
	operationParts := strings.Fields(service.Operation)
	switch service.Protocol {
	case "http":
		method := "GET"
		route := service.Operation
		if len(operationParts) > 1 {
			method = operationParts[0]
			route = strings.Join(operationParts[1:], " ")
		}
		values["http.request.method"] = method
		values["http.route"] = route
		values["http.response.status_code"] = statusCode
		values["server.address"] = "scry-debug.internal"
	case "db":
		if _, exists := values["db.system"]; !exists {
			values["db.system"] = "postgresql"
		}
		values["db.operation.name"] = firstField(service.Operation)
	case "redis":
		values["db.system"] = "redis"
		values["db.operation.name"] = firstField(service.Operation)
	case "grpc":
		values["rpc.system"] = "grpc"
		if rootError {
			values["rpc.grpc.status_code"] = 4
		} else {
			values["rpc.grpc.status_code"] = 0
		}
	case "messaging":
		values["messaging.operation.type"] = map[bool]string{true: "process", false: "publish"}[strings.Contains(strings.ToLower(service.Operation), "process")]
	case "tls":
		values["network.transport"] = "tcp"
		values["tls.protocol.version"] = "1.3"
	case "dns":
		values["network.transport"] = "udp"
	}
	if rootError {
		values["error.type"] = "dependency_failure"
	}
	return attributesFromMap(values)
}

func firstField(value string) string {
	parts := strings.Fields(value)
	if len(parts) == 0 {
		return value
	}
	return parts[0]
}

func spanKind(protocol string) string {
	switch protocol {
	case "db", "redis", "dns", "tls", "filesystem", "network", "process":
		return "SPAN_KIND_CLIENT"
	case "messaging":
		return "SPAN_KIND_CONSUMER"
	default:
		return "SPAN_KIND_SERVER"
	}
}

func topologyContainsMessaging(scenario scenarioDefinition) bool {
	for _, service := range scenario.Services {
		if service.Protocol == "messaging" {
			return true
		}
	}
	return false
}

func makeHealthyMessagingSpans(traceID, parentID string, at time.Time, orgID, caseID string) ([]any, string) {
	producerID := randomHex(8)
	consumerID := randomHex(8)
	producer := map[string]any{
		"traceId": traceID, "spanId": producerID, "parentSpanId": parentID,
		"name": "audit.events publish", "kind": "SPAN_KIND_PRODUCER",
		"startTimeUnixNano": nanoString(at.Add(80 * time.Millisecond)),
		"endTimeUnixNano":   nanoString(at.Add(88 * time.Millisecond)),
		"attributes":        messagingAttributes(caseID, "audit.events", "publish", "audit-indexer"),
		"status":            map[string]any{"code": "STATUS_CODE_OK"},
	}
	consumer := map[string]any{
		"traceId": traceID, "spanId": consumerID, "parentSpanId": producerID,
		"name": "audit.events process", "kind": "SPAN_KIND_CONSUMER",
		"startTimeUnixNano": nanoString(at.Add(94 * time.Millisecond)),
		"endTimeUnixNano":   nanoString(at.Add(128 * time.Millisecond)),
		"attributes":        messagingAttributes(caseID, "audit.events", "process", "audit-indexer"),
		"status":            map[string]any{"code": "STATUS_CODE_OK"},
	}
	return []any{
		resourceWithScope("scopeSpans", "调试-订单服务", orgID, caseID, "spans", []any{producer}),
		resourceWithScope("scopeSpans", "调试-审计消费者", orgID, caseID, "spans", []any{consumer}),
	}, producerID
}

func (g *Generator) sendLogs(
	ctx context.Context,
	orgID string,
	scenario scenarioDefinition,
	at time.Time,
	trace generatedTrace,
	sequence int,
) error {
	logs := make([]scenarioLog, 0, len(scenario.RootLogs)+len(scenario.DistractorLogs)+2)
	if trace.fault {
		logs = append(logs, scenario.RootLogs...)
		if scenario.UpstreamLog != "" && len(scenario.Services) > 0 {
			logs = append(logs, logLine(scenario.Services[0].Name, "ERROR", scenario.UpstreamLog, map[string]any{
				"http.request.id": fmt.Sprintf("req-%s-%04d", scenario.Catalog.ID, sequence),
			}))
		}
	} else if len(scenario.Services) > 0 {
		logs = append(logs, logLine(scenario.Services[0].Name, "INFO", "request completed successfully status=200", map[string]any{
			"http.request.id": fmt.Sprintf("req-%s-%04d", scenario.Catalog.ID, sequence),
		}))
	}
	if sequence == 0 {
		logs = append(logs, scenario.DistractorLogs...)
	}
	if len(logs) == 0 {
		return nil
	}

	resourceLogs := make([]any, 0, len(logs))
	for index, item := range logs {
		record := map[string]any{
			"timeUnixNano":         nanoString(at.Add(time.Duration(index) * time.Millisecond)),
			"observedTimeUnixNano": nanoString(time.Now()),
			"severityText":         strings.ToUpper(item.Severity),
			"severityNumber":       severityNumber(item.Severity),
			"body":                 map[string]any{"stringValue": item.Body},
			"attributes": attributesFromMap(mergeAttributes(item.Attributes, map[string]any{
				"scry.debug":         true,
				"scry.dataset":       "diagnostic-evaluation",
				"scry.debug.case_id": scenario.Catalog.ID,
				"event.domain":       "application",
			})),
		}
		if trace.traceID != "" {
			record["traceId"] = trace.traceID
			if spanID := trace.spanIDs[item.Service]; spanID != "" {
				record["spanId"] = spanID
			}
		}
		resourceLogs = append(resourceLogs, resourceWithScope(
			"scopeLogs", item.Service, orgID, scenario.Catalog.ID, "logRecords", []any{record},
		))
	}
	return g.post(ctx, "/v1/logs", map[string]any{"resourceLogs": resourceLogs})
}

func severityNumber(severity string) int {
	switch strings.ToUpper(severity) {
	case "TRACE":
		return 1
	case "DEBUG":
		return 5
	case "INFO", "NOTICE":
		return 9
	case "WARN", "WARNING":
		return 13
	case "ERROR":
		return 17
	case "FATAL":
		return 21
	default:
		return 9
	}
}

func mergeAttributes(primary, defaults map[string]any) map[string]any {
	result := make(map[string]any, len(primary)+len(defaults))
	for key, value := range defaults {
		result[key] = value
	}
	for key, value := range primary {
		result[key] = value
	}
	return result
}

func (g *Generator) sendMetrics(
	ctx context.Context,
	orgID string,
	scenario scenarioDefinition,
	config Config,
	at time.Time,
) error {
	wave := (math.Sin(float64(at.Unix())/23) + 1) / 2
	metrics := make([]any, 0, len(scenario.Metrics)+len(scenario.Services)*4+10)
	if config.Signals.Metrics {
		for index, service := range scenario.Services {
			faultService := scenario.RootIndex >= 0 && index < scenario.RootIndex && scenario.Catalog.FaultRatio > 0
			if index == scenario.RootIndex && (scenario.RootStatusCode >= 400 || service.Protocol != "http") {
				faultService = scenario.Catalog.FaultRatio > 0
			}
			duration := float64(service.BaselineLatencyMS)
			errorRatio := 0.002
			active := 4.0 + float64(index)
			if faultService {
				duration = float64(maxInt(service.FaultLatencyMS, service.BaselineLatencyMS))
				errorRatio = float64(scenario.Catalog.FaultRatio) / 100
				active = 18 + float64(index*4)
			}
			attrs := []any{attribute("service.name", service.Name), attribute("operation", service.Operation)}
			rateName, durationName, errorName, activeName := serviceMetricNames(service.Protocol)
			metrics = append(metrics,
				gauge(rateName, "{request}/s", at, 32+wave*18, attrs),
				gauge(durationName, "ms", at, duration*(0.96+wave*0.08), attrs),
				gauge(errorName, "1", at, errorRatio, attrs),
				gauge(activeName, "{request}", at, active+wave*3, attrs),
			)
		}
	}
	if config.Signals.Infrastructure {
		rootName := scenario.Services[0].Name
		if scenario.RootIndex >= 0 && scenario.RootIndex < len(scenario.Services) {
			rootName = scenario.Services[scenario.RootIndex].Name
		}
		metrics = append(metrics,
			gauge("system.cpu.utilization", "1", at, 0.31+wave*0.08, []any{attribute("host.name", "scry-debug-host-01"), attribute("service.name", rootName)}),
			gauge("system.memory.utilization", "1", at, 0.54+wave*0.06, []any{attribute("host.name", "scry-debug-host-01"), attribute("service.name", rootName)}),
			gauge("system.filesystem.utilization", "1", at, 0.46+wave*0.03, []any{attribute("host.name", "scry-debug-host-01"), attribute("mountpoint", "/")}),
			gauge("system.network.io", "By/s", at, 8.4e6+wave*2.1e6, []any{attribute("host.name", "scry-debug-host-01"), attribute("direction", "receive")}),
		)
	}

	for _, item := range scenario.Metrics {
		if !signalEnabled(config.Signals, item.Signal) {
			continue
		}
		value := item.FaultValue + (wave-0.5)*2*item.Jitter
		attrs := attributesFromMap(item.Attributes)
		if item.Monotonic {
			metrics = append(metrics, cumulativeSeries(item.Name, item.Unit, at, item.HealthyValue, math.Max(0, value), attrs))
		} else {
			metrics = append(metrics, gaugeSeries(item.Name, item.Unit, at, item.HealthyValue, value, attrs))
		}
	}

	if config.Signals.Messaging && !hasSignalMetrics(scenario, "messaging") {
		kafkaAttrs := []any{
			attribute("topic", "audit.events"),
			attribute("consumer_group", "audit-indexer"),
			attribute("partition", "0"),
		}
		metrics = append(metrics,
			gauge("kafka.consumer.group.lag", "{message}", at, 8+wave*12, kafkaAttrs),
			gauge("kafka.consumer.records.rate", "{message}/s", at, 46+wave*8, kafkaAttrs),
			gauge("kafka.producer.records.rate", "{message}/s", at, 44+wave*8, kafkaAttrs),
			gauge("kafka.cluster.under_replicated_partitions", "{partition}", at, 0, kafkaAttrs),
		)
	}

	resource := map[string]any{
		"attributes": []any{
			attribute("service.name", "调试-遥测生成器"),
			attribute("service.namespace", "scry-debug"),
			attribute("deployment.environment", "debug"),
			attribute("scry.debug", true),
			attribute("scry.dataset", "diagnostic-evaluation"),
			attribute("scry.debug.case_id", scenario.Catalog.ID),
			attribute("scry.org.id", orgID),
			attribute("host.name", "scry-debug-host-01"),
			attribute("host_name", "scry-debug-host-01"),
			attribute("os.type", "linux"),
		},
	}
	payload := map[string]any{
		"resourceMetrics": []any{map[string]any{
			"resource": resource,
			"scopeMetrics": []any{map[string]any{
				"scope":   map[string]any{"name": "scry.debug.generator", "version": "2.0.0"},
				"metrics": metrics,
			}},
		}},
	}
	return g.post(ctx, "/v1/metrics", payload)
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func serviceMetricNames(protocol string) (string, string, string, string) {
	switch protocol {
	case "grpc":
		return "rpc.server.request.rate", "rpc.server.duration.p95", "rpc.server.error_ratio", "rpc.server.active_requests"
	case "db", "redis":
		return "db.client.operation.rate", "db.client.operation.duration.p95", "db.client.operation.error_ratio", "db.client.active_operations"
	case "messaging":
		return "messaging.process.rate", "messaging.process.duration.p95", "messaging.process.error_ratio", "messaging.active_messages"
	case "http":
		return "http.server.request.rate", "http.server.request.duration.p95", "http.server.error_ratio", "http.server.active_requests"
	default:
		return "dependency.request.rate", "dependency.request.duration.p95", "dependency.request.error_ratio", "dependency.active_requests"
	}
}

func signalEnabled(signals Signals, signal string) bool {
	switch signal {
	case "metrics":
		return signals.Metrics
	case "infrastructure":
		return signals.Infrastructure
	case "messaging":
		return signals.Messaging
	default:
		return false
	}
}

func hasSignalMetrics(scenario scenarioDefinition, signal string) bool {
	for _, item := range scenario.Metrics {
		if item.Signal == signal {
			return true
		}
	}
	return false
}

func (g *Generator) post(ctx context.Context, path string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.endpoint+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := g.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("OTLP endpoint returned %s", resp.Status)
	}
	return nil
}

func resourceWithScope(scopeKey, serviceName, orgID, caseID, recordsKey string, records []any) map[string]any {
	return map[string]any{
		"resource": map[string]any{"attributes": []any{
			attribute("service.name", serviceName),
			attribute("service.namespace", "scry-debug"),
			attribute("service.version", "2.0.0-debug"),
			attribute("service.instance.id", serviceName+"-01"),
			attribute("deployment.environment", "debug"),
			attribute("scry.debug", true),
			attribute("scry.dataset", "diagnostic-evaluation"),
			attribute("scry.debug.case_id", caseID),
			attribute("scry.org.id", orgID),
		}},
		scopeKey: []any{map[string]any{
			"scope":    map[string]any{"name": "scry.debug.generator", "version": "2.0.0"},
			recordsKey: records,
		}},
	}
}

func messagingAttributes(caseID, topic, operation, consumerGroup string) []any {
	return []any{
		attribute("scry.debug", true),
		attribute("scry.debug.case_id", caseID),
		attribute("messaging.system", "kafka"),
		attribute("messaging.destination.name", topic),
		attribute("messaging.destination.partition.id", "0"),
		attribute("messaging.operation.type", operation),
		attribute("messaging.consumer.group.name", consumerGroup),
		attribute("messaging.message.body.size", 512),
		attribute("messaging.client.id", "scry-debug-client"),
	}
}

func attributesFromMap(values map[string]any) []any {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]any, 0, len(keys))
	for _, key := range keys {
		result = append(result, attribute(key, values[key]))
	}
	return result
}

func attribute(key string, value any) map[string]any {
	encoded := map[string]any{}
	switch typed := value.(type) {
	case string:
		encoded["stringValue"] = typed
	case bool:
		encoded["boolValue"] = typed
	case int:
		encoded["intValue"] = strconv.Itoa(typed)
	case int32:
		encoded["intValue"] = strconv.FormatInt(int64(typed), 10)
	case int64:
		encoded["intValue"] = strconv.FormatInt(typed, 10)
	case uint:
		encoded["intValue"] = strconv.FormatUint(uint64(typed), 10)
	case uint64:
		encoded["intValue"] = strconv.FormatUint(typed, 10)
	case float32:
		encoded["doubleValue"] = float64(typed)
	case float64:
		encoded["doubleValue"] = typed
	default:
		encoded["stringValue"] = fmt.Sprint(typed)
	}
	return map[string]any{"key": key, "value": encoded}
}

func gauge(name, unit string, at time.Time, value float64, attributes []any) map[string]any {
	return map[string]any{
		"name": name,
		"unit": unit,
		"gauge": map[string]any{"dataPoints": []any{map[string]any{
			"timeUnixNano": nanoString(at),
			"asDouble":     value,
			"attributes":   attributes,
		}}},
	}
}

func gaugeSeries(name, unit string, at time.Time, baseline, current float64, attributes []any) map[string]any {
	return map[string]any{
		"name": name,
		"unit": unit,
		"gauge": map[string]any{"dataPoints": []any{
			map[string]any{
				"timeUnixNano": nanoString(at.Add(-10 * time.Minute)),
				"asDouble":     baseline,
				"attributes":   attributes,
			},
			map[string]any{
				"timeUnixNano": nanoString(at),
				"asDouble":     current,
				"attributes":   attributes,
			},
		}},
	}
}

func cumulativeSeries(name, unit string, at time.Time, healthyRate, faultRate float64, attributes []any) map[string]any {
	baselineAt := at.Add(-10 * time.Minute)
	baselineValue := math.Max(0, healthyRate) * float64(baselineAt.Unix()) / 60
	currentValue := baselineValue + math.Max(0, faultRate)*10
	return map[string]any{
		"name": name,
		"unit": unit,
		"sum": map[string]any{
			"aggregationTemporality": "AGGREGATION_TEMPORALITY_CUMULATIVE",
			"isMonotonic":            true,
			"dataPoints": []any{
				map[string]any{
					"startTimeUnixNano": nanoString(baselineAt.Add(-24 * time.Hour)),
					"timeUnixNano":      nanoString(baselineAt),
					"asDouble":          baselineValue,
					"attributes":        attributes,
				},
				map[string]any{
					"startTimeUnixNano": nanoString(baselineAt.Add(-24 * time.Hour)),
					"timeUnixNano":      nanoString(at),
					"asDouble":          currentValue,
					"attributes":        attributes,
				},
			},
		},
	}
}

func nanoString(value time.Time) string {
	return strconv.FormatInt(value.UnixNano(), 10)
}

func randomHex(bytesCount int) string {
	value := make([]byte, bytesCount)
	if _, err := rand.Read(value); err != nil {
		return strings.Repeat("0", bytesCount*2)
	}
	return hex.EncodeToString(value)
}
