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
	"strings"
	"time"
)

type Generator struct {
	endpoint string
	client   *http.Client
}

type generatedTrace struct {
	traceID string
	spanID  string
}

func NewGenerator(endpoint string) *Generator {
	return &Generator{
		endpoint: strings.TrimRight(endpoint, "/"),
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (g *Generator) Generate(ctx context.Context, orgID string, config Config, generatedAt time.Time) error {
	tracesPerBatch := map[string]int{ProfileLight: 1, ProfileStandard: 3, ProfileHigh: 10}[config.Profile]
	var trace generatedTrace
	for i := 0; i < tracesPerBatch; i++ {
		currentTime := generatedAt.Add(time.Duration(i) * time.Millisecond)
		if config.Signals.Traces || config.Signals.Messaging {
			var err error
			trace, err = g.sendTraces(ctx, orgID, config, currentTime, i)
			if err != nil {
				return err
			}
		}
		if config.Signals.Logs {
			if err := g.sendLogs(ctx, orgID, config, currentTime, trace, i); err != nil {
				return err
			}
		}
	}

	if config.Signals.Metrics || config.Signals.Infrastructure || config.Signals.Messaging {
		if err := g.sendMetrics(ctx, orgID, config, generatedAt); err != nil {
			return err
		}
	}
	return nil
}

func (g *Generator) sendTraces(ctx context.Context, orgID string, config Config, at time.Time, sequence int) (generatedTrace, error) {
	traceID := randomHex(16)
	services := []struct {
		name      string
		operation string
		duration  time.Duration
	}{
		{"调试-网关", "GET /api/orders", 180 * time.Millisecond},
		{"调试-订单服务", "POST /orders", 130 * time.Millisecond},
		{"调试-库存服务", "SELECT inventory", 65 * time.Millisecond},
		{"调试-支付服务", "POST /payments", 90 * time.Millisecond},
	}
	if config.Scenario == ScenarioSlow {
		services[2].duration = 2 * time.Second
	}

	parentID := ""
	resourceSpans := make([]any, 0, len(services)+1)
	rootSpanID := ""
	for index, service := range services {
		spanID := randomHex(8)
		if index == 0 {
			rootSpanID = spanID
		}
		start := at.Add(time.Duration(index) * 10 * time.Millisecond)
		isError := config.Scenario == ScenarioErrors && (sequence+index)%3 == 0
		if config.Scenario == ScenarioNormal && (at.Unix()/60+int64(index))%10 == 0 {
			isError = true
		}
		attributes := []any{
			attribute("scry.debug", true),
			attribute("scry.dataset", "default"),
			attribute("deployment.environment", "debug"),
			attribute("http.request.method", map[bool]string{true: "POST", false: "GET"}[index > 0]),
			attribute("http.response.status_code", map[bool]int{true: 500, false: 200}[isError]),
			attribute("server.address", "scry-debug.internal"),
		}
		span := map[string]any{
			"traceId":           traceID,
			"spanId":            spanID,
			"name":              service.operation,
			"kind":              "SPAN_KIND_SERVER",
			"startTimeUnixNano": nanoString(start),
			"endTimeUnixNano":   nanoString(start.Add(service.duration)),
			"attributes":        attributes,
			"status": map[string]any{
				"code": map[bool]string{true: "STATUS_CODE_ERROR", false: "STATUS_CODE_OK"}[isError],
			},
		}
		if parentID != "" {
			span["parentSpanId"] = parentID
		}
		if isError {
			span["events"] = []any{map[string]any{
				"timeUnixNano": nanoString(start.Add(service.duration / 2)),
				"name":         "exception",
				"attributes": []any{
					attribute("exception.type", "DebugPaymentError"),
					attribute("exception.message", "调试场景生成的支付失败"),
					attribute("exception.stacktrace", "payment.Process\norders.Submit\napi.Handle"),
				},
			}}
		}

		resourceSpans = append(resourceSpans, resourceWithScope("scopeSpans", service.name, orgID, "spans", []any{span}))
		parentID = spanID
	}

	if config.Signals.Messaging {
		producerSpanID := randomHex(8)
		producerSpan := map[string]any{
			"traceId":           traceID,
			"spanId":            producerSpanID,
			"parentSpanId":      parentID,
			"name":              "orders publish",
			"kind":              "SPAN_KIND_PRODUCER",
			"startTimeUnixNano": nanoString(at.Add(190 * time.Millisecond)),
			"endTimeUnixNano":   nanoString(at.Add(215 * time.Millisecond)),
			"attributes":        messagingAttributes(false),
			"status":            map[string]any{"code": "STATUS_CODE_OK"},
		}
		resourceSpans = append(resourceSpans, resourceWithScope("scopeSpans", "调试-订单服务", orgID, "spans", []any{producerSpan}))

		consumerSpanID := randomHex(8)
		consumerSpan := map[string]any{
			"traceId":           traceID,
			"spanId":            consumerSpanID,
			"parentSpanId":      producerSpanID,
			"name":              "orders process",
			"kind":              "SPAN_KIND_CONSUMER",
			"startTimeUnixNano": nanoString(at.Add(220 * time.Millisecond)),
			"endTimeUnixNano":   nanoString(at.Add(280 * time.Millisecond)),
			"attributes":        messagingAttributes(true),
			"status":            map[string]any{"code": "STATUS_CODE_OK"},
		}
		resourceSpans = append(resourceSpans, resourceWithScope("scopeSpans", "调试-消息消费者", orgID, "spans", []any{consumerSpan}))
	}

	err := g.post(ctx, "/v1/traces", map[string]any{"resourceSpans": resourceSpans})
	return generatedTrace{traceID: traceID, spanID: rootSpanID}, err
}

func (g *Generator) sendLogs(ctx context.Context, orgID string, config Config, at time.Time, trace generatedTrace, sequence int) error {
	isError := config.Scenario == ScenarioErrors && sequence%3 == 0
	severity := "INFO"
	severityNumber := 9
	body := "订单请求处理完成"
	if isError {
		severity = "ERROR"
		severityNumber = 17
		body = "调试场景：支付服务返回错误"
	}
	record := map[string]any{
		"timeUnixNano":         nanoString(at),
		"observedTimeUnixNano": nanoString(time.Now()),
		"severityText":         severity,
		"severityNumber":       severityNumber,
		"body":                 map[string]any{"stringValue": body},
		"attributes": []any{
			attribute("scry.debug", true),
			attribute("scry.dataset", "default"),
			attribute("http.route", "/api/orders"),
			attribute("order.id", fmt.Sprintf("debug-%06d", sequence)),
		},
	}
	if trace.traceID != "" {
		record["traceId"] = trace.traceID
		record["spanId"] = trace.spanID
	}
	payload := map[string]any{
		"resourceLogs": []any{resourceWithScope("scopeLogs", "调试-订单服务", orgID, "logRecords", []any{record})},
	}
	return g.post(ctx, "/v1/logs", payload)
}

func (g *Generator) sendMetrics(ctx context.Context, orgID string, config Config, at time.Time) error {
	wave := (math.Sin(float64(at.Unix())/30) + 1) / 2
	metrics := []any{}
	if config.Signals.Metrics {
		metrics = append(metrics,
			gauge("scry_debug_requests_per_second", at, 40+wave*60, nil),
			gauge("scry_debug_order_value", at, 120+wave*80, nil),
		)
	}
	if config.Signals.Infrastructure {
		cpuTotal := float64(at.Unix())
		metrics = append(metrics,
			gauge("system_cpu_load_average_15m", at, 0.8+wave*1.7, nil),
			sum("system_cpu_time", at, cpuTotal*0.28, []any{attribute("state", "user")}),
			sum("system_cpu_time", at, cpuTotal*0.02, []any{attribute("state", "wait")}),
			sum("system_cpu_time", at, cpuTotal*0.70, []any{attribute("state", "idle")}),
			nonMonotonicSum("system_memory_usage", at, 4.2e9+wave*1.5e9, []any{attribute("state", "used")}),
			nonMonotonicSum("system_memory_usage", at, 8.0e9-wave*1.5e9, []any{attribute("state", "free")}),
		)
	}
	if config.Signals.Messaging {
		kafkaAttrs := []any{
			attribute("topic", "orders"),
			attribute("consumer_group", "scry-debug-orders"),
			attribute("partition", "0"),
		}
		metrics = append(metrics,
			gauge("kafka_consumer_group_lag", at, 18+wave*65, kafkaAttrs),
			gauge("kafka_consumer_fetch_latency_avg", at, 8+wave*18, kafkaAttrs),
			gauge("kafka_producer_byte_rate", at, 12000+wave*8000, kafkaAttrs),
			gauge("kafka_consumer_records_consumed_rate", at, 45+wave*30, kafkaAttrs),
			gauge("kafka_brokers", at, 3, kafkaAttrs),
			gauge("kafka_topic_partitions", at, 6, kafkaAttrs),
		)
	}

	resource := map[string]any{
		"attributes": []any{
			attribute("service.name", "调试-基础设施代理"),
			attribute("service.namespace", "scry-debug"),
			attribute("deployment.environment", "debug"),
			attribute("scry.debug", true),
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
				"scope":   map[string]any{"name": "scry.debug.generator", "version": "1.0.0"},
				"metrics": metrics,
			}},
		}},
	}
	return g.post(ctx, "/v1/metrics", payload)
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

