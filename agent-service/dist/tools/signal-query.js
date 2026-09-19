import { z } from "zod";
const filterOperatorSchema = z.enum([
    "=",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "in",
    "nin",
    "contains",
    "ncontains",
    "like",
    "nlike",
    "regex",
    "nregex",
    "exists",
    "nexists",
    "has",
    "nhas",
]);
const filterValueSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
    z.array(z.boolean()),
]);
const attributeScopeSchema = z.enum([
    "auto",
    "column",
    "resource",
    "attribute",
]);
const attributeDataTypeSchema = z.enum(["string", "int64", "float64", "bool"]);
const signalFilterSchema = z
    .object({
    field: z
        .string()
        .min(1)
        .max(240)
        .describe("字段名，例如 service.name、body、http.response.status_code 或 scry.debug.case_id。"),
    operator: filterOperatorSchema
        .optional()
        .default("=")
        .describe("过滤操作符。字符串模糊匹配使用 contains，数组匹配使用 in。"),
    value: filterValueSchema
        .optional()
        .describe("exists/nexists 不需要 value；in/nin 使用同类型数组。"),
    scope: attributeScopeSchema
        .optional()
        .default("auto")
        .describe("字段位置。标准列用 column，资源属性用 resource，Span/Log/Metric 属性用 attribute；通常使用 auto。"),
    dataType: attributeDataTypeSchema
        .optional()
        .describe("字段数据类型；省略时根据 value 自动推断。"),
})
    .superRefine((filter, context) => {
    if (!["exists", "nexists"].includes(filter.operator) &&
        filter.value === undefined) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${filter.operator} 过滤器必须提供 value`,
            path: ["value"],
        });
    }
    if (["in", "nin"].includes(filter.operator) &&
        !Array.isArray(filter.value)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${filter.operator} 过滤器的 value 必须是数组`,
            path: ["value"],
        });
    }
})
    .describe("单个附加过滤条件。所有字段直接放在该对象中，通常使用 scope=auto。");
const groupFieldSchema = z
    .object({
    field: z.string().min(1).max(240).describe("分组字段名。"),
    scope: attributeScopeSchema
        .optional()
        .default("auto")
        .describe("字段位置，通常使用 auto。"),
    dataType: attributeDataTypeSchema
        .optional()
        .default("string")
        .describe("字段数据类型。"),
})
    .describe("单个时间序列分组字段，通常只需要填写 field。");
