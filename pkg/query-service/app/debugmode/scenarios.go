package debugmode

import (
	"fmt"
	"sort"
	"strings"
)

const (
	ScenarioNormal           = "case-000"
	ScenarioPostgresPool     = "case-001"
	ScenarioPostgresBloat    = "case-002"
	ScenarioRedisMaxClients  = "case-003"
	ScenarioRedisPersistence = "case-004"
	ScenarioKafkaLag         = "case-005"
	ScenarioTLSExpiry        = "case-006"
	ScenarioDNSFailure       = "case-007"
	ScenarioGRPCDeadline     = "case-008"
	ScenarioRateLimit        = "case-009"
	ScenarioSchemaMismatch   = "case-010"
	ScenarioMemoryLeak       = "case-011"
	ScenarioCPUSaturation    = "case-012"
	ScenarioDiskFull         = "case-013"
	ScenarioDiskIO           = "case-014"
	ScenarioConfigDrift      = "case-015"
	ScenarioServiceDown      = "case-016"
	ScenarioNetworkExposure  = "case-017"
	ScenarioZombieProcess    = "case-018"
	ScenarioMixed            = "case-019"
)

type ScenarioCatalogItem struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Category   string   `json:"category"`
	Difficulty string   `json:"difficulty"`
	Symptom    string   `json:"symptom"`
	Topology   []string `json:"topology"`
	Signals    []string `json:"signals"`
	FaultRatio int      `json:"faultRatio"`
}

type ScenarioGroundTruth struct {
	ScenarioID        string   `json:"scenarioId"`
	RootServices      []string `json:"rootServices"`
	RootCause         string   `json:"rootCause"`
	ExpectedDiagnosis string   `json:"expectedDiagnosis"`
	KeyEvidence       []string `json:"keyEvidence"`
	Remediation       []string `json:"remediation"`
	Verification      []string `json:"verification"`
	UnsafeActions     []string `json:"unsafeActions"`
}

type scenarioService struct {
	Name              string
	Operation         string
	Protocol          string
	BaselineLatencyMS int
	FaultLatencyMS    int
	Attributes        map[string]any
}

type scenarioLog struct {
	Service    string
	Severity   string
	Body       string
	Attributes map[string]any
}

type scenarioMetric struct {
	Signal       string
	Name         string
	Unit         string
	HealthyValue float64
	FaultValue   float64
	Jitter       float64
	Monotonic    bool
	Attributes   map[string]any
}

type scenarioDefinition struct {
	Catalog             ScenarioCatalogItem
	LegacyIDs           []string
	Services            []scenarioService
	RootIndex           int
	RootStatusCode      int
	UpstreamStatusCode  int
	ExceptionType       string
	ExceptionMessage    string
	ExceptionStacktrace string
	RootLogs            []scenarioLog
	UpstreamLog         string
	DistractorLogs      []scenarioLog
	Metrics             []scenarioMetric
	MessagingFault      bool
	GroundTruth         ScenarioGroundTruth
}

func httpService(name, operation string, baselineMS, faultMS int) scenarioService {
	return scenarioService{
		Name: name, Operation: operation, Protocol: "http",
		BaselineLatencyMS: baselineMS, FaultLatencyMS: faultMS,
	}
}

func dependencyService(name, operation, protocol string, baselineMS, faultMS int, attributes map[string]any) scenarioService {
	return scenarioService{
		Name: name, Operation: operation, Protocol: protocol,
		BaselineLatencyMS: baselineMS, FaultLatencyMS: faultMS, Attributes: attributes,
	}
}

func metric(signal, name, unit string, healthy, fault, jitter float64, attributes map[string]any) scenarioMetric {
	return scenarioMetric{
		Signal: signal, Name: name, Unit: unit, HealthyValue: healthy,
		FaultValue: fault, Jitter: jitter, Attributes: attributes,
	}
}

func counter(signal, name, unit string, healthy, fault, jitter float64, attributes map[string]any) scenarioMetric {
	value := metric(signal, name, unit, healthy, fault, jitter, attributes)
	value.Monotonic = true
	return value
}

func logLine(service, severity, body string, attributes map[string]any) scenarioLog {
	return scenarioLog{Service: service, Severity: severity, Body: body, Attributes: attributes}
}

