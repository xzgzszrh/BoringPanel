import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSignalQueryPayload,
  signalQueryInputSchema,
} from "../src/tools/signal-query.js";

type Payload = ReturnType<typeof buildSignalQueryPayload>;

function builder(payload: Payload) {
  return payload.compositeQuery.builderQueries.A;
}

test("log query format is translated to Query Range V3 builder payload", () => {
  const now = 1_800_000_000_000;
  const payload = buildSignalQueryPayload(
    {
      signal: "logs",
      lookbackMinutes: 15,
      caseId: "case-013",
      serviceNames: ["调试-审计服务", "调试-本地存储"],
      searchText: "ENOSPC",
      severities: ["ERROR"],
      resultMode: "records",
      limit: 80,
      order: "desc",
      filters: [],
    },
    now,
  );

  assert.equal(payload.start, now - 15 * 60_000);
  assert.equal(payload.end, now);
  assert.equal(payload.compositeQuery.queryType, "builder");
  assert.equal(payload.compositeQuery.panelType, "list");
  assert.equal(builder(payload).dataSource, "logs");
  assert.equal(builder(payload).aggregateOperator, "noop");
  assert.equal(builder(payload).limit, 80);
  assert.deepEqual(builder(payload).filters.items, [
    {
      key: {
        key: "scry.debug.case_id",
        dataType: "string",
        type: "resource",
        isColumn: false,
        isJSON: false,
      },
      value: "case-013",
      op: "=",
    },
    {
      key: {
        key: "service.name",
        dataType: "string",
        type: "resource",
        isColumn: false,
        isJSON: false,
      },
      value: ["调试-审计服务", "调试-本地存储"],
      op: "in",
    },
    {
      key: {
        key: "body",
        dataType: "string",
        type: "",
        isColumn: true,
        isJSON: false,
      },
      value: "ENOSPC",
      op: "contains",
    },
    {
      key: {
        key: "severity_text",
        dataType: "string",
        type: "",
        isColumn: true,
        isJSON: false,
      },
      value: ["ERROR"],
      op: "in",
    },
  ]);
});

test("trace shortcuts generate column filters and nanosecond duration", () => {
  const payload = buildSignalQueryPayload(
    {
      signal: "traces",
      lookbackMinutes: 30,
      caseId: "case-001",
      serviceNames: ["调试-订单服务"],
      operation: "acquire connection",
      errorOnly: true,
      minDurationMs: 5000,
      resultMode: "records",
      limit: 100,
      order: "desc",
      filters: [],
    },
    1_800_000_000_000,
  );

  assert.equal(payload.compositeQuery.panelType, "trace");
  assert.equal(builder(payload).dataSource, "traces");
  assert.deepEqual(builder(payload).filters.items.slice(0, 2), [
    {
      key: {
        key: "scry.debug.case_id",
        dataType: "string",
        type: "resource",
        isColumn: false,
        isJSON: false,
      },
      value: "case-001",
      op: "=",
    },
    {
      key: {
        key: "service.name",
        dataType: "string",
        type: "resource",
        isColumn: false,
        isJSON: false,
      },
      value: ["调试-订单服务"],
      op: "in",
    },
  ]);
  assert.deepEqual(builder(payload).filters.items.slice(-3), [
    {
      key: {
        key: "name",
        dataType: "string",
        type: "",
        isColumn: true,
        isJSON: false,
      },
      value: "acquire connection",
      op: "contains",
    },
    {
      key: {
        key: "hasError",
        dataType: "bool",
        type: "",
        isColumn: true,
        isJSON: false,
      },
      value: true,
      op: "=",
    },
    {
      key: {
        key: "durationNano",
        dataType: "int64",
        type: "",
        isColumn: true,
        isJSON: false,
      },
      value: 5_000_000_000,
      op: ">=",
    },
  ]);
});

test("metric query declares metric, aggregation, grouping and resource filters", () => {
  const payload = buildSignalQueryPayload(
    {
      signal: "metrics",
      lookbackMinutes: 60,
      caseId: "case-005",
      serviceNames: ["调试-履约消费者"],
      metricName: "kafka.consumer.group.lag",
      metricType: "Gauge",
      aggregation: "max",
      groupBy: [
        { field: "consumer_group", scope: "attribute", dataType: "string" },
      ],
      stepSeconds: 30,
      filters: [
        {
          field: "partition",
          operator: "=",
          value: "3",
          scope: "attribute",
          dataType: "string",
        },
      ],
    },
    1_800_000_000_000,
  );

  assert.equal(builder(payload).dataSource, "metrics");
  assert.equal(builder(payload).stepInterval, 30);
  assert.equal(builder(payload).aggregateOperator, "max");
  assert.deepEqual(builder(payload).aggregateAttribute, {
    key: "kafka.consumer.group.lag",
    dataType: "float64",
    type: "Gauge",
    isColumn: true,
    isJSON: false,
  });
  assert.deepEqual(builder(payload).groupBy, [
    {
      key: "consumer_group",
      dataType: "string",
      type: "tag",
      isColumn: false,
      isJSON: false,
    },
  ]);
  assert.equal(builder(payload).filters.items[0].key.type, "resource");
  assert.equal(builder(payload).filters.items[1].key.type, "tag");
});

test("timeseries query uses explicit count aggregation", () => {
  const payload = buildSignalQueryPayload(
    {
      signal: "logs",
      lookbackMinutes: 10,
      serviceNames: [],
      filters: [],
      severities: [],
      resultMode: "timeseries",
      aggregation: "count",
      groupBy: [
        { field: "severity_text", scope: "column", dataType: "string" },
      ],
    },
    1_800_000_000_000,
  );

  assert.equal(payload.compositeQuery.panelType, "graph");
  assert.equal(builder(payload).aggregateOperator, "count");
  assert.equal(builder(payload).groupBy[0].key, "severity_text");
});

test("legacy raw Query Range shapes are rejected at the tool boundary", () => {
  assert.throws(() =>
    signalQueryInputSchema.parse({
      query: { compositeQuery: { logQueries: [] } },
    }),
  );
  assert.throws(() =>
    signalQueryInputSchema.parse({
      signal: "metrics",
      lookbackMinutes: 15,
    }),
  );
  assert.throws(() =>
    signalQueryInputSchema.parse({
      signal: "logs",
      filters: [{ field: "body", operator: "in", value: "error" }],
    }),
  );
});
