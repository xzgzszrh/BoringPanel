# Scry 源码开发环境

## 架构

开发环境由 PostgreSQL、ZooKeeper、ClickHouse、模式迁移、Alertmanager、OpenTelemetry
Collector、Query Service、Agent Service 和 Frontend 组成。Query Service 与 Frontend 从源码
运行；Agent Service 使用 Node.js 22、Mastra、PostgreSQL 和 WASM SQLite。

所有宿主机端口默认绑定 `127.0.0.1`。Agent 容器以 `node` 用户运行，根文件系统只读，移除
全部 Linux capabilities，启用 `no-new-privileges`，不挂载 Docker Socket 或宿主机根目录。

## 启动

```bash
cp .env.example .env
# 设置 SCRY_AGENT_MASTER_KEY 和 SCRY_POSTGRES_PASSWORD
make -f Makefile.dev dev
```

常用命令：

```bash
make -f Makefile.dev dev-infra
make -f Makefile.dev dev-backend
make -f Makefile.dev dev-agent
make -f Makefile.dev dev-frontend
make -f Makefile.dev dev-backend-restart
make -f Makefile.dev dev-agent-restart
make -f Makefile.dev dev-frontend-restart
make -f Makefile.dev dev-ps
make -f Makefile.dev dev-logs
make -f Makefile.dev dev-down
```

`dev-down` 保留命名卷。Frontend 由 Webpack 监听源码变化；Agent 由 `tsx watch` 监听；Go
源码修改后重启 Query Service 触发重新编译。

## 端点

- Web Console: `http://localhost:3301`
- Query API: `http://localhost:8080`
- Query Internal API: `http://localhost:8085`
- Agent API: `http://localhost:4111`
- MCP: `http://localhost:4111/mcp`
- Alertmanager: `http://localhost:9093`
- OTLP gRPC/HTTP: `127.0.0.1:4317`、`http://127.0.0.1:4318`
- ClickHouse Native/HTTP: `127.0.0.1:9000`、`http://127.0.0.1:8123`

## 验证

```bash
cd agent-service
npm run typecheck
npm test
npm run build

cd ../frontend
npx tsc --noEmit

cd ..
bash -n deploy/scry-ops/install.sh deploy/scry-ops/bin/*
bash -n deploy/kylin-loong64/*.sh
docker compose --env-file .env.example -f compose.dev.yaml config --quiet
```

故障模拟入口位于 `设置 > 调试模式`，支持正常、慢调用、错误突增、磁盘爆满、僵尸进程、
磁盘 I/O、配置漂移、服务不可用、网络暴露面和综合故障。Agent 设置页提供模型、MCP 插件、
`scry-ops` 主机、工具策略和统一安全审计。
