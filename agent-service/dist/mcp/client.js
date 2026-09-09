import { randomUUID } from "node:crypto";
import { MCPClient } from "@mastra/mcp";
import { config } from "../config.js";
import { listMCPServers } from "../db.js";
function externalDefinition(server) {
    return {
        url: new URL(server.url),
        requestInit: { headers: server.headers },
        connectTimeout: Math.min(server.timeoutMs, 10_000),
    };
}
function externalServerKey(server) {
    return `plugin_${server.id.replace(/-/g, "_")}`;
}
export async function inspectMCPServer(server) {
    const key = externalServerKey(server);
    const client = new MCPClient({
        id: `scry-inspect-${server.id}-${randomUUID()}`,
        timeout: server.timeoutMs,
        servers: { [key]: externalDefinition(server) },
    });
    try {
        const result = await client.listToolsWithErrors();
        return {
            tools: Object.entries(result.tools).map(([id, tool]) => ({
                id,
                description: tool.description || "",
            })),
            error: result.errors[key] || "",
        };
    }
    finally {
        await client.disconnect().catch(() => undefined);
    }
}
export async function createScryMCPToolset(user, evidenceContext) {
    const plugins = await listMCPServers(user.orgId, true, true);
    const servers = {
        scry: {
            url: new URL(config.mcpInternalUrl),
            // Agent instructions already include the trusted protocol. Keep automatic
            // forwarding disabled for custom Responses-compatible model endpoints.
            requestInit: {
                headers: {
                    Authorization: `Bearer ${user.token}`,
                    "X-Scry-Organization": user.orgId,
                    ...(evidenceContext
                        ? {
                            "X-Scry-Thread-Id": evidenceContext.threadId,
                            "X-Scry-Trace-Id": evidenceContext.traceId,
                            "X-Scry-Evidence-Query": encodeURIComponent(evidenceContext.query.slice(0, 8_000)),
                        }
                        : {}),
                },
            },
            connectTimeout: Math.min(config.mcpTimeoutMs, 10_000),
        },
    };
    for (const plugin of plugins)
        servers[externalServerKey(plugin)] = externalDefinition(plugin);
    const client = new MCPClient({
        id: `scry-${user.id}-${randomUUID()}`,
        timeout: config.mcpTimeoutMs,
        servers,
    });
    try {
        const result = await client.listToolsWithErrors();
        if (result.errors.scry)
            throw new Error(`Scry MCP Server 不可用：${result.errors.scry}`);
        for (const [server, message] of Object.entries(result.errors)) {
            console.warn(`MCP plugin ${server} unavailable: ${message}`);
        }
        const tools = result.tools;
        return { tools, disconnect: () => client.disconnect() };
    }
    catch (error) {
        await client.disconnect().catch(() => undefined);
        throw error;
    }
}
//# sourceMappingURL=client.js.map