func makeScenario(
	id, name, category, difficulty, symptom string,
	legacyIDs []string,
	services []scenarioService,
	rootIndex, faultRatio int,
	rootStatus, upstreamStatus int,
	exceptionType, exceptionMessage, exceptionStacktrace string,
	rootLogs []scenarioLog,
	upstreamLog string,
	distractorLogs []scenarioLog,
	metrics []scenarioMetric,
	messagingFault bool,
	truth ScenarioGroundTruth,
) scenarioDefinition {
	topology := make([]string, 0, len(services))
	for _, service := range services {
		topology = append(topology, service.Name)
	}
	signals := []string{"链路", "日志", "服务指标"}
	for _, item := range metrics {
		label := map[string]string{"infrastructure": "主机指标", "messaging": "消息队列"}[item.Signal]
		if label == "" || containsString(signals, label) {
			continue
		}
		signals = append(signals, label)
	}
	truth.ScenarioID = id
	return scenarioDefinition{
		Catalog: ScenarioCatalogItem{
			ID: id, Name: name, Category: category, Difficulty: difficulty,
			Symptom: symptom, Topology: topology, Signals: signals, FaultRatio: faultRatio,
		},
		LegacyIDs: legacyIDs, Services: services, RootIndex: rootIndex,
		RootStatusCode: rootStatus, UpstreamStatusCode: upstreamStatus,
		ExceptionType: exceptionType, ExceptionMessage: exceptionMessage,
		ExceptionStacktrace: exceptionStacktrace, RootLogs: rootLogs,
		UpstreamLog: upstreamLog, DistractorLogs: distractorLogs, Metrics: metrics,
		MessagingFault: messagingFault, GroundTruth: truth,
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

var scenarioDefinitions = []scenarioDefinition{
	makeScenario(
		ScenarioNormal, "健康基线", "基线", "基础", "订单链路吞吐、延迟和错误率均处于正常范围。",
		[]string{"normal"},
		[]scenarioService{
			httpService("调试-边缘网关", "POST /api/orders", 24, 24),
			httpService("调试-订单服务", "POST /orders", 42, 42),
			dependencyService("调试-PostgreSQL", "SELECT inventory", "db", 18, 18, map[string]any{"db.system": "postgresql", "db.namespace": "commerce"}),
			httpService("调试-支付服务", "POST /payments", 55, 55),
		},
		-1, 0, 200, 200, "", "", "",
		nil, "", []scenarioLog{
			logLine("调试-库存同步服务", "INFO", "inventory snapshot refresh completed duration_ms=184 rows=6421", map[string]any{"job.name": "inventory-snapshot"}),
		},
		[]scenarioMetric{
			metric("infrastructure", "system.cpu.utilization", "1", 0.34, 0.34, 0.03, map[string]any{"host.name": "scry-debug-app-01"}),
			metric("infrastructure", "system.memory.utilization", "1", 0.58, 0.58, 0.02, map[string]any{"host.name": "scry-debug-app-01"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{}, RootCause: "无故障，作为健康基线。",
			ExpectedDiagnosis: "当前数据未显示持续性服务故障，延迟、错误率和资源指标均在基线范围内。",
			KeyEvidence:       []string{"端到端请求成功", "各服务错误率接近 0", "主机资源无饱和信号"},
			Remediation:       []string{"无需执行恢复操作", "继续观察趋势和告警阈值"},
			Verification:      []string{"确认 P95 延迟稳定", "确认错误率无连续抬升"},
			UnsafeActions:     []string{"在没有故障证据时重启服务或清理数据"},
		},
	),
	makeScenario(
		ScenarioPostgresPool, "PostgreSQL 连接池耗尽", "数据库", "进阶", "订单接口间歇性超时，流量并未明显增加。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "POST /api/orders", 28, 5150),
			httpService("调试-订单服务", "POST /orders", 48, 5100),
			dependencyService("调试-PostgreSQL", "acquire connection", "db", 12, 5000, map[string]any{"db.system": "postgresql", "db.namespace": "orders"}),
		},
		2, 82, 503, 504, "PoolAcquireTimeoutError", "timeout acquiring a database connection after 5000ms", "dbpool.Acquire\nrepository.CreateOrder\norders.Submit",
		[]scenarioLog{
			logLine("调试-订单服务", "ERROR", "database pool acquire timeout elapsed_ms=5000 active=40 idle=0 max=40", map[string]any{"db.pool.name": "orders-primary"}),
			logLine("调试-PostgreSQL", "FATAL", "remaining connection slots are reserved for non-replication superuser connections", map[string]any{"db.namespace": "orders"}),
		},
		"upstream request failed while waiting for order persistence status=504 retry_count=2",
		[]scenarioLog{
			logLine("调试-支付服务", "WARN", "payment provider latency above baseline p95_ms=420 threshold_ms=400", map[string]any{"provider": "sandbox-bank"}),
		},
		[]scenarioMetric{
			metric("metrics", "db.client.connections.usage", "{connection}", 18, 40, 0.8, map[string]any{"pool.name": "orders-primary", "state": "used"}),
			metric("metrics", "db.client.connections.usage", "{connection}", 12, 0, 0.2, map[string]any{"pool.name": "orders-primary", "state": "idle"}),
			metric("metrics", "db.client.connections.max", "{connection}", 40, 40, 0, map[string]any{"pool.name": "orders-primary"}),
			counter("metrics", "db.client.connections.timeouts", "{timeout}", 2, 184, 5, map[string]any{"pool.name": "orders-primary"}),
			metric("infrastructure", "system.cpu.utilization", "1", 0.32, 0.37, 0.02, map[string]any{"host.name": "scry-debug-db-01"}),
		}, false,
		ScenarioGroundTruth{
			RootServices:      []string{"调试-PostgreSQL", "调试-订单服务"},
			RootCause:         "订单服务的 PostgreSQL 连接池达到 max=40 且 idle=0，连接获取等待 5 秒后超时；数据库侧同时接近连接上限。",
			ExpectedDiagnosis: "根因是 PostgreSQL 连接池耗尽，而非数据库 CPU 或支付服务延迟。",
			KeyEvidence:       []string{"db.client.connections.usage used=40", "idle=0", "连接获取超时日志", "PostgreSQL remaining connection slots 日志"},
			Remediation:       []string{"先识别并终止泄漏或长期空闲连接", "限制并发并恢复连接池可用容量", "核对连接池上限与数据库 max_connections 的容量预算"},
			Verification:      []string{"连接获取超时归零", "idle 连接恢复", "订单 P95 和 5xx 恢复"},
			UnsafeActions:     []string{"未核对数据库容量就无限增大连接池", "直接重启数据库导致扩大中断"},
		},
	),
	makeScenario(
		ScenarioPostgresBloat, "PostgreSQL 表膨胀与自动清理滞后", "数据库", "高级", "订单历史查询逐步变慢，写入仍然成功，数据库 CPU 中等。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "GET /api/orders/history", 22, 2380),
			httpService("调试-订单服务", "GET /orders/history", 38, 2320),
			dependencyService("调试-PostgreSQL", "SELECT order_history", "db", 45, 2210, map[string]any{"db.system": "postgresql", "db.namespace": "orders", "db.collection.name": "order_history"}),
		},
		2, 76, 500, 504, "QueryTimeoutError", "query exceeded statement_timeout of 2000ms", "postgres.Query\nrepository.ListHistory\norders.GetHistory",
		[]scenarioLog{
			logLine("调试-PostgreSQL", "WARNING", "automatic vacuum of table orders.order_history skipped: lock not available", map[string]any{"db.collection.name": "order_history"}),
			logLine("调试-订单服务", "ERROR", "history query canceled due to statement timeout duration_ms=2001", map[string]any{"db.operation.name": "SELECT"}),
		},
		"order history dependency exceeded deadline status=504",
		[]scenarioLog{
			logLine("调试-PostgreSQL", "INFO", "checkpoint complete wrote_buffers=114 duration_ms=284", map[string]any{"component": "checkpointer"}),
		},
		[]scenarioMetric{
			metric("metrics", "postgresql.table.dead_rows", "{row}", 1800, 18400000, 260000, map[string]any{"database": "orders", "table": "order_history"}),
			metric("metrics", "postgresql.table.live_rows", "{row}", 9300000, 9400000, 20000, map[string]any{"database": "orders", "table": "order_history"}),
			metric("metrics", "postgresql.table.size", "By", 2.4e9, 18.7e9, 1e8, map[string]any{"database": "orders", "table": "order_history"}),
			metric("metrics", "postgresql.autovacuum.age", "s", 420, 172800, 1800, map[string]any{"database": "orders", "table": "order_history"}),
			metric("infrastructure", "system.cpu.utilization", "1", 0.38, 0.56, 0.03, map[string]any{"host.name": "scry-debug-db-01"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-PostgreSQL"}, RootCause: "order_history 表死元组大量累积，自动清理因锁竞争长期滞后，导致表膨胀和查询超时。",
			ExpectedDiagnosis: "根因是表膨胀与 autovacuum 滞后，不是数据库 CPU 饱和。",
			KeyEvidence:       []string{"dead_rows 约 1840 万", "表体积异常增长", "autovacuum.age 约 48 小时", "vacuum skipped 日志"},
			Remediation:       []string{"解除阻塞 autovacuum 的长事务或锁", "在受控窗口执行 VACUUM ANALYZE，必要时使用在线重整", "调整表级 autovacuum 阈值"},
			Verification:      []string{"dead_rows 下降", "查询计划与 P95 恢复", "自动清理周期恢复"},
			UnsafeActions:     []string{"业务高峰直接执行阻塞式 VACUUM FULL", "仅增加 statement_timeout 掩盖问题"},
		},
	),
	makeScenario(
		ScenarioRedisMaxClients, "Valkey/Redis 客户端连接上限", "缓存", "进阶", "购物车接口大量失败，应用 CPU 和 Redis 内存仍有余量。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "PUT /api/cart/items", 20, 620),
			httpService("调试-购物车服务", "PUT /cart/items", 34, 580),
			dependencyService("调试-Valkey", "HSET cart", "redis", 4, 510, map[string]any{"db.system": "redis", "db.namespace": "cart", "server.address": "valkey-cart.internal"}),
		},
		2, 88, 503, 503, "RedisConnectionError", "ERR max number of clients reached", "redis.Dial\ncart.Store\ncart.UpdateItem",
		[]scenarioLog{
			logLine("调试-Valkey", "ERROR", "Error accepting a client connection: max number of clients reached", map[string]any{"server.port": 6379}),
			logLine("调试-购物车服务", "ERROR", "cache command failed command=HSET error=ERR max number of clients reached", map[string]any{"cache.cluster": "cart-primary"}),
		},
		"cart dependency unavailable status=503 retry_count=1",
		[]scenarioLog{
			logLine("调试-购物车服务", "INFO", "cart reconciliation completed scanned=320 corrected=0", map[string]any{"job.name": "cart-reconcile"}),
		},
		[]scenarioMetric{
			metric("metrics", "redis.clients.connected", "{client}", 420, 10000, 15, map[string]any{"cluster": "cart-primary"}),
			metric("metrics", "redis.clients.max", "{client}", 10000, 10000, 0, map[string]any{"cluster": "cart-primary"}),
			counter("metrics", "redis.connections.rejected", "{connection}", 0, 2830, 40, map[string]any{"cluster": "cart-primary"}),
			metric("metrics", "redis.memory.utilization", "1", 0.42, 0.51, 0.01, map[string]any{"cluster": "cart-primary"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-Valkey"}, RootCause: "Valkey/Redis connected_clients 达到 maxclients=10000，新连接被拒绝。",
			ExpectedDiagnosis: "根因是客户端连接数上限耗尽，内存并未耗尽。",
			KeyEvidence:       []string{"connected=10000 与 max=10000", "rejected connections 激增", "max number of clients reached 日志", "内存利用率仅约 51%"},
			Remediation:       []string{"修复客户端连接泄漏并启用连接复用", "回收空闲连接", "在验证文件描述符和容量后审慎调整 maxclients"},
			Verification:      []string{"拒绝连接停止增长", "连接数回落并保留余量", "购物车 5xx 恢复"},
			UnsafeActions:     []string{"仅提高 maxclients 而不处理连接泄漏"},
		},
	),
	makeScenario(
		ScenarioRedisPersistence, "Redis 持久化 fork 延迟", "缓存", "高级", "缓存读写周期性出现秒级延迟，错误集中在固定时间窗口。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "GET /api/sessions/current", 18, 1850),
			httpService("调试-会话服务", "GET /sessions/current", 28, 1810),
			dependencyService("调试-Valkey", "GET session", "redis", 3, 1740, map[string]any{"db.system": "redis", "db.namespace": "sessions"}),
		},
		2, 68, 500, 504, "RedisTimeoutError", "command timed out after 1500ms during background save", "redis.Command\nsession.Load\nsession.GetCurrent",
		[]scenarioLog{
			logLine("调试-Valkey", "NOTICE", "Background saving started by pid 1842", map[string]any{"persistence": "rdb"}),
			logLine("调试-Valkey", "WARNING", "fork operation took 1684 milliseconds; latency spike may occur", map[string]any{"persistence": "rdb"}),
			logLine("调试-会话服务", "ERROR", "session cache timeout command=GET elapsed_ms=1501", map[string]any{"cache.cluster": "session-primary"}),
		},
		"session lookup exceeded upstream deadline status=504",
		[]scenarioLog{
			logLine("调试-Valkey", "INFO", "10 changes in 300 seconds. Saving...", map[string]any{"persistence": "rdb"}),
		},
		[]scenarioMetric{
			metric("metrics", "redis.latest_fork.duration", "ms", 18, 1684, 40, map[string]any{"cluster": "session-primary"}),
			metric("metrics", "redis.rdb.background_save.active", "1", 0, 1, 0, map[string]any{"cluster": "session-primary"}),
			metric("metrics", "redis.command.duration", "ms", 2.5, 1460, 80, map[string]any{"cluster": "session-primary", "command": "GET"}),
			metric("infrastructure", "system.memory.utilization", "1", 0.55, 0.92, 0.01, map[string]any{"host.name": "scry-debug-cache-01"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-Valkey"}, RootCause: "大内存实例执行 RDB 后台保存时 fork 耗时约 1.7 秒，引发缓存命令延迟尖峰。",
			ExpectedDiagnosis: "根因是持久化 fork 暂停和内存压力造成的周期性延迟。",
			KeyEvidence:       []string{"latest_fork.duration 约 1684ms", "RDB background save active", "延迟与保存窗口对齐", "主机内存利用率约 92%"},
			Remediation:       []string{"将持久化安排到专用副本或调整策略", "降低实例内存规模或分片", "为 fork 保留足够内存"},
			Verification:      []string{"fork 时长下降", "保存期间命令 P99 无尖峰", "会话超时归零"},
			UnsafeActions:     []string{"直接关闭所有持久化而不确认数据耐久要求"},
		},
	),
	makeScenario(
		ScenarioKafkaLag, "Kafka 消费积压与频繁再均衡", "消息队列", "高级", "订单已受理但状态长时间不更新，生产端请求正常。",
		[]string{},
		[]scenarioService{
			httpService("调试-订单服务", "POST /orders", 42, 48),
			dependencyService("调试-Kafka", "orders.events publish", "messaging", 8, 12, map[string]any{"messaging.system": "kafka", "messaging.destination.name": "orders.events"}),
			dependencyService("调试-履约消费者", "orders.events process", "messaging", 65, 4200, map[string]any{"messaging.system": "kafka", "messaging.destination.name": "orders.events", "messaging.consumer.group.name": "fulfillment-v2"}),
		},
		2, 72, 500, 202, "MessageProcessingTimeout", "processing exceeded max.poll.interval.ms after downstream stall", "consumer.Process\nfulfillment.Reserve\nworker.Run",
		[]scenarioLog{
			logLine("调试-履约消费者", "WARN", "consumer group rebalance in progress reason=member_lost generation=418", map[string]any{"consumer.group": "fulfillment-v2"}),
			logLine("调试-履约消费者", "ERROR", "processing deadline exceeded partition=3 offset=928144 elapsed_ms=4201", map[string]any{"messaging.destination.partition.id": "3"}),
		},
		"event accepted for asynchronous processing",
		[]scenarioLog{
			logLine("调试-Kafka", "INFO", "log segment rolled topic=orders.events partition=1", map[string]any{"component": "log"}),
		},
		[]scenarioMetric{
			metric("messaging", "kafka.consumer.group.lag", "{message}", 24, 186420, 2400, map[string]any{"topic": "orders.events", "consumer_group": "fulfillment-v2", "partition": "3"}),
			counter("messaging", "kafka.consumer.group.rebalances", "{rebalance}", 1, 47, 2, map[string]any{"consumer_group": "fulfillment-v2"}),
			metric("messaging", "kafka.consumer.records.rate", "{message}/s", 860, 72, 8, map[string]any{"topic": "orders.events", "consumer_group": "fulfillment-v2"}),
			metric("messaging", "kafka.producer.records.rate", "{message}/s", 810, 835, 12, map[string]any{"topic": "orders.events"}),
			metric("infrastructure", "process.cpu.utilization", "1", 0.28, 0.16, 0.02, map[string]any{"service.name": "调试-履约消费者"}),
		}, true,
		ScenarioGroundTruth{
			RootServices: []string{"调试-履约消费者"}, RootCause: "履约消费者处理阻塞并超过 max.poll.interval，成员反复退出消费者组，引发再均衡和积压扩大。",
			ExpectedDiagnosis: "生产端正常，根因位于 fulfillment-v2 消费组的处理超时与再均衡循环。",
			KeyEvidence:       []string{"lag 约 18.6 万", "生产速率显著高于消费速率", "rebalance 计数快速增长", "partition=3 处理超时日志"},
			Remediation:       []string{"隔离并修复阻塞的下游处理", "调整批量大小和并发", "在确认处理上界后调整 poll 参数"},
			Verification:      []string{"消费速率超过生产速率", "lag 持续下降", "再均衡停止", "订单状态延迟恢复"},
			UnsafeActions:     []string{"盲目重置 offset 跳过未处理订单", "直接扩容而不处理阻塞依赖"},
		},
	),
	makeScenario(
		ScenarioTLSExpiry, "外部服务 TLS 证书过期", "网络与协议", "进阶", "支付请求从某一时刻起全部失败，外部地址仍可连通。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "POST /api/payments", 26, 380),
			httpService("调试-支付服务", "POST /payments", 52, 340),
			dependencyService("调试-银行网关", "TLS handshake bank.example", "tls", 38, 260, map[string]any{"server.address": "bank-gateway.example", "server.port": 443}),
		},
		2, 100, 495, 502, "CertificateExpiredError", "x509: certificate has expired or is not yet valid", "tls.VerifyCertificate\nbank.Client.Do\npayment.Authorize",
		[]scenarioLog{
			logLine("调试-支付服务", "ERROR", "TLS handshake failed remote=bank-gateway.example:443 error=certificate has expired", map[string]any{"tls.peer.subject": "CN=bank-gateway.example"}),
			logLine("调试-证书探针", "ERROR", "certificate validation failed not_after=2026-07-19T00:00:00Z", map[string]any{"server.address": "bank-gateway.example"}),
		},
		"payment provider connection failed status=502",
		[]scenarioLog{
			logLine("调试-网络探针", "INFO", "tcp connect succeeded remote=bank-gateway.example:443 latency_ms=23", map[string]any{"probe.type": "tcp"}),
		},
		[]scenarioMetric{
			metric("metrics", "tls.certificate.validity.remaining", "s", 2592000, -3600, 0, map[string]any{"server.address": "bank-gateway.example"}),
			counter("metrics", "tls.handshake.failures", "{failure}", 0, 842, 10, map[string]any{"server.address": "bank-gateway.example"}),
			metric("metrics", "network.connect.duration", "ms", 21, 23, 2, map[string]any{"server.address": "bank-gateway.example", "network.transport": "tcp"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-银行网关"}, RootCause: "bank-gateway.example 的服务端证书已过期，TCP 可达但 TLS 校验失败。",
			ExpectedDiagnosis: "根因是证书有效期，而不是 DNS、网络不可达或支付服务业务错误。",
			KeyEvidence:       []string{"certificate validity remaining 为负", "x509 expired 日志", "TLS 握手失败计数", "TCP connect 成功"},
			Remediation:       []string{"更新并部署正确证书链", "确认客户端信任链和系统时间", "建立到期前告警"},
			Verification:      []string{"TLS 握手成功", "证书有效期恢复", "支付成功率恢复"},
			UnsafeActions:     []string{"关闭证书校验", "长期使用不安全跳过验证参数"},
		},
	),
	makeScenario(
		ScenarioDNSFailure, "DNS 解析失败", "网络与协议", "进阶", "通知接口超时，直接访问目标 IP 可用，域名请求失败。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "POST /api/notifications", 20, 2380),
			httpService("调试-通知服务", "POST /notifications", 36, 2320),
			dependencyService("调试-DNS", "resolve smtp.internal", "dns", 5, 2200, map[string]any{"dns.question.name": "smtp.internal", "dns.question.type": "A"}),
		},
		2, 94, 503, 504, "DNSResolutionError", "lookup smtp.internal on 10.96.0.10:53: server misbehaving", "resolver.LookupHost\nsmtp.Dial\nnotification.Send",
		[]scenarioLog{
			logLine("调试-通知服务", "ERROR", "DNS lookup failed host=smtp.internal resolver=10.96.0.10:53 error=SERVFAIL", map[string]any{"dns.response_code": "SERVFAIL"}),
			logLine("调试-DNS", "WARN", "upstream query timeout zone=internal attempts=3", map[string]any{"dns.question.name": "smtp.internal"}),
		},
		"notification dependency name resolution timed out status=504",
		[]scenarioLog{
			logLine("调试-网络探针", "INFO", "tcp connect succeeded remote=10.20.8.14:25 latency_ms=4", map[string]any{"server.address": "10.20.8.14"}),
		},
		[]scenarioMetric{
			metric("metrics", "dns.lookup.duration", "ms", 4, 2200, 50, map[string]any{"dns.question.name": "smtp.internal"}),
			counter("metrics", "dns.lookup.failures", "{failure}", 0, 1260, 20, map[string]any{"dns.response_code": "SERVFAIL"}),
			metric("metrics", "network.connect.duration", "ms", 5, 4, 1, map[string]any{"server.address": "10.20.8.14"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-DNS"}, RootCause: "集群 DNS 对 internal 区域的上游查询返回 SERVFAIL，smtp.internal 无法解析；目标 IP 网络可达。",
			ExpectedDiagnosis: "根因是 DNS 解析链路，而不是 SMTP 服务或底层 TCP 网络。",
			KeyEvidence:       []string{"DNS lookup 约 2200ms", "SERVFAIL 计数", "resolver upstream timeout", "目标 IP TCP 探测成功"},
			Remediation:       []string{"检查 DNS 上游和区域转发配置", "恢复可用 resolver 副本", "清理错误缓存并验证记录"},
			Verification:      []string{"域名解析成功", "SERVFAIL 停止增长", "通知请求恢复"},
			UnsafeActions:     []string{"将临时 IP 硬编码为长期配置"},
		},
	),
	makeScenario(
		ScenarioGRPCDeadline, "gRPC 截止时间不匹配", "网络与协议", "高级", "推荐接口在约 800ms 时稳定失败，下游最终仍能完成计算。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "GET /api/recommendations", 24, 860),
			httpService("调试-推荐服务", "GET /recommendations", 40, 820),
			dependencyService("调试-特征服务", "feature.v1.Feature/GetBatch", "grpc", 120, 960, map[string]any{"rpc.system": "grpc", "rpc.service": "feature.v1.Feature", "rpc.method": "GetBatch"}),
		},
		2, 86, 4, 504, "DeadlineExceeded", "rpc error: code = DeadlineExceeded desc = context deadline exceeded", "grpc.Invoke\nfeatures.GetBatch\nrecommendation.Build",
		[]scenarioLog{
			logLine("调试-推荐服务", "ERROR", "gRPC call failed service=feature.v1.Feature method=GetBatch code=DeadlineExceeded deadline_ms=800", map[string]any{"rpc.grpc.status_code": 4}),
			logLine("调试-特征服务", "INFO", "GetBatch completed duration_ms=958 rows=240", map[string]any{"rpc.method": "GetBatch"}),
		},
		"feature dependency exceeded client deadline status=504",
		[]scenarioLog{
			logLine("调试-推荐服务", "INFO", "model cache hit ratio=0.93", map[string]any{"component": "model-cache"}),
		},
		[]scenarioMetric{
			metric("metrics", "rpc.client.duration", "ms", 128, 802, 8, map[string]any{"rpc.service": "feature.v1.Feature", "rpc.method": "GetBatch"}),
			metric("metrics", "rpc.server.duration", "ms", 118, 958, 20, map[string]any{"rpc.service": "feature.v1.Feature", "rpc.method": "GetBatch"}),
			counter("metrics", "rpc.client.errors", "{error}", 0, 960, 15, map[string]any{"rpc.grpc.status_code": "DEADLINE_EXCEEDED"}),
			metric("infrastructure", "process.cpu.utilization", "1", 0.35, 0.47, 0.02, map[string]any{"service.name": "调试-特征服务"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-推荐服务", "调试-特征服务"}, RootCause: "推荐服务的 800ms gRPC deadline 低于特征服务约 960ms 的实际处理时间，造成稳定的 DeadlineExceeded。",
			ExpectedDiagnosis: "根因是客户端截止时间与下游延迟预算不匹配，同时下游存在性能退化。",
			KeyEvidence:       []string{"客户端在约 802ms 失败", "服务端约 958ms 完成", "grpc status DEADLINE_EXCEEDED", "CPU 未饱和"},
			Remediation:       []string{"优化 GetBatch 延迟或缩小请求批量", "按端到端预算调整 deadline", "避免无退避重试放大流量"},
			Verification:      []string{"服务端 P99 低于 deadline", "DeadlineExceeded 归零", "推荐接口成功率恢复"},
			UnsafeActions:     []string{"无限增大 deadline", "立即增加高频重试"},
		},
	),
	makeScenario(
		ScenarioRateLimit, "外部 API 速率限制", "依赖与流控", "进阶", "地址校验请求在流量突发时失败，稍后重试可恢复。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "POST /api/addresses/validate", 18, 420),
			httpService("调试-地址服务", "POST /addresses/validate", 32, 380),
			httpService("调试-地图供应商", "POST /v2/geocode", 140, 260),
		},
		2, 78, 429, 503, "RateLimitExceeded", "provider returned HTTP 429 retry-after=30", "maps.Client.Geocode\naddress.Validate\napi.Handle",
		[]scenarioLog{
			logLine("调试-地址服务", "WARN", "provider rate limited status=429 retry_after_s=30 limit=600 remaining=0", map[string]any{"provider": "geo-v2"}),
			logLine("调试-地图供应商", "WARN", "quota exceeded key_scope=tenant minute_limit=600", map[string]any{"http.response.status_code": 429}),
		},
		"address validation unavailable after provider rate limit status=503",
		[]scenarioLog{
			logLine("调试-地址服务", "INFO", "local postal-code cache hit ratio=0.84", map[string]any{"cache.name": "postal-code"}),
		},
		[]scenarioMetric{
			metric("metrics", "http.client.request.rate", "{request}/s", 6.2, 18.4, 0.6, map[string]any{"server.address": "geo-provider.example"}),
			metric("metrics", "http.client.rate_limit.remaining", "{request}", 280, 0, 0, map[string]any{"server.address": "geo-provider.example"}),
			counter("metrics", "http.client.responses", "{response}", 2, 1840, 20, map[string]any{"http.response.status_code": 429, "server.address": "geo-provider.example"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-地图供应商"}, RootCause: "地址服务在突发流量下超过外部地图 API 每分钟 600 次配额，收到 HTTP 429。",
			ExpectedDiagnosis: "根因是供应商限流，不是地图服务不可达。",
			KeyEvidence:       []string{"HTTP 429", "remaining=0", "retry-after=30", "请求速率高于配额"},
			Remediation:       []string{"遵守 Retry-After 并指数退避", "启用请求合并和缓存", "按租户限流并申请合理配额"},
			Verification:      []string{"429 比例下降", "请求速率受控", "地址校验成功率恢复"},
			UnsafeActions:     []string{"无退避立即重试", "轮换密钥规避供应商配额"},
		},
	),
	makeScenario(
		ScenarioSchemaMismatch, "响应结构不兼容", "接口契约", "高级", "商品详情接口在下游发布后开始返回 500，但下游接口自身显示 200。",
		[]string{"errors"},
		[]scenarioService{
			httpService("调试-边缘网关", "GET /api/products/{id}", 20, 180),
			httpService("调试-商品聚合服务", "GET /products/{id}", 36, 150),
			httpService("调试-目录服务", "GET /v3/catalog/items/{id}", 52, 62),
		},
		1, 92, 500, 500, "SchemaValidationError", "expected price.amount as number, received string", "schema.ParsePrice\ncatalog.DecodeResponse\nproduct.Get",
		[]scenarioLog{
			logLine("调试-商品聚合服务", "ERROR", "response validation failed path=price.amount expected=number actual=string upstream_status=200 schema=v2", map[string]any{"peer.service.version": "3.4.0"}),
			logLine("调试-目录服务", "INFO", "response serialized schema_version=v3 compatibility_mode=false", map[string]any{"service.version": "3.4.0"}),
		},
		"catalog response could not be decoded status=500",
		[]scenarioLog{
			logLine("调试-目录服务", "INFO", "catalog lookup completed cache_hit=false duration_ms=58", map[string]any{"db.system": "postgresql"}),
		},
		[]scenarioMetric{
			counter("metrics", "application.response.validation.errors", "{error}", 0, 1240, 15, map[string]any{"service.name": "调试-商品聚合服务", "field": "price.amount"}),
			metric("metrics", "http.client.response.success_ratio", "1", 0.999, 0.998, 0.001, map[string]any{"peer.service": "调试-目录服务"}),
			metric("metrics", "http.server.error_ratio", "1", 0.002, 0.92, 0.01, map[string]any{"service.name": "调试-商品聚合服务"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-目录服务", "调试-商品聚合服务"}, RootCause: "目录服务 v3.4.0 将 price.amount 从 number 改为 string 且关闭兼容模式，商品聚合服务仍按 v2 契约解析。",
			ExpectedDiagnosis: "下游 HTTP 200，但响应契约不兼容导致上游反序列化失败。",
			KeyEvidence:       []string{"upstream_status=200", "expected number actual string", "schema v2/v3 差异", "目录服务发布版本 3.4.0"},
			Remediation:       []string{"回滚不兼容发布或恢复兼容字段", "更新消费者 schema 并进行契约测试", "为版本变更增加灰度"},
			Verification:      []string{"响应验证错误归零", "聚合服务 5xx 恢复", "契约测试通过"},
			UnsafeActions:     []string{"把结构验证整体关闭", "在不了解金额语义时强制类型转换"},
		},
	),
	makeScenario(
		ScenarioMemoryLeak, "内存泄漏与 OOM 重启", "资源", "高级", "搜索服务内存持续上升并周期性重启，重启后短暂恢复。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "GET /api/search", 22, 1650),
			httpService("调试-搜索服务", "GET /search", 68, 1520),
		},
		1, 74, 137, 503, "ContainerTerminated", "container terminated with exit code 137 (OOMKilled)", "runtime.Allocate\nsearch.Aggregate\nhttp.Handle",
		[]scenarioLog{
			logLine("调试-搜索服务", "WARN", "heap growth detected rss_bytes=2055208960 limit_bytes=2147483648 gc_reclaimed_ratio=0.04", map[string]any{"process.pid": 28}),
			logLine("调试-容器运行时", "ERROR", "container search-api terminated reason=OOMKilled exit_code=137 restart_count=6", map[string]any{"container.name": "search-api"}),
		},
		"search upstream connection reset during container restart status=503",
		[]scenarioLog{
			logLine("调试-搜索服务", "INFO", "index refresh completed segments=18 duration_ms=284", map[string]any{"job.name": "index-refresh"}),
		},
		[]scenarioMetric{
			metric("infrastructure", "process.memory.usage", "By", 620e6, 2.055e9, 2e7, map[string]any{"service.name": "调试-搜索服务"}),
			metric("infrastructure", "container.memory.limit", "By", 2.147e9, 2.147e9, 0, map[string]any{"container.name": "search-api"}),
			counter("infrastructure", "container.restart.count", "{restart}", 0, 6, 0.2, map[string]any{"container.name": "search-api"}),
			counter("infrastructure", "system.oom.events", "{event}", 0, 6, 0, map[string]any{"container.name": "search-api"}),
			metric("metrics", "process.runtime.gc.reclaimed_ratio", "1", 0.62, 0.04, 0.01, map[string]any{"service.name": "调试-搜索服务"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-搜索服务"}, RootCause: "搜索服务堆内存持续增长且 GC 回收率极低，达到 2GiB 容器限制后被 OOMKilled 并重启。",
			ExpectedDiagnosis: "根因是应用内存泄漏导致 OOM，而不是普通流量峰值。",
			KeyEvidence:       []string{"RSS 接近 limit", "GC reclaimed ratio 约 4%", "OOMKilled exit 137", "restart_count 增长"},
			Remediation:       []string{"抓取并对比堆快照定位持续持有对象", "临时限制高内存请求并扩容缓解", "修复泄漏后滚动发布"},
			Verification:      []string{"长时间内存曲线稳定", "OOM 事件不再增长", "重启计数稳定", "搜索延迟恢复"},
			UnsafeActions:     []string{"仅无限提高内存限制", "未保留诊断信息就反复重启"},
		},
	),
	makeScenario(
		ScenarioCPUSaturation, "CPU 与线程池饱和", "资源", "进阶", "报价接口延迟和超时随并发同步上升，依赖服务响应正常。",
		[]string{},
		[]scenarioService{
			httpService("调试-边缘网关", "POST /api/quotes", 24, 2450),
			httpService("调试-报价服务", "POST /quotes", 70, 2320),
			httpService("调试-定价服务", "POST /pricing/calculate", 48, 54),
		},
		1, 84, 503, 504, "RejectedExecutionError", "worker queue capacity 500 exhausted", "executor.Submit\nquote.Calculate\napi.CreateQuote",
		[]scenarioLog{
			logLine("调试-报价服务", "ERROR", "request rejected active_threads=64 max_threads=64 queue_depth=500 queue_capacity=500", map[string]any{"executor.name": "quote-worker"}),
			logLine("调试-报价服务", "WARN", "event loop delay p99_ms=842", map[string]any{"runtime": "nodejs"}),
		},
		"quote worker saturated status=504",
		[]scenarioLog{
			logLine("调试-定价服务", "INFO", "pricing calculation completed duration_ms=51 rules=28", map[string]any{"pricing.version": "2026.07"}),
		},
		[]scenarioMetric{
			metric("infrastructure", "process.cpu.utilization", "1", 0.38, 0.98, 0.01, map[string]any{"service.name": "调试-报价服务"}),
			metric("infrastructure", "system.cpu.load_average.1m", "{thread}", 2.1, 18.4, 0.4, map[string]any{"host.name": "scry-debug-app-02"}),
			metric("metrics", "executor.threads.active", "{thread}", 18, 64, 0, map[string]any{"executor.name": "quote-worker"}),
			metric("metrics", "executor.threads.max", "{thread}", 64, 64, 0, map[string]any{"executor.name": "quote-worker"}),
			metric("metrics", "executor.queue.depth", "{task}", 12, 500, 4, map[string]any{"executor.name": "quote-worker"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-报价服务"}, RootCause: "报价服务 CPU 接近 100%，64 个工作线程全部占用，队列达到 500 后拒绝新任务。",
			ExpectedDiagnosis: "根因是报价服务自身 CPU 和线程池饱和，定价依赖正常。",
			KeyEvidence:       []string{"process CPU 约 98%", "active=max=64", "queue depth=capacity=500", "定价服务约 51ms 正常"},
			Remediation:       []string{"定位 CPU 热点并限制并发", "优化计算或拆分批次", "在容量模型允许时水平扩容"},
			Verification:      []string{"CPU 保持安全余量", "队列深度回落", "拒绝计数停止", "报价 P95 恢复"},
			UnsafeActions:     []string{"只扩大线程池导致更多上下文切换"},
		},
	),
	makeScenario(
		ScenarioDiskFull, "日志增长导致磁盘耗尽", "资源", "进阶", "审计写入失败，节点上的其他服务随后也出现写文件错误。",
		[]string{"disk_full"},
		[]scenarioService{
			httpService("调试-边缘网关", "POST /api/audit/events", 18, 420),
			httpService("调试-审计服务", "POST /audit/events", 38, 360),
			dependencyService("调试-本地存储", "append audit.log", "filesystem", 8, 290, map[string]any{"file.path": "/var/log/scry/audit.log"}),
		},
		2, 96, 507, 507, "NoSpaceLeftOnDevice", "write /var/log/scry/audit.log: no space left on device", "os.Write\naudit.Append\napi.Record",
		[]scenarioLog{
			logLine("调试-审计服务", "ERROR", "audit append failed path=/var/log/scry/audit.log error=ENOSPC", map[string]any{"error.type": "NoSpaceLeftOnDevice"}),
			logLine("调试-日志轮转器", "WARN", "rotation skipped: destination filesystem has insufficient free space retained_files=84", map[string]any{"mountpoint": "/var/log/scry"}),
		},
		"audit event could not be persisted status=507",
		[]scenarioLog{
			logLine("调试-审计服务", "INFO", "audit batch opened batch_size=100", map[string]any{"component": "batcher"}),
		},
		[]scenarioMetric{
			metric("infrastructure", "system.filesystem.utilization", "1", 0.56, 0.998, 0.001, map[string]any{"mountpoint": "/var/log/scry", "device": "/dev/vda2"}),
			metric("infrastructure", "system.filesystem.usage", "By", 32e9, 79.8e9, 4e7, map[string]any{"mountpoint": "/var/log/scry", "state": "used"}),
			metric("infrastructure", "system.filesystem.usage", "By", 48e9, 160e6, 2e7, map[string]any{"mountpoint": "/var/log/scry", "state": "free"}),
			counter("infrastructure", "system.filesystem.write.errors", "{error}", 0, 682, 8, map[string]any{"mountpoint": "/var/log/scry"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-本地存储", "调试-日志轮转器"}, RootCause: "/var/log/scry 分区因审计日志未正常轮转达到 99.8%，写入返回 ENOSPC。",
			ExpectedDiagnosis: "根因是日志分区耗尽及轮转失败。",
			KeyEvidence:       []string{"filesystem utilization 99.8%", "free bytes 约 160MB", "ENOSPC", "retained_files=84 且轮转跳过"},
			Remediation:       []string{"保留取证后压缩或转移过期日志释放空间", "修复轮转和保留策略", "增加磁盘容量告警"},
			Verification:      []string{"文件系统恢复安全余量", "写错误停止增长", "轮转成功", "审计写入恢复"},
			UnsafeActions:     []string{"不确认范围就删除全部审计日志", "直接清空当前活动文件导致取证丢失"},
		},
	),
	makeScenario(
		ScenarioDiskIO, "磁盘 I/O 延迟抖动", "资源", "高级", "库存更新间歇性变慢，CPU 和内存正常，数据库查询等待 I/O。",
		[]string{"slow", "disk_io"},
		[]scenarioService{
			httpService("调试-边缘网关", "PATCH /api/inventory", 20, 3280),
			httpService("调试-库存服务", "PATCH /inventory", 42, 3220),
			dependencyService("调试-库存数据库", "UPDATE inventory", "db", 32, 3090, map[string]any{"db.system": "postgresql", "db.namespace": "inventory"}),
		},
		2, 74, 500, 504, "StorageTimeoutError", "database write stalled waiting for data file I/O", "postgres.Exec\ninventory.Update\napi.Handle",
		[]scenarioLog{
			logLine("调试-库存数据库", "WARN", "slow write wait_event=DataFileExtend duration_ms=2874 relation=inventory_stock", map[string]any{"db.postgresql.wait_event": "DataFileExtend"}),
			logLine("调试-节点代理", "WARN", "block device latency above threshold device=vda await_ms=286 util=99.4", map[string]any{"device": "vda"}),
		},
		"inventory database write exceeded deadline status=504",
		[]scenarioLog{
			logLine("调试-库存数据库", "INFO", "connection pool healthy active=14 idle=18 max=40", map[string]any{"pool.name": "inventory-primary"}),
		},
		[]scenarioMetric{
			metric("infrastructure", "system.disk.io_time", "1", 0.18, 0.994, 0.002, map[string]any{"device": "vda"}),
			metric("infrastructure", "system.disk.operation.duration", "ms", 4.2, 286, 12, map[string]any{"device": "vda", "direction": "write"}),
			metric("infrastructure", "system.cpu.utilization", "1", 0.38, 0.44, 0.02, map[string]any{"host.name": "scry-debug-db-02"}),
			metric("infrastructure", "system.cpu.utilization", "1", 0.02, 0.41, 0.02, map[string]any{"host.name": "scry-debug-db-02", "state": "wait"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-库存数据库"}, RootCause: "数据库节点 vda 设备利用率约 99.4%，写延迟约 286ms，查询等待 DataFileExtend。",
			ExpectedDiagnosis: "根因是块设备 I/O 饱和，而不是 CPU、内存或连接池。",
			KeyEvidence:       []string{"disk io_time 约 99.4%", "write await 约 286ms", "CPU iowait 抬升", "DataFileExtend 等待", "连接池健康"},
			Remediation:       []string{"识别高 I/O 工作负载并限速或错峰", "检查云盘性能额度和设备错误", "优化写放大并扩展存储 IOPS"},
			Verification:      []string{"await 和 util 回落", "DataFileExtend 等待消失", "库存更新 P95 恢复"},
			UnsafeActions:     []string{"仅重启数据库", "在 I/O 饱和时启动全量维护任务"},
		},
	),
	makeScenario(
		ScenarioConfigDrift, "配置漂移导致鉴权失败", "配置", "进阶", "三个认证实例中仅一个持续返回 token 签名错误。",
		[]string{"config_drift"},
		[]scenarioService{
			httpService("调试-边缘网关", "POST /api/session/refresh", 18, 140),
			httpService("调试-认证服务", "POST /session/refresh", 28, 105),
		},
		1, 36, 401, 401, "JWTSignatureError", "signature verification failed for kid=key-2026-07", "jwt.Verify\nauth.Refresh\napi.Handle",
		[]scenarioLog{
			logLine("调试-认证服务", "ERROR", "JWT signature verification failed kid=key-2026-07 instance=auth-03 config_revision=8f2c1a", map[string]any{"service.instance.id": "auth-03"}),
			logLine("调试-配置代理", "WARN", "configuration checksum differs from desired revision instance=auth-03 desired=4d91be actual=8f2c1a", map[string]any{"service.instance.id": "auth-03"}),
		},
		"authentication refresh rejected status=401 instance=auth-03",
		[]scenarioLog{
			logLine("调试-认证服务", "INFO", "JWT verified instance=auth-01 kid=key-2026-07", map[string]any{"service.instance.id": "auth-01"}),
			logLine("调试-认证服务", "INFO", "JWT verified instance=auth-02 kid=key-2026-07", map[string]any{"service.instance.id": "auth-02"}),
		},
		[]scenarioMetric{
			metric("metrics", "deployment.config.revision.match", "1", 1, 0, 0, map[string]any{"service.name": "调试-认证服务", "service.instance.id": "auth-03"}),
			metric("metrics", "http.server.error_ratio", "1", 0.002, 0.98, 0.01, map[string]any{"service.name": "调试-认证服务", "service.instance.id": "auth-03", "http.response.status_code": 401}),
			metric("metrics", "http.server.error_ratio", "1", 0.002, 0.003, 0.001, map[string]any{"service.name": "调试-认证服务", "service.instance.id": "auth-01"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-认证服务 auth-03"}, RootCause: "auth-03 配置修订 8f2c1a 偏离期望 4d91be，未加载当前 JWT 公钥，只有该实例验签失败。",
			ExpectedDiagnosis: "根因是单实例配置漂移，而不是全局密钥失效。",
			KeyEvidence:       []string{"错误仅集中 auth-03", "desired 与 actual checksum 不一致", "auth-01/auth-02 验签成功", "auth-03 401 比例约 98%"},
			Remediation:       []string{"将 auth-03 配置收敛到期望修订", "摘除异常实例后滚动恢复", "检查配置分发和启动校验"},
			Verification:      []string{"所有实例 revision 一致", "auth-03 验签成功", "401 分布恢复"},
			UnsafeActions:     []string{"轮换全局密钥扩大影响", "关闭 JWT 签名校验"},
		},
	),
	makeScenario(
		ScenarioServiceDown, "服务崩溃与不可用", "可用性", "基础", "结算接口立即返回 503，目标端口拒绝连接。",
		[]string{"service_down"},
		[]scenarioService{
			httpService("调试-边缘网关", "POST /api/checkout", 18, 110),
			httpService("调试-结算服务", "POST /checkout", 42, 80),
		},
		1, 100, 503, 503, "ConnectionRefused", "dial tcp 10.20.4.18:8080: connect: connection refused", "net.Dial\ncheckout.Client.Submit\ngateway.Handle",
		[]scenarioLog{
			logLine("调试-边缘网关", "ERROR", "upstream connect failed address=10.20.4.18:8080 error=connection refused", map[string]any{"peer.service": "调试-结算服务"}),
			logLine("调试-容器运行时", "ERROR", "container checkout-api exited code=1 reason=CrashLoopBackOff restart_count=14", map[string]any{"container.name": "checkout-api"}),
		},
		"checkout upstream unavailable status=503",
		[]scenarioLog{
			logLine("调试-节点代理", "INFO", "node health check passed disk_pressure=false memory_pressure=false", map[string]any{"host.name": "scry-debug-app-03"}),
		},
		[]scenarioMetric{
			metric("metrics", "service.health", "1", 1, 0, 0, map[string]any{"service.name": "调试-结算服务"}),
			counter("infrastructure", "container.restart.count", "{restart}", 0, 14, 0.2, map[string]any{"container.name": "checkout-api"}),
			metric("infrastructure", "system.cpu.utilization", "1", 0.34, 0.29, 0.02, map[string]any{"host.name": "scry-debug-app-03"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-结算服务"}, RootCause: "checkout-api 进程启动后立即退出并进入 CrashLoopBackOff，8080 端口无监听。",
			ExpectedDiagnosis: "根因是结算服务进程崩溃，不是节点资源不足或网络超时。",
			KeyEvidence:       []string{"connection refused", "service.health=0", "CrashLoopBackOff", "restart_count=14", "节点压力正常"},
			Remediation:       []string{"查看首次退出日志并修复启动错误", "回滚到可运行版本", "恢复健康实例后再接流量"},
			Verification:      []string{"端口恢复监听", "健康检查通过", "重启计数稳定", "结算 503 归零"},
			UnsafeActions:     []string{"持续强制重启而不检查退出原因"},
		},
	),
	makeScenario(
		ScenarioNetworkExposure, "未授权网络监听暴露", "安全", "进阶", "节点出现未登记的公网监听端口，但业务接口暂未报错。",
		[]string{"network_exposure"},
		[]scenarioService{
			httpService("调试-安全探针", "scan node listeners", 120, 180),
			dependencyService("调试-运维代理", "TCP LISTEN 0.0.0.0:2375", "network", 4, 4, map[string]any{"network.local.address": "0.0.0.0", "network.local.port": 2375}),
		},
		1, 100, 200, 200, "UnauthorizedListener", "unregistered listener exposed on 0.0.0.0:2375", "scanner.CompareBaseline\nagent.ListSockets\nsecurity.Scan",
		[]scenarioLog{
			logLine("调试-安全探针", "WARN", "listener not present in approved baseline address=0.0.0.0 port=2375 process=dockerd pid=842", map[string]any{"network.transport": "tcp"}),
			logLine("调试-防火墙", "WARN", "inbound connection accepted dst_port=2375 source_zone=external", map[string]any{"network.local.port": 2375}),
		},
		"security scan detected listener baseline deviation",
		[]scenarioLog{
			logLine("调试-安全探针", "INFO", "approved listener address=0.0.0.0 port=443 process=nginx", map[string]any{"network.local.port": 443}),
		},
		[]scenarioMetric{
			metric("infrastructure", "system.network.listeners", "{listener}", 12, 13, 0, map[string]any{"host.name": "scry-debug-ops-01"}),
			metric("infrastructure", "security.listener.approved", "1", 1, 0, 0, map[string]any{"host.name": "scry-debug-ops-01", "network.local.port": 2375}),
			counter("infrastructure", "system.network.connections.accepted", "{connection}", 0, 48, 2, map[string]any{"network.local.port": 2375, "source.zone": "external"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-运维代理 dockerd"}, RootCause: "Docker Remote API 在 0.0.0.0:2375 无 TLS 监听，偏离批准基线且已接受外部连接。",
			ExpectedDiagnosis: "这是未授权网络暴露事件，即使业务尚未出现 5xx 也需要处置。",
			KeyEvidence:       []string{"0.0.0.0:2375", "process=dockerd", "approved=0", "external inbound accepted"},
			Remediation:       []string{"立即通过防火墙隔离 2375", "关闭无 TLS Remote API 或改为受控 Unix socket", "审计已建立连接和操作记录"},
			Verification:      []string{"2375 不再公网监听", "外部连接归零", "监听基线恢复"},
			UnsafeActions:     []string{"只忽略告警因为业务未失败", "在保留取证前清除审计记录"},
		},
	),
	makeScenario(
		ScenarioZombieProcess, "僵尸进程持续堆积", "资源", "进阶", "批处理节点进程数逐渐增加，最终无法创建新子进程。",
		[]string{"zombie_process"},
		[]scenarioService{
			httpService("调试-任务网关", "POST /api/export", 20, 740),
			httpService("调试-导出服务", "POST /exports", 48, 680),
			dependencyService("调试-转换工作进程", "spawn converter", "process", 12, 610, map[string]any{"process.command": "document-converter"}),
		},
		2, 70, 503, 503, "ProcessSpawnError", "fork/exec document-converter: resource temporarily unavailable", "os.StartProcess\nexport.Convert\nworker.Run",
		[]scenarioLog{
			logLine("调试-节点代理", "WARN", "zombie process count above threshold count=684 parent_pid=412 parent_command=export-worker", map[string]any{"process.parent_pid": 412}),
			logLine("调试-导出服务", "ERROR", "failed to spawn converter error=EAGAIN process_count=32760 pid_max=32768", map[string]any{"process.command": "document-converter"}),
		},
		"export worker could not create converter process status=503",
		[]scenarioLog{
			logLine("调试-节点代理", "INFO", "cpu utilization=0.31 memory utilization=0.52", map[string]any{"host.name": "scry-debug-worker-01"}),
		},
		[]scenarioMetric{
			metric("infrastructure", "system.processes.count", "{process}", 420, 32760, 3, map[string]any{"host.name": "scry-debug-worker-01"}),
			metric("infrastructure", "system.processes.zombies", "{process}", 0, 684, 8, map[string]any{"host.name": "scry-debug-worker-01"}),
			metric("infrastructure", "system.processes.limit", "{process}", 32768, 32768, 0, map[string]any{"host.name": "scry-debug-worker-01"}),
			metric("infrastructure", "system.cpu.utilization", "1", 0.28, 0.31, 0.02, map[string]any{"host.name": "scry-debug-worker-01"}),
		}, false,
		ScenarioGroundTruth{
			RootServices: []string{"调试-导出服务 export-worker"}, RootCause: "export-worker 未调用 wait 回收退出的转换子进程，684 个僵尸进程使进程数接近 pid_max，fork 返回 EAGAIN。",
			ExpectedDiagnosis: "根因是父进程未回收子进程，而非 CPU 或内存不足。",
			KeyEvidence:       []string{"zombies=684", "parent_pid=412 export-worker", "process_count 接近 pid_max", "fork EAGAIN", "CPU/内存正常"},
			Remediation:       []string{"修复父进程 SIGCHLD/wait 处理", "受控重启父进程临时回收僵尸", "限制并发转换任务"},
			Verification:      []string{"zombie 数归零", "进程数恢复余量", "新子进程可创建", "导出成功率恢复"},
			UnsafeActions:     []string{"尝试直接 kill 僵尸进程", "只提高 pid_max 掩盖泄漏"},
		},
	),
	makeScenario(
		ScenarioMixed, "复合故障：内存泄漏与消息积压", "复合", "专家", "履约状态延迟且消费者周期性重启，积压在重启后继续扩大。",
		[]string{"mixed"},
		[]scenarioService{
			httpService("调试-订单服务", "POST /orders", 40, 48),
			dependencyService("调试-Kafka", "fulfillment.commands publish", "messaging", 8, 12, map[string]any{"messaging.system": "kafka", "messaging.destination.name": "fulfillment.commands"}),
			dependencyService("调试-履约消费者", "fulfillment.commands process", "messaging", 72, 3850, map[string]any{"messaging.system": "kafka", "messaging.consumer.group.name": "fulfillment-v3"}),
		},
		2, 82, 137, 202, "ContainerTerminated", "consumer OOMKilled while processing oversized aggregation window", "aggregation.Append\nconsumer.Process\nworker.Run",
		[]scenarioLog{
			logLine("调试-履约消费者", "WARN", "aggregation buffer growth items=1840000 rss_bytes=1002438656 limit_bytes=1073741824", map[string]any{"consumer.group": "fulfillment-v3"}),
			logLine("调试-容器运行时", "ERROR", "container fulfillment-consumer terminated reason=OOMKilled exit_code=137 restart_count=9", map[string]any{"container.name": "fulfillment-consumer"}),
			logLine("调试-履约消费者", "WARN", "consumer group rebalance generation=781 reason=member_lost", map[string]any{"consumer.group": "fulfillment-v3"}),
		},
		"event accepted but fulfillment processing is delayed",
		[]scenarioLog{
			logLine("调试-Kafka", "INFO", "broker health normal under_replicated_partitions=0 offline_partitions=0", map[string]any{"cluster": "commerce-events"}),
		},
		[]scenarioMetric{
			metric("infrastructure", "process.memory.usage", "By", 420e6, 1.002e9, 8e6, map[string]any{"service.name": "调试-履约消费者"}),
			metric("infrastructure", "container.memory.limit", "By", 1.073e9, 1.073e9, 0, map[string]any{"container.name": "fulfillment-consumer"}),
			counter("infrastructure", "container.restart.count", "{restart}", 0, 9, 0.2, map[string]any{"container.name": "fulfillment-consumer"}),
			metric("messaging", "kafka.consumer.group.lag", "{message}", 40, 362000, 6000, map[string]any{"topic": "fulfillment.commands", "consumer_group": "fulfillment-v3"}),
			counter("messaging", "kafka.consumer.group.rebalances", "{rebalance}", 1, 68, 2, map[string]any{"consumer_group": "fulfillment-v3"}),
			metric("messaging", "kafka.consumer.records.rate", "{message}/s", 720, 48, 5, map[string]any{"topic": "fulfillment.commands", "consumer_group": "fulfillment-v3"}),
		}, true,
		ScenarioGroundTruth{
			RootServices: []string{"调试-履约消费者"}, RootCause: "履约消费者聚合缓冲区无界增长导致 OOM 重启；反复离组触发再均衡，进一步造成 Kafka 积压。",
			ExpectedDiagnosis: "主因是消费者内存泄漏，Kafka lag 和再均衡是其下游后果，不应把 broker 判为根因。",
			KeyEvidence:       []string{"RSS 接近 1GiB limit", "OOMKilled exit 137", "重启与 rebalance 同步", "lag 约 36.2 万", "broker 无离线分区"},
			Remediation:       []string{"限制聚合窗口并修复缓冲区释放", "临时降低单批大小并扩容消费者", "待实例稳定后追赶积压"},
			Verification:      []string{"内存稳定", "不再 OOM/rebalance", "消费速率超过生产速率", "lag 持续清零"},
			UnsafeActions:     []string{"重置 offset 丢弃履约命令", "把 Kafka broker 作为首要重启对象"},
		},
	),
}

var scenarioAliases = func() map[string]string {
	aliases := make(map[string]string, len(scenarioDefinitions)*2)
	for _, scenario := range scenarioDefinitions {
		aliases[scenario.Catalog.ID] = scenario.Catalog.ID
		for _, legacyID := range scenario.LegacyIDs {
			aliases[legacyID] = scenario.Catalog.ID
		}
	}
	return aliases
}()

func CanonicalScenarioID(id string) (string, bool) {
	canonical, ok := scenarioAliases[strings.TrimSpace(id)]
	return canonical, ok
}

func scenarioByID(id string) (scenarioDefinition, bool) {
	canonical, ok := CanonicalScenarioID(id)
	if !ok {
		return scenarioDefinition{}, false
	}
	for _, scenario := range scenarioDefinitions {
		if scenario.Catalog.ID == canonical {
			return scenario, true
		}
	}
	return scenarioDefinition{}, false
}

func ScenarioCatalog() []ScenarioCatalogItem {
	items := make([]ScenarioCatalogItem, 0, len(scenarioDefinitions))
	for _, scenario := range scenarioDefinitions {
		item := scenario.Catalog
		item.Topology = append([]string(nil), item.Topology...)
		item.Signals = append([]string(nil), item.Signals...)
		items = append(items, item)
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func ScenarioTruth(id string) (ScenarioGroundTruth, bool) {
	scenario, ok := scenarioByID(id)
	if !ok {
		return ScenarioGroundTruth{}, false
	}
	truth := scenario.GroundTruth
	truth.RootServices = append([]string(nil), truth.RootServices...)
	truth.KeyEvidence = append([]string(nil), truth.KeyEvidence...)
	truth.Remediation = append([]string(nil), truth.Remediation...)
	truth.Verification = append([]string(nil), truth.Verification...)
	truth.UnsafeActions = append([]string(nil), truth.UnsafeActions...)
	return truth, true
}

func mustScenario(id string) scenarioDefinition {
	scenario, ok := scenarioByID(id)
	if !ok {
		panic(fmt.Sprintf("unknown debug scenario %q", id))
	}
	return scenario
}
