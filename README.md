# Scry 安全智能运维平台

Scry 是面向麒麟操作系统和企业 Linux 节点的安全智能运维平台。系统采用 B/S 架构，将指标、日志、链路、基础设施与消息队列观测能力，与智能运维 Agent、MCP 工具、证据链、运行记忆、Loop 自动化和最小权限执行统一在同一工作台中。

## 核心能力

- 操作系统与应用环境感知：进程、服务、磁盘、内存、网络监听、系统日志、指标、链路与告警。
- 智能运维 Agent：诊断、规划、操作三种模式，持久对话、附件输入、流式工具调用和结构化结果。
- MCP 工具体系：内置 Streamable HTTP MCP Server，并支持按组织注册远程 MCP 服务。
- 安全护栏：Prompt Injection 检测、意图风险分类、命令复检、人工审批和统一安全审计。
- 最小权限执行：`scry-ops` 受限账户、固定包装器、ForceCommand、精确 sudoers 和服务白名单。
- 证据与记忆：证据评分、人工驳回/挂起/备注、证据约束重答、TopoMem 运行记忆检索与维护。
- Loop 自动化：顺序、条件、并行、循环、审批、操作、验证、Cron 与事件触发。
- 故障模拟：正常、慢调用、错误突增、磁盘耗尽、僵尸进程、磁盘 I/O、配置漂移、服务不可用、网络暴露面和综合故障。
- 麒麟部署：提供麒麟高级服务器操作系统 V11、LoongArch64 原生构建、systemd、Nginx、PostgreSQL 与 ClickHouse 部署路径。

## 文档

- [比赛提交文档总览](docs/competition/README.md)
- [软件功能需求分析文档](docs/competition/01-software-functional-requirements-analysis.md)
- [软件功能设计文档](docs/competition/02-software-functional-design.md)
- [软件产品说明书](docs/competition/03-software-product-manual.md)
- [软件功能测试报告](docs/competition/04-software-functional-test-report.md)
- [软件性能（核心指标）测试报告](docs/competition/05-software-performance-core-metrics-test-report.md)
- [产品功能说明书](docs/competition/product-functional-specification.md)
- [技术架构文档](docs/scry-technical-architecture/scry-technical-architecture.pdf)
- [赛题符合性矩阵](docs/competition/compliance-matrix.md)
- [测试与验收计划](docs/competition/test-and-acceptance-plan.md)
- [自主开发与第三方组件边界](docs/competition/development-scope.md)
- [麒麟部署说明](deploy/kylin-loong64/README.md)
- [开发环境说明](DEVELOPMENT_SETUP.md)

## 本地开发

```bash
cp .env.example .env
make -f Makefile.dev dev
```

默认入口：

- Web Console：`http://localhost:3301`
- Query Service：`http://localhost:8080`
- Agent Service：`http://localhost:4111`
- MCP：`http://localhost:4111/mcp`

## 麒麟交付

麒麟 V11 / LoongArch64 目标机使用：

```bash
cd deploy/kylin-loong64
./preflight.sh
./build-query.sh
./build-agent.sh
./build-frontend.sh
sudo ./install-native.sh
sudo ./acceptance.sh
```

精简部署包由 `deploy/kylin-loong64/package-release.sh` 生成。第三方依赖不进入压缩包，在目标机根据 `go.mod`、`package-lock.json` 和 `yarn.lock` 从配置的软件源安装。

## 许可证

Scry 自主实现模块及仓库内第三方代码分别遵循其适用许可证。分发源码或部署包时必须保留根目录 `LICENSE` 及相关第三方许可证，不得移除其要求保留的版权和许可声明。
