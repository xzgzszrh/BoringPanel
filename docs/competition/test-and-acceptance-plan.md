# Scry 比赛测试与验收计划

## 功能测试

1. 遥测接入：分别写入 OTLP Trace、Log、Metric，验证服务列表、查询、仪表盘和告警可见。
2. Agent 对话：创建线程，执行服务查询、告警查询、仪表盘查询和根因分析，验证消息持久化与 A2UI。
3. MCP：验证 initialize、tools/list、tools/call；注册远程插件，验证加密请求头、启停、超时和故障隔离。
4. Loop：运行安全决策、磁盘爆满、服务恢复和综合根因预设；验证条件、并行、审批、操作、验证和运行记录。
5. 故障模拟：逐一启用 10 种场景，验证 `scry.debug=true`、`scry.debug.scenario` 和专用指标。

## 安全测试

1. Prompt Injection：指令覆盖、系统提示词泄露、安全绕过、角色混淆、附件注入和编码载荷。
2. 权限：VIEWER/EDITOR/ADMIN 的设置、主机、策略、审计与 Loop 管理边界。
3. SSH：root、密码认证、任意 Shell、管道、重定向、命令替换、危险程序和非包装器全部拒绝。
4. `scry-ops`：验证 ForceCommand、无 TTY、无端口转发、包装器属主、sudoers 和服务白名单。
5. 秘密：模型 Key、MCP 请求头、SSH 私钥不出现在 API、日志、A2UI、审计和 Trace 中。

## 性能测试

使用 `tests/performance/agent-api-load.mjs` 测量 Agent 健康端点和 MCP 工具目录。比赛环境记录并发数、请求数、失败率、P50、P95、P99、CPU 和内存。Query Service 另使用固定数据集测试 1 小时、6 小时、24 小时范围查询。

建议门槛：健康端点 20 并发 200 请求零失败；MCP 工具目录 P95 小于 500 ms；普通 Agent 首个流事件小于 3 s（不含外部模型排队）；安全裁决本地处理 P95 小于 50 ms。

## 平台测试

麒麟 V11/LoongArch64 目标机执行：

```bash
cd deploy/kylin-loong64
sudo ./build-node.sh
sudo SCRY_POSTGRES_PASSWORD='强密码' ./setup-postgres.sh
./preflight.sh
./build-query.sh
./build-agent.sh
./build-frontend.sh
sudo ./install-native.sh
sudo ./acceptance.sh
```

验收记录包含 `/etc/os-release`、`uname -m`、Node/Go 版本、二进制 `file` 输出、systemd 状态、健康接口、ClickHouse `SELECT 1`、PostgreSQL连接和非 root 服务用户。

## 自动化命令

```bash
cd agent-service
npm run typecheck
npm test
npm run build

cd ../frontend
npx tsc --noEmit
npx eslint src/container/AgentSettings src/pages/WorkflowManager src/container/DebugModeSettings

cd ..
bash -n deploy/scry-ops/install.sh deploy/scry-ops/bin/*
bash -n deploy/kylin-loong64/*.sh
docker compose --env-file .env.example -f compose.dev.yaml config --quiet
```
