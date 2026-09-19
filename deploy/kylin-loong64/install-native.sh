#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="${ROOT}/deploy/kylin-loong64"
INSTALL_ROOT="${SCRY_INSTALL_ROOT:-/opt/scry}"
DATA_ROOT="${SCRY_DATA_ROOT:-/var/lib/scry}"

[[ ${EUID} -eq 0 ]] || { echo '请使用 root 执行安装' >&2; exit 1; }
grep -q 'CHANGE_ME' "${DEPLOY_DIR}/platform.env" && { echo '请先修改 platform.env 中的密钥占位符' >&2; exit 1; }
id scry >/dev/null 2>&1 || useradd --system --home-dir "${DATA_ROOT}" --shell /usr/sbin/nologin scry
install -d -o root -g root -m 0755 "${INSTALL_ROOT}" "${INSTALL_ROOT}/bin" "${INSTALL_ROOT}/agent" "${INSTALL_ROOT}/frontend"
install -d -o root -g root -m 0755 "${INSTALL_ROOT}/config" "${INSTALL_ROOT}/dashboards" "${INSTALL_ROOT}/templates"
install -d -o scry -g scry -m 0750 "${DATA_ROOT}" "${DATA_ROOT}/agent" "${DATA_ROOT}/query"
install -o root -g root -m 0755 "${ROOT}/output/kylin-loong64/bin/scry-query-service" "${INSTALL_ROOT}/bin/"
cp -a "${ROOT}/agent-service/dist" "${ROOT}/agent-service/node_modules" "${ROOT}/agent-service/package.json" "${INSTALL_ROOT}/agent/"
cp -a "${ROOT}/frontend/build/." "${INSTALL_ROOT}/frontend/"
install -o root -g root -m 0644 "${ROOT}/pkg/query-service/config/prometheus.yml" "${INSTALL_ROOT}/config/prometheus.yml"
cp -a "${ROOT}/deploy/docker/dashboards/." "${INSTALL_ROOT}/dashboards/"
install -o root -g root -m 0644 "${ROOT}/pkg/query-service/templates/invitation_email_template.html" "${INSTALL_ROOT}/templates/"
install -o root -g scry -m 0640 "${DEPLOY_DIR}/platform.env" /etc/scry.env
install -o root -g root -m 0644 "${DEPLOY_DIR}/systemd/scry-agent.service" "${DEPLOY_DIR}/systemd/scry-query.service" /etc/systemd/system/
install -o root -g root -m 0644 "${DEPLOY_DIR}/nginx-scry.conf" /etc/nginx/conf.d/scry.conf
systemctl daemon-reload
systemctl enable --now scry-query scry-agent nginx
