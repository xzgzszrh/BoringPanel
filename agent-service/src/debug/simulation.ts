import { db } from "../db.js";
import type {
  DebugSimulationSettings,
  SSHCommandDefinition,
  SSHHost,
  SSHHostSecret,
} from "../types.js";

export const SIMULATED_SSH_HOST_ID = "00000000-0000-4000-8000-000000000101";

export const SIMULATED_SSH_COMMANDS: SSHCommandDefinition[] = [
  {
    id: "rolling-restart-quote-service",
    name: "滚动重启报价服务",
    description:
      "仅用于调试-报价服务 CPU 与线程池饱和场景；逐实例重启并等待健康检查通过。",
    command: "/opt/scry-ops/bin/scry-restart-quote-service",
  },
  {
    id: "restart-order-service",
    name: "重启订单服务",
    description: "模拟重启异常的订单处理服务，并返回 systemd 校验结果。",
    command: "/opt/scry-ops/bin/scry-restart-service",
  },
  {
    id: "cleanup-system-journal",
    name: "清理系统日志",
    description: "模拟清理过期 systemd journal，释放日志卷空间。",
    command: "/opt/scry-ops/bin/scry-clean-journal",
  },
];

export function buildSimulatedSSHHost(
  updatedAt = Date.now()
): SSHHost & SSHHostSecret {
  return {
    id: SIMULATED_SSH_HOST_ID,
    name: "[模拟] 麒麟业务节点-01",
    hostname: "192.0.2.24",
    port: 22,
    username: "scry-ops",
    authType: "private_key",
    hostKeyFingerprint: "SHA256:ScryDebugKylinNode01LoongArch64",
    enabled: true,
    hasSecret: true,
    simulated: true,
    privateKey: "SCRY_DEBUG_SIMULATED_PRIVATE_KEY",
    createdAt: updatedAt,
    updatedAt,
  };
}

export async function getDebugSimulationSettings(
  orgId: string
): Promise<DebugSimulationSettings> {
  const result = await db.execute({
    sql:
      "SELECT simulated_ssh_enabled, updated_at FROM scry_debug_simulation_settings WHERE org_id = ?",
    args: [orgId],
  });
  const row = result.rows[0];
  return {
    simulatedSSHEnabled: Boolean(Number(row?.simulated_ssh_enabled || 0)),
    simulatedSSHHostId: SIMULATED_SSH_HOST_ID,
    updatedAt: Number(row?.updated_at || 0),
  };
}

export async function updateDebugSimulationSettings(
  orgId: string,
  simulatedSSHEnabled: boolean
): Promise<DebugSimulationSettings> {
  const updatedAt = Date.now();
  await db.execute({
    sql: `INSERT INTO scry_debug_simulation_settings (org_id, simulated_ssh_enabled, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(org_id) DO UPDATE SET
        simulated_ssh_enabled = excluded.simulated_ssh_enabled,
        updated_at = excluded.updated_at`,
    args: [orgId, simulatedSSHEnabled ? 1 : 0, updatedAt],
  });
  return getDebugSimulationSettings(orgId);
}

export async function getSimulatedSSHHost(
  orgId: string
): Promise<(SSHHost & SSHHostSecret) | null> {
  const settings = await getDebugSimulationSettings(orgId);
  return settings.simulatedSSHEnabled
    ? buildSimulatedSSHHost(settings.updatedAt || Date.now())
    : null;
}

export async function isSimulatedSSHHost(
  hostId: string,
  orgId: string
): Promise<boolean> {
  if (hostId !== SIMULATED_SSH_HOST_ID) return false;
  return Boolean(await getSimulatedSSHHost(orgId));
}
