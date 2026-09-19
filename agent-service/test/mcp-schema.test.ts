import assert from "node:assert/strict";
import test from "node:test";

import { createScryMCPServer } from "../src/mcp/server.js";
import type { AuthenticatedUser } from "../src/types.js";

interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
}

interface ToolInfo {
  id: string;
  description: string;
  inputSchema: JsonSchema;
  _meta?: { mastra?: { strict?: boolean } };
}

const user: AuthenticatedUser = {
  id: "00000000-0000-4000-8000-000000000001",
  orgId: "00000000-0000-4000-8000-000000000002",
  email: "schema-test@scry.local",
  role: "ADMIN",
  token: "schema-test-token",
};

function assertObjectFieldsAreDescribed(
  schema: JsonSchema,
  path: string,
): void {
  assert.equal(schema.type, "object", `${path} must be an object schema`);
  assert.equal(
    schema.additionalProperties,
    false,
    `${path} must reject unknown fields`,
  );
  assert.ok(
    schema.description?.trim(),
    `${path} must describe its input shape`,
  );

  for (const [name, property] of Object.entries(schema.properties || {})) {
    const propertyPath = `${path}.${name}`;
    assert.ok(
      property.description?.trim(),
      `${propertyPath} must include a field description`,
    );
    if (property.type === "object") {
      assertObjectFieldsAreDescribed(property, propertyPath);
    }
    if (property.items?.type === "object") {
      assertObjectFieldsAreDescribed(property.items, `${propertyPath}[]`);
    }
  }
}

test("built-in MCP tools expose self-describing input contracts", async () => {
  const server = createScryMCPServer(user);
  try {
    const catalog = (await server.getToolListInfo()) as { tools: ToolInfo[] };
    assert.equal(catalog.tools.length, 16);

    for (const tool of catalog.tools) {
      assert.ok(
        tool.description.trim(),
        `${tool.id} must describe when to call it`,
      );
      assert.notEqual(
        tool._meta?.mastra?.strict,
        true,
        `${tool.id} must not force provider strict mode on compatible endpoints`,
      );
      assertObjectFieldsAreDescribed(tool.inputSchema, tool.id);
    }
  } finally {
    await server.close();
  }
});

test("high-risk and protocol-sensitive tools publish complete examples", async () => {
  const server = createScryMCPServer(user);
  try {
    const catalog = (await server.getToolListInfo()) as { tools: ToolInfo[] };
    const tools = new Map(catalog.tools.map((tool) => [tool.id, tool]));

    const query = tools.get("querySignals");
    assert.ok(query?.description.includes('"signal":"logs"'));
    assert.equal(query?.inputSchema.properties?.signal?.type, "string");
    assert.equal(query?.inputSchema.properties?.query, undefined);
    assert.equal(query?.inputSchema.properties?.compositeQuery, undefined);

    const remember = tools.get("remember");
    assert.ok(remember?.description.includes("证据"));
    assert.equal(remember?.inputSchema.properties?.content?.type, "string");
    assert.ok(
      remember?.inputSchema.properties?.evidenceIds?.description?.includes(
        "不得自行编造",
      ),
    );

    const ssh = tools.get("sshReadonlyInspect");
    assert.ok(ssh?.description.includes('"commandId":"disk_usage"'));
    assert.ok(
      ssh?.inputSchema.properties?.hostId?.description?.includes(
        "不是主机名或 IP",
      ),
    );

    const sshExecute = tools.get("sshExecuteCommand");
    assert.ok(
      sshExecute?.description.includes(
        '"commandId":"rolling-restart-quote-service"',
      ),
    );
    assert.ok(sshExecute?.description.includes("生成审批卡并暂停"));
  } finally {
    await server.close();
  }
});
