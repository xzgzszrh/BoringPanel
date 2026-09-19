# Scry 自主开发与第三方组件边界

## 说明目的

本文件用于比赛源代码审查和软件著作权边界说明。Scry 作为完整产品品牌，由参赛团队完成产品设计、功能集成、Agent 架构、安全控制和麒麟交付。仓库同时使用依法授权的第三方基础代码与依赖，相关版权和许可证按根目录 `LICENSE` 及依赖包原始许可证保留。

## Scry 自主开发模块

- `agent-service/`：模型适配、持久对话、MCP Server/Client、证据系统、TopoMem 记忆、安全策略、SSH、A2UI、Loop 编译和调度。
- `frontend/src/pages/AgentWorkspace/`：Agent 对话工作区、执行检查器、证据处置与记忆检索。
- `frontend/src/pages/MemoryManager/`：记忆列表、分块预览、状态维护、来源和关系检查。
- `frontend/src/pages/WorkflowManager/`：Loop 管理台、可视化编辑器、条件、并行、循环、审批和运行历史。
- `frontend/src/container/AgentSettings/`：模型、MCP 插件、SSH 主机、策略和安全审计管理。
- `frontend/src/container/DebugModeSettings/` 与 `pkg/query-service/app/debugmode/`：故障模拟配置和信号生成。
- `deploy/scry-ops/`：受限账户、ForceCommand、固定包装器、服务白名单和 sudoers。
- `deploy/kylin-loong64/`：麒麟 V11 / LoongArch64 原生构建、安装、systemd、Nginx 和验收。
- `docs/competition/` 与 `docs/scry-technical-architecture/`：产品、技术、安全、测试和交付文档。

## 第三方基础能力

Scry 使用 OpenTelemetry、ClickHouse、PostgreSQL、React、Go、Node.js、Mastra、AI SDK、MCP SDK、Ant Design 等第三方依赖，并使用仓库许可证覆盖范围内的可观测查询与界面基础代码。第三方组件名称只用于依赖和许可证识别，不作为 Scry 的产品品牌。

## 分发规则

1. 不修改或删除许可证要求保留的版权与许可声明。
2. 部署包不包含未使用的企业授权目录、Git 历史、第三方依赖目录或构建缓存。
3. 目标机依据锁文件下载第三方依赖，依赖版本可复现。
4. 比赛材料只对 Scry 自主实现部分主张相应权利，不对第三方基础代码主张原创权。