func resourceWithScope(scopeKey, serviceName, orgID, recordsKey string, records []any) map[string]any {
	return map[string]any{
		"resource": map[string]any{"attributes": []any{
			attribute("service.name", serviceName),
			attribute("service.namespace", "scry-debug"),
			attribute("service.version", "1.0.0-debug"),
			attribute("service.instance.id", serviceName+"-01"),
			attribute("deployment.environment", "debug"),
			attribute("scry.debug", true),
			attribute("scry.org.id", orgID),
		}},
		scopeKey: []any{map[string]any{
			"scope":    map[string]any{"name": "scry.debug.generator", "version": "1.0.0"},
			recordsKey: records,
		}},
	}
}

func messagingAttributes(consumer bool) []any {
	operation := "publish"
	if consumer {
		operation = "process"
	}
	return []any{
		attribute("scry.debug", true),
		attribute("messaging.system", "kafka"),
		attribute("messaging.destination.name", "orders"),
		attribute("messaging.destination.partition.id", "0"),
		attribute("messaging.operation", operation),
		attribute("messaging.kafka.consumer.group", "scry-debug-orders"),
		attribute("messaging.message.body.size", 512),
		attribute("messaging.client_id", "scry-debug-client"),
	}
}

func attribute(key string, value any) map[string]any {
	encoded := map[string]any{}
	switch typed := value.(type) {
	case string:
		encoded["stringValue"] = typed
	case bool:
		encoded["boolValue"] = typed
	case int:
		encoded["intValue"] = fmt.Sprintf("%d", typed)
	case int64:
		encoded["intValue"] = fmt.Sprintf("%d", typed)
	case float64:
		encoded["doubleValue"] = typed
	default:
		encoded["stringValue"] = fmt.Sprint(typed)
	}
	return map[string]any{"key": key, "value": encoded}
}

