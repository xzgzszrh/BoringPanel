#!/usr/bin/env bash
set -euo pipefail

failures=0
check() { if "$@"; then printf '[PASS] %s\n' "$*"; else printf '[FAIL] %s\n' "$*" >&2; failures=$((failures + 1)); fi; }

arch="$(uname -m)"
if [[ ${arch} == loongarch64 || ${arch} == loong64 ]]; then
  printf '[PASS] 架构为 %s\n' "${arch}"
else
  printf '[FAIL] 架构为 %s\n' "${arch}" >&2
  failures=$((failures + 1))
fi
check systemctl is-active --quiet postgresql
check systemctl is-active --quiet scry-query
check systemctl is-active --quiet scry-agent
check systemctl is-active --quiet nginx
check curl --fail --silent http://127.0.0.1:4111/health
check curl --fail --silent 'http://127.0.0.1:8080/api/v1/health?live=1'
check curl --fail --silent http://127.0.0.1/
check test "$(systemctl show scry-agent -p User --value)" = scry
check test "$(systemctl show scry-query -p User --value)" = scry
check test "$(stat -c %U /var/lib/scry/agent)" = scry
check bash -c "! systemctl cat scry-agent | grep -q Docker"

if [[ -n ${SCRY_ACCEPTANCE_TOKEN:-} ]]; then
  check curl --fail --silent -H "Authorization: Bearer ${SCRY_ACCEPTANCE_TOKEN}" http://127.0.0.1:4111/api/mcp/tools
fi
(( failures == 0 )) || exit 1
printf 'Scry 麒麟 V11 / LoongArch64 验收通过\n'
