#!/usr/bin/env bash
set -euo pipefail

failures=0
pass() { printf '[PASS] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1" >&2; failures=$((failures + 1)); }
check_command() { command -v "$1" >/dev/null 2>&1 && pass "找到 $1" || fail "缺少命令 $1"; }

arch="$(uname -m)"
[[ ${arch} == loongarch64 || ${arch} == loong64 ]] && pass "架构为 ${arch}" || fail "要求 loongarch64，当前为 ${arch}"

if [[ -r /etc/os-release ]]; then
  source /etc/os-release
  [[ ${ID:-} == kylin || ${NAME:-} == *Kylin* || ${NAME:-} == *麒麟* ]] && pass "操作系统为 ${PRETTY_NAME:-Kylin}" || fail "要求麒麟高级服务器操作系统 V11"
  [[ ${VERSION_ID:-} == 11* || ${VERSION:-} == *V11* ]] && pass "系统版本为 V11" || fail "要求麒麟 V11，当前为 ${VERSION_ID:-unknown}"
else
  fail '无法读取 /etc/os-release'
fi

for command in bash curl tar make gcc g++ python3 go psql pg_isready nginx file; do
  check_command "${command}"
done

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  pass '已发现 Node.js 与 npm'
else
  printf '[INFO] Node.js 尚未安装，先执行 build-node.sh\n'
fi

if command -v node >/dev/null 2>&1; then
  node -e "const [a,b,c]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&(b>13||(b===13&&c>=0)))?0:1)" \
    && pass "Node.js $(node -v) 满足 >=22.13.0" || fail "Node.js 必须 >=22.13.0"
fi
if command -v go >/dev/null 2>&1; then
  [[ $(go env GOARCH) == loong64 ]] && pass 'Go 工具链目标为 loong64' || fail "Go GOARCH 为 $(go env GOARCH)，应为 loong64"
fi

pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 && pass 'PostgreSQL 可用' || fail 'PostgreSQL 127.0.0.1:5432 不可用'
if command -v clickhouse-client >/dev/null 2>&1; then
  clickhouse-client --host 127.0.0.1 --query 'SELECT 1' >/dev/null 2>&1 && pass 'ClickHouse 可用' || fail 'ClickHouse 查询失败'
else
  fail '缺少 clickhouse-client；可使用麒麟兼容的本机 ClickHouse 或外部 ClickHouse 服务'
fi

(( failures == 0 )) || { printf '预检失败项: %d\n' "${failures}" >&2; exit 1; }
pass '麒麟 LoongArch64 部署预检完成'