export const signalQueryInputSchema = z
    .object({
    signal: z
        .enum(["logs", "traces", "metrics"])
        .describe("必填查询类型：logs=日志、traces=链路、metrics=指标。"),
    lookbackMinutes: z
        .number()
        .int()
        .min(1)
        .max(1440)
        .optional()
        .default(15)
        .describe("从当前时间向前查询的分钟数，范围 1 到 1440。"),
    caseId: z
        .string()
        .regex(/^case-[0-9]{3}$/)
        .optional()
        .describe("可选的不透明调试案例编号，例如 case-013。工具会转换为资源属性过滤。"),
    serviceNames: z
        .array(z.string().min(1).max(240))
        .max(50)
        .optional()
        .default([])
        .describe("可选服务名列表。多个服务使用一次 in 过滤，不要自行构造 OR 查询。"),
    filters: z
        .array(signalFilterSchema)
        .max(30)
        .optional()
        .default([])
        .describe("附加过滤条件。所有快捷条件和 filters 默认使用 AND 连接。"),
    resultMode: z
        .enum(["records", "timeseries"])
        .optional()
        .default("records")
        .describe("日志和链路默认返回 records 原始记录；需要数量趋势时使用 timeseries。指标始终返回时间序列。"),
    limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .default(100)
        .describe("records 模式的最大返回记录数，范围 1 到 500。"),
    order: z
        .enum(["asc", "desc"])
        .optional()
        .default("desc")
        .describe("records 模式按时间升序或降序。"),
    aggregation: z
        .enum([
        "count",
        "avg",
        "sum",
        "min",
        "max",
        "p50",
        "p90",
        "p95",
        "p99",
        "rate",
    ])
        .optional()
        .describe("聚合方式。日志/链路 timeseries 只使用 count 或 rate；指标默认 avg。"),
    groupBy: z
        .array(groupFieldSchema)
        .max(8)
        .optional()
        .default([])
        .describe("timeseries 分组字段，例如 service.name、severity_text、host.name 或 consumer_group。"),
    stepSeconds: z
        .number()
        .int()
        .min(5)
        .max(3600)
        .optional()
        .describe("时间桶秒数；省略时按查询范围自动计算。"),
    searchText: z
        .string()
        .min(1)
        .max(2000)
        .optional()
        .describe("仅用于 logs：在日志 body 中执行 contains 查询。"),
    severities: z
        .array(z.enum(["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]))
        .max(6)
        .optional()
        .default([])
        .describe("仅用于 logs：按日志级别过滤。"),
    operation: z
        .string()
        .min(1)
        .max(500)
        .optional()
        .describe("仅用于 traces：按 Span 操作名 contains 过滤，例如 POST /orders。"),
    errorOnly: z
        .boolean()
        .optional()
        .default(false)
        .describe("仅用于 traces：为 true 时只返回 hasError=true 的链路。"),
    minDurationMs: z
        .number()
        .min(0)
        .max(3_600_000)
        .optional()
        .describe("仅用于 traces：Span 最小耗时，单位毫秒。"),
    metricName: z
        .string()
        .min(1)
        .max(500)
        .optional()
        .describe("仅用于 metrics 且必填，例如 system.filesystem.utilization 或 kafka.consumer.group.lag。"),
    metricType: z
        .enum(["Gauge", "Sum", "Histogram", "ExponentialHistogram"])
        .optional()
        .default("Gauge")
        .describe("仅用于 metrics：普通状态值使用 Gauge，累计计数使用 Sum。"),
    temporality: z
        .enum(["Unspecified", "Delta", "Cumulative"])
        .optional()
        .describe("仅用于 metrics，通常省略并由 Query Service 自动发现。"),
})
    .superRefine((input, context) => {
    if (input.signal === "metrics" && !input.metricName) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "metrics 查询必须提供 metricName",
            path: ["metricName"],
        });
    }
    if (input.signal !== "metrics" &&
        input.resultMode === "timeseries" &&
        input.aggregation &&
        !["count", "rate"].includes(input.aggregation)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "日志和链路 timeseries 只支持 count 或 rate",
            path: ["aggregation"],
        });
    }
    if (input.signal === "metrics" && input.aggregation === "count") {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "指标查询不支持 count；请使用 avg、sum、min、max、分位数或 rate",
            path: ["aggregation"],
        });
    }
})
    .describe(`直接传入一个扁平对象，不要添加 query 包装层，也不要构造 compositeQuery、logQueries、builderQueries。
日志示例：{"signal":"logs","lookbackMinutes":15,"caseId":"case-013","serviceNames":["调试-审计服务"],"searchText":"ENOSPC","limit":100}
链路示例：{"signal":"traces","lookbackMinutes":15,"caseId":"case-013","errorOnly":true,"limit":100}
指标示例：{"signal":"metrics","lookbackMinutes":15,"caseId":"case-013","metricName":"system.filesystem.utilization","aggregation":"max","groupBy":[{"field":"mountpoint"}]}`);
const columns = {
    logs: new Set([
        "timestamp",
        "id",
        "trace_id",
        "span_id",
        "trace_flags",
        "severity_text",
        "severity_number",
        "scope_name",
        "scope_version",
        "body",
        "serviceName",
    ]),
    traces: new Set([
        "timestamp",
        "traceID",
        "spanID",
        "parentSpanID",
        "serviceName",
        "name",
        "durationNano",
        "statusCode",
        "hasError",
        "kind",
    ]),
    metrics: new Set([]),
};
const fieldAliases = {
    logs: {
        "service.name": "service.name",
        serviceName: "service.name",
        service_name: "service.name",
        service: "service.name",
        "trace.id": "trace_id",
        traceId: "trace_id",
        trace_id: "trace_id",
        "span.id": "span_id",
        spanId: "span_id",
        span_id: "span_id",
        severity: "severity_text",
        severityText: "severity_text",
        message: "body",
    },
    traces: {
        "service.name": "service.name",
        serviceName: "service.name",
        service_name: "service.name",
        service: "service.name",
        "trace.id": "traceID",
        traceId: "traceID",
        trace_id: "traceID",
        "span.id": "spanID",
        spanId: "spanID",
        span_id: "spanID",
        operation: "name",
        duration: "durationNano",
        durationMs: "durationNano",
        error: "hasError",
    },
};
function inferDataType(value) {
    const sample = Array.isArray(value) ? value[0] : value;
    if (typeof sample === "boolean")
        return "bool";
    if (typeof sample === "number")
        return Number.isInteger(sample) ? "int64" : "float64";
    return "string";
}
function attributeKey(signal, reference, value) {
    const alias = signal === "metrics"
        ? reference.field
        : fieldAliases[signal][reference.field] || reference.field;
    let scope = reference.scope || "auto";
    if (scope === "auto") {
        if (columns[signal].has(alias))
            scope = "column";
        else if (alias === "service.name")
            scope = "resource";
        else if (alias === "scry.debug.case_id" ||
            alias.startsWith("deployment.") ||
            alias.startsWith("host."))
            scope = "resource";
        else
            scope = "attribute";
    }
    return {
        key: alias,
        dataType: reference.dataType || inferDataType(value),
        type: scope === "resource" ? "resource" : scope === "attribute" ? "tag" : "",
        isColumn: scope === "column",
        isJSON: false,
    };
}
function filterItem(signal, field, value, operator = "=", scope = "auto", dataType) {
    return {
        key: attributeKey(signal, { field, scope, dataType }, value),
        value,
        op: operator,
    };
}
function autoStepSeconds(lookbackMinutes) {
    return Math.max(5, Math.min(3600, Math.ceil((lookbackMinutes * 60) / 120)));
}
function baseFilters(input) {
    const items = [];
    if (input.caseId)
        items.push(filterItem(input.signal, "scry.debug.case_id", input.caseId, "=", "resource", "string"));
    if (input.serviceNames.length) {
        const scope = input.signal === "metrics" ? "attribute" : "resource";
        items.push(filterItem(input.signal, "service.name", input.serviceNames, "in", scope, "string"));
    }
    for (const filter of input.filters) {
        items.push(filterItem(input.signal, filter.field, filter.value ?? "", filter.operator, filter.scope, filter.dataType));
    }
    return items;
}
function logFilters(input) {
    const items = baseFilters(input);
    if (input.searchText)
        items.push(filterItem("logs", "body", input.searchText, "contains", "column", "string"));
    if (input.severities.length)
        items.push(filterItem("logs", "severity_text", input.severities, "in", "column", "string"));
    return items;
}
function traceFilters(input) {
    const items = baseFilters(input);
    if (input.operation)
        items.push(filterItem("traces", "name", input.operation, "contains", "column", "string"));
    if (input.errorOnly)
        items.push(filterItem("traces", "hasError", true, "=", "column", "bool"));
    if (input.minDurationMs !== undefined) {
        items.push(filterItem("traces", "durationNano", Math.round(input.minDurationMs * 1_000_000), ">=", "column", "int64"));
    }
    return items;
}
function groupByFields(signal, values) {
    return values.map((value) => attributeKey(signal, value));
}
function recordsQuery(input) {
    const filters = input.signal === "logs" ? logFilters(input) : traceFilters(input);
    return {
        panelType: input.signal === "logs" ? "list" : "trace",
        builder: {
            queryName: "A",
            stepInterval: autoStepSeconds(input.lookbackMinutes),
            dataSource: input.signal,
            aggregateOperator: "noop",
            aggregateAttribute: {},
            filters: { op: "AND", items: filters },
            groupBy: [],
            expression: "A",
            disabled: false,
            limit: input.limit,
            offset: 0,
            pageSize: input.limit,
            orderBy: [{ columnName: "timestamp", order: input.order }],
            reduceTo: "last",
        },
    };
}
function signalTimeseriesQuery(input) {
    const filters = input.signal === "logs" ? logFilters(input) : traceFilters(input);
    return {
        panelType: "graph",
        builder: {
            queryName: "A",
            stepInterval: input.stepSeconds || autoStepSeconds(input.lookbackMinutes),
            dataSource: input.signal,
            aggregateOperator: input.aggregation || "count",
            aggregateAttribute: {},
            filters: { op: "AND", items: filters },
            groupBy: groupByFields(input.signal, input.groupBy),
            expression: "A",
            disabled: false,
            limit: 0,
            offset: 0,
            pageSize: 0,
            orderBy: [],
            reduceTo: "sum",
        },
    };
}
function metricQuery(input) {
    const aggregation = input.aggregation || "avg";
    const percentile = aggregation.startsWith("p");
    const rate = aggregation === "rate";
    return {
        panelType: "graph",
        builder: {
            queryName: "A",
            stepInterval: input.stepSeconds || autoStepSeconds(input.lookbackMinutes),
            dataSource: "metrics",
            aggregateOperator: aggregation,
            aggregateAttribute: {
                key: input.metricName,
                dataType: "float64",
                type: input.metricType,
                isColumn: true,
                isJSON: false,
            },
            ...(input.temporality ? { temporality: input.temporality } : {}),
            filters: { op: "AND", items: baseFilters(input) },
            groupBy: groupByFields("metrics", input.groupBy),
            expression: "A",
            disabled: false,
            limit: 0,
            offset: 0,
            pageSize: 0,
            orderBy: [],
            reduceTo: "avg",
            timeAggregation: rate ? "rate" : "avg",
            spaceAggregation: percentile ? aggregation : rate ? "sum" : aggregation,
        },
    };
}
export function buildSignalQueryPayload(input, now = Date.now()) {
    const parsed = signalQueryInputSchema.parse(input);
    const query = parsed.signal === "metrics"
        ? metricQuery(parsed)
        : parsed.resultMode === "timeseries"
            ? signalTimeseriesQuery(parsed)
            : recordsQuery(parsed);
    return {
        start: now - parsed.lookbackMinutes * 60_000,
        end: now,
        step: "builder" in query
            ? query.builder.stepInterval
            : autoStepSeconds(parsed.lookbackMinutes),
        noCache: true,
        compositeQuery: {
            queryType: "builder",
            panelType: query.panelType,
            builderQueries: { A: query.builder },
        },
    };
}
//# sourceMappingURL=signal-query.js.map