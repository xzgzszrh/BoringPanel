#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${SCRY_BUILD_OUT:-${ROOT}/output/kylin-loong64}"
[[ $(go env GOARCH) == loong64 ]] || { echo 'Go 工具链必须运行在 loong64 目标机' >&2; exit 1; }
mkdir -p "${OUT}/bin"
cd "${ROOT}"
CGO_ENABLED=1 GOOS=linux GOARCH=loong64 go build -trimpath -ldflags='-s -w' -o "${OUT}/bin/scry-query-service" ./pkg/query-service
file "${OUT}/bin/scry-query-service" | grep -Eiq 'LoongArch|loongarch' || { echo '产物架构校验失败' >&2; exit 1; }
