#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_KEY_FILE="${1:-}"

if [[ ${EUID} -ne 0 ]]; then
  echo "请使用 root 执行 scry-ops 安装脚本" >&2
  exit 1
fi
if [[ -z ${PUBLIC_KEY_FILE} || ! -f ${PUBLIC_KEY_FILE} ]]; then
  echo "用法: $0 /path/to/scry-ops.pub" >&2
  exit 1
fi

if ! getent group scry-ops >/dev/null; then
  groupadd --system scry-ops
fi
if ! id scry-ops >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/scry-ops --shell /bin/bash --gid scry-ops scry-ops
fi

for group in systemd-journal adm; do
  if getent group "${group}" >/dev/null; then
    usermod -a -G "${group}" scry-ops
  fi
done

install -d -o root -g root -m 0755 /opt/scry-ops/bin /etc/scry-ops /etc/ssh/sshd_config.d
install -o root -g root -m 0755 "${SCRIPT_DIR}"/bin/* /opt/scry-ops/bin/
install -o root -g root -m 0644 "${SCRIPT_DIR}/allowed-services.example" /etc/scry-ops/allowed-services
install -o root -g root -m 0440 "${SCRIPT_DIR}/scry-ops.sudoers" /etc/sudoers.d/scry-ops
visudo -cf /etc/sudoers.d/scry-ops

install -d -o scry-ops -g scry-ops -m 0700 /var/lib/scry-ops/.ssh
sed 's/[\r\n]//g' "${PUBLIC_KEY_FILE}" | head -n 1 | sed 's/^/restrict /' > /var/lib/scry-ops/.ssh/authorized_keys
chown scry-ops:scry-ops /var/lib/scry-ops/.ssh/authorized_keys
chmod 0600 /var/lib/scry-ops/.ssh/authorized_keys

install -o root -g root -m 0644 "${SCRIPT_DIR}/60-scry-ops.conf" /etc/ssh/sshd_config.d/60-scry-ops.conf
sshd -t
systemctl reload sshd 2>/dev/null || systemctl reload ssh

echo "scry-ops 最小权限执行环境安装完成"
