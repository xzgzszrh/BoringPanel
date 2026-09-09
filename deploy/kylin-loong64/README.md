# Scry 麒麟 V11 / LoongArch64 原生部署

该部署路径不依赖 amd64/arm64 容器镜像。Query Service 在目标机使用 LoongArch64 Go 与
CGO 工具链原生编译；Agent 使用 LoongArch64 Node.js 22、WASM SQLite 和 PostgreSQL；
Frontend 构建为 Nginx 静态资源。

部署顺序：

```bash
sudo ./build-node.sh
sudo SCRY_POSTGRES_PASSWORD='替换为强密码' ./setup-postgres.sh
./preflight.sh
./build-query.sh
./build-agent.sh
./build-frontend.sh
sudo ./install-native.sh
sudo ./acceptance.sh
```

执行安装前必须修改 `platform.env` 中的 PostgreSQL 密码和 Agent 主密钥，并在 PostgreSQL
中创建 `scry_agent` 数据库与最小权限账户。ClickHouse 可使用麒麟兼容的本机软件包，也可
指向内网独立集群；`preflight.sh` 会通过原生客户端执行查询验证，未通过时不会继续验收。

`build-query.sh` 必须在目标 LoongArch64 主机运行，因为 Query Service 使用 SQLite CGO。
`build-node.sh` 从 Node.js 官方源码构建并校验 `process.arch=loong64`，避免使用不包含
LoongArch64 清单的官方容器镜像。

## 生成精简部署包

在开发机根目录执行：

```bash
./deploy/kylin-loong64/package-release.sh
```

产物位于 `output/releases/`，包含源码、锁文件、麒麟安装脚本、systemd/Nginx 配置、
`scry-ops` 和比赛文档。部署包不包含 `node_modules`、Go 模块缓存、测试、样例程序、
本机构建产物、数据库、密钥或 Git 历史。依赖在目标机根据锁文件从配置的软件源安装。

将压缩包传到麒麟目标机后：

```bash
sha256sum -c scry-1.0.0-kylin-v11-loong64.tar.gz.sha256
tar -xzf scry-1.0.0-kylin-v11-loong64.tar.gz
cd scry-1.0.0-kylin-v11-loong64/deploy/kylin-loong64
sudo ./build-node.sh
sudo SCRY_POSTGRES_PASSWORD='替换为强密码' ./setup-postgres.sh
./preflight.sh
./build-query.sh
./build-agent.sh
./build-frontend.sh
sudo ./install-native.sh
sudo ./acceptance.sh
```
