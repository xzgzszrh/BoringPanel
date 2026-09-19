import type { IncomingMessage, ServerResponse } from "node:http";

import { MCPServer } from "@mastra/mcp";

import { authenticateToken } from "../auth.js";
import { createScryTools } from "../tools/scry.js";
import type { AuthenticatedUser, EvidenceCaptureContext } from "../types.js";
import {
  MCP_TOOL_CALL_PROTOCOL,
  SCRY_QUERY_SIGNALS_PROTOCOL,
} from "./protocol.js";

function bearerToken(header?: string): string {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

export function createScryMCPServer(
  user: AuthenticatedUser,
  evidenceContext?: EvidenceCaptureContext,
): MCPServer {
  return new MCPServer({
    id: `scry-mcp-${user.id}`,
    name: "Scry MCP Server",
    version: "1.0.0",
    description: "Scry 可观测性查询、诊断与受控主机操作工具。",
    instructions: `所有工具调用均受当前 Scry 用户身份、组织边界、工具策略和审计规则约束。
${MCP_TOOL_CALL_PROTOCOL}
${SCRY_QUERY_SIGNALS_PROTOCOL}`,
    tools: createScryTools(user, evidenceContext),
  });
}

function writeJSON(res: ServerResponse, status: number, value: unknown): void {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

export async function handleScryMCPRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    writeJSON(res, 401, { error: "MCP 请求需要 Scry 访问令牌" });
    return;
  }

  let server: MCPServer | undefined;
  try {
    const user = await authenticateToken(token);
    const threadId = String(req.headers["x-scry-thread-id"] || "");
    const traceId = String(req.headers["x-scry-trace-id"] || "");
    const encodedQuery = String(req.headers["x-scry-evidence-query"] || "");
    let query = "";
    try {
      query = encodedQuery ? decodeURIComponent(encodedQuery) : "";
    } catch {
      query = "";
    }
    const evidenceContext =
      threadId && traceId ? { threadId, traceId, query } : undefined;
    server = createScryMCPServer(user, evidenceContext);
    await server.startHTTP({
      url: new URL(
        req.url || "/mcp",
        `http://${req.headers.host || "127.0.0.1"}`,
      ),
      httpPath: "/mcp",
      req,
      res,
      options: { serverless: true, enableJsonResponse: true },
    });
  } catch (error) {
    writeJSON(res, 401, {
      error: error instanceof Error ? error.message : "MCP 请求处理失败",
    });
  } finally {
    await server?.close().catch(() => undefined);
  }
}