func gauge(name string, at time.Time, value float64, attributes []any) map[string]any {
	return map[string]any{
		"name": name,
		"gauge": map[string]any{"dataPoints": []any{map[string]any{
			"timeUnixNano": nanoString(at),
			"asDouble":     value,
			"attributes":   attributes,
		}}},
	}
}

func sum(name string, at time.Time, value float64, attributes []any) map[string]any {
	return sumMetric(name, at, value, attributes, true)
}

func nonMonotonicSum(name string, at time.Time, value float64, attributes []any) map[string]any {
	return sumMetric(name, at, value, attributes, false)
}

func sumMetric(name string, at time.Time, value float64, attributes []any, isMonotonic bool) map[string]any {
	return map[string]any{
		"name": name,
		"sum": map[string]any{
			"aggregationTemporality": "AGGREGATION_TEMPORALITY_CUMULATIVE",
			"isMonotonic":            isMonotonic,
			"dataPoints": []any{map[string]any{
				"startTimeUnixNano": nanoString(at.Add(-time.Hour)),
				"timeUnixNano":      nanoString(at),
				"asDouble":          value,
				"attributes":        attributes,
			}},
		},
	}
}

func nanoString(value time.Time) string {
	return fmt.Sprintf("%d", value.UnixNano())
}

func randomHex(bytesCount int) string {
	value := make([]byte, bytesCount)
	if _, err := rand.Read(value); err != nil {
		return strings.Repeat("0", bytesCount*2)
	}
	return hex.EncodeToString(value)
}
