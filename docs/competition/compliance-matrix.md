# Scry 赛题功能符合性矩阵

目标赛题：第十五届中国软件杯 A2“面向麒麟操作系统的安全智能运维 Agent 设计与实现”。

| 赛题要求 | Scry 已实现能力 | 主要代码与材料 | 验收方式 |
|---|---|---|---|
| 操作系统深度感知 | OpenTelemetry 指标、日志、链路、基础设施与消息数据统一查询；受管主机通过固定包装器读取系统、磁盘、内存、systemd、监听端口和系统错误 | `pkg/query-service/`、`agent-service/src/tools/ssh.ts`、`deploy/scry-ops/bin/` | 运行基础设施故障场景和“最小权限环境校验”，检查证据是否进入 Agent 结论 |
| MCP 插件化 | 内置 Scry MCP Server、MCP Client、远程 Streamable HTTP 插件注册、加密请求头、组织隔离、连接测试和工具自动装载 | `agent-service/src/mcp/`、`agent-service/src/server.ts`、`frontend/src/container/AgentSettings/MCPPluginSettings.tsx` | 访问 `/mcp` 完成 initialize/listTools/callTool；在管理页注册远程插件并列出工具 |
| Prompt Injection 防护 | NFKC 归一化、零宽字符清理、指令覆盖/提示词泄露/安全绕过/角色混淆/编码载荷检测；模型调用前强制裁决 | `agent-service/src/security/prompt-injection-detector.ts`、`policy-engine.ts` | 运行 `npm test`，并提交注入语料验证 403 与 traceId |
| 安全意图二次过滤 | 输入阶段分类与策略裁决；工具执行前 Shell 词法复检；输出 allow/require-approval/deny | `intent-classifier.ts`、`command-risk-analyzer.ts`、`policy-engine.ts` | 对只读、变更、提权、凭证读取请求分别验证裁决与审计事件 |
| 最小权限受限账户 | 固定 `scry-ops` 公钥账户、sshd ForceCommand、无 TTY/转发/隧道、包装器白名单、sudoers 精确路径、参数二次校验 | `deploy/scry-ops/` | 直接执行任意命令应返回 `SCRY_POLICY_DENIED`；包装器属主必须为 `root:root` |
| 完整决策与执行审计 | 同一 traceId 串联接收意图、注入扫描、分类、策略、审批、命令风险、工具开始/完成/失败；敏感输入仅保存 SHA-256 | `agent-service/src/security/audit.ts`、`scry_security_audit_events`、安全审计界面 | 在“工具与安全”中按 Trace 查看完整事件时间线 |
| 自然语言交互与根因分析 | 诊断/规划/操作三模式、持久对话、MCP 工具、A2UI、并行证据收集、综合根因 Loop | `agent-service/src/agent.ts`、`workflows/compiler.ts`、`workflows/presets.ts` | 使用“综合根因分析”预设运行服务、告警、仪表盘并行取证 |
| B/S 架构 | Web Console、Query Service、Agent Service、数据与告警服务分层，浏览器仅访问统一 HTTP 入口 | `frontend/`、`pkg/query-service/`、`agent-service/` | 桌面与移动浏览器完成登录、查询、Agent、Loop、设置流程 |
| LoongArch + 麒麟 V11 | Query Service 目标机原生 CGO 构建；Node.js 22 源码构建；Agent 采用纯 JS/WASM 依赖；PostgreSQL 存储；systemd/Nginx 原生部署与验收 | `deploy/kylin-loong64/`、`agent-service/src/database/wasm-sqlite.ts` | 在目标机执行 `preflight.sh`、构建脚本、`install-native.sh`、`acceptance.sh` |
| 故障模拟 | 正常、慢调用、错误突增、磁盘爆满、僵尸进程、磁盘 I/O、配置漂移、服务不可用、网络暴露面、综合故障 | `pkg/query-service/app/debugmode/`、`frontend/src/container/DebugModeSettings/` | 切换场景后验证专用日志、指标、链路和对应 Loop 诊断结果 |

## 结论

Scry 已形成赛题要求的完整技术链：操作系统信号进入统一可观测数据面，Agent 通过 MCP 获取证据，输入与工具执行分别经过安全裁决，变更动作由审批和 `scry-ops` 最小权限包装器约束，全部过程进入统一审计，并提供麒麟 V11/LoongArch64 原生部署路径和可重复故障场景。
