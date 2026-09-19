# Scry Agent Service

Scry 对话、MCP 工具、安全决策、审批、Loop 与受控主机操作运行时。

- Runtime: Node.js 22+
- Persistence: PostgreSQL for Mastra state and WASM SQLite for Scry configuration/audit data
- Model formats: OpenAI-compatible and Anthropic
- Authentication: validates the existing Scry JWT through query-service
- Tool policy: MCP tools, prompt-injection checks, approval gates, and scry-ops wrappers

The service never mounts the Docker socket and does not access ClickHouse
directly. Observability tools call query-service with the current user's JWT so
existing RBAC remains authoritative.
