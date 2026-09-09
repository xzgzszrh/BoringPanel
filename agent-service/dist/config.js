import path from 'node:path';
const dataDir = process.env.SCRY_AGENT_DATA_DIR || path.resolve('data');
export const config = {
    port: Number(process.env.SCRY_AGENT_PORT || 4111),
    host: process.env.SCRY_AGENT_HOST || '0.0.0.0',
    mcpInternalUrl: process.env.SCRY_MCP_INTERNAL_URL || `http://127.0.0.1:${Number(process.env.SCRY_AGENT_PORT || 4111)}/mcp`,
    mcpTimeoutMs: Number(process.env.SCRY_MCP_TIMEOUT_MS || 30_000),
    queryServiceUrl: process.env.SCRY_QUERY_SERVICE_URL || 'http://query-service:8080',
    databaseUrl: process.env.SCRY_AGENT_DATABASE_URL || `file:${path.join(dataDir, 'agent.db')}`,
    postgresUrl: process.env.SCRY_AGENT_POSTGRES_URL || 'postgresql://scry_agent:scry_agent@postgres:5432/scry_agent',
    masterKey: process.env.SCRY_AGENT_MASTER_KEY || '',
    maxToolResultBytes: Number(process.env.SCRY_AGENT_MAX_TOOL_RESULT_BYTES || 200000),
};
export function assertConfig() {
    if (config.masterKey.length < 32) {
        throw new Error('SCRY_AGENT_MASTER_KEY must contain at least 32 characters');
    }
    if (!config.postgresUrl.startsWith('postgresql://') && !config.postgresUrl.startsWith('postgres://')) {
        throw new Error('SCRY_AGENT_POSTGRES_URL must be a PostgreSQL connection string');
    }
}
//# sourceMappingURL=config.js.map