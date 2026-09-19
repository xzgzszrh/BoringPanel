# Scry 部署

开发环境使用仓库根目录的 `compose.dev.yaml`：

```bash
cp .env.example .env
make -f Makefile.dev dev
```

麒麟高级服务器操作系统 V11 / LoongArch64 使用宿主机原生部署：

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

受管 Linux 主机的最小权限执行环境位于 `deploy/scry-ops/`。安装后，Scry 只通过
`scry-ops` 公钥账户和固定包装器执行巡检或已审批操作。
