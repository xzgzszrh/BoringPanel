import { createHash } from 'node:crypto';
import { Client } from 'ssh2';
export const SSH_READONLY_COMMANDS = {
    system_overview: '/opt/scry-ops/bin/scry-system-overview',
    disk_usage: '/opt/scry-ops/bin/scry-disk-usage',
    memory_usage: '/opt/scry-ops/bin/scry-memory-usage',
    failed_services: '/opt/scry-ops/bin/scry-failed-services',
    network_listeners: '/opt/scry-ops/bin/scry-network-listeners',
    recent_errors: '/opt/scry-ops/bin/scry-recent-errors',
    security_preflight: '/opt/scry-ops/bin/scry-security-preflight',
};
export const SSH_READONLY_COMMAND_LABELS = {
    system_overview: '系统概览',
    disk_usage: '磁盘使用情况',
    memory_usage: '内存使用情况',
    failed_services: '失败的系统服务',
    network_listeners: '网络监听端口',
    recent_errors: '近期系统错误',
    security_preflight: '最小权限环境校验',
};
const DEFAULT_OUTPUT_LIMIT = 200_000;
const simulatedOutputByCommand = {
    '/opt/scry-ops/bin/scry-connection-test': 'SCRY_SSH_OK',
    '/opt/scry-ops/bin/scry-system-overview': `[Scry 模拟执行]
hostname: scry-debug-kylin-01
os: Kylin Advanced Server V11
kernel: 6.6.0-28.0.0.31.oe2403.loongarch64
architecture: loongarch64
uptime: 18 days, 07:42
load average: 4.82, 3.96, 2.71`,
    '/opt/scry-ops/bin/scry-disk-usage': `[Scry 模拟执行]
Filesystem              Size  Used Avail Use% Mounted on
/dev/mapper/kylin-root   80G   39G   41G  49% /
/dev/mapper/scry-data   120G  111G  9.0G  93% /var/lib/scry-data
/dev/mapper/scry-log     40G   34G  6.0G  85% /var/log`,
    '/opt/scry-ops/bin/scry-memory-usage': `[Scry 模拟执行]
MemTotal:       16384 MiB
MemUsed:        13792 MiB
MemAvailable:    2592 MiB
SwapTotal:       4096 MiB
SwapUsed:        1536 MiB
pressure: some avg10=12.41 avg60=9.88 avg300=6.32`,
    '/opt/scry-ops/bin/scry-failed-services': `[Scry 模拟执行]
UNIT                         LOAD   ACTIVE SUB    DESCRIPTION
scry-order-worker.service    loaded failed failed Scry order worker
systemd-journal-flush.service loaded failed failed Flush Journal to Persistent Storage`,
    '/opt/scry-ops/bin/scry-network-listeners': `[Scry 模拟执行]
tcp LISTEN 0 4096 0.0.0.0:22    users:((sshd,pid=912,fd=3))
tcp LISTEN 0 2048 0.0.0.0:8080  users:((scry-order,pid=2816,fd=12))
tcp LISTEN 0 1024 127.0.0.1:9090 users:((scry-metrics,pid=1902,fd=8))`,
    '/opt/scry-ops/bin/scry-recent-errors': `[Scry 模拟执行]
Jul 20 10:21:44 scry-debug-kylin-01 order-worker[2816]: ERROR kafka consumer lag exceeded threshold topic=order-events lag=18432
Jul 20 10:21:46 scry-debug-kylin-01 order-worker[2816]: ERROR database timeout operation=reserve_inventory timeout_ms=3000
Jul 20 10:22:03 scry-debug-kylin-01 systemd[1]: scry-order-worker.service: Main process exited, status=1/FAILURE`,
    '/opt/scry-ops/bin/scry-security-preflight': `[Scry 模拟执行]
PASS user=scry-ops uid=995 shell=/usr/sbin/nologin
PASS group=scry-ops
PASS authorized_keys permissions=0600
PASS managed wrappers=9
PASS sudoers command allowlist verified
PASS root login disabled`,
    '/opt/scry-ops/bin/scry-restart-service': `[Scry 模拟执行]
approval: verified
action: restart scry-order-worker.service
result: active (running)
health_check: passed
elapsed_ms: 842`,
    '/opt/scry-ops/bin/scry-restart-quote-service': `[Scry 模拟执行]
approval: verified
target: 调试-报价服务
strategy: rolling restart
instances: quote-01 healthy, quote-02 healthy, quote-03 healthy
active_threads: 18/64
queue_depth: 21/500
cpu_utilization: 0.46
health_check: passed
result: completed`,
    '/opt/scry-ops/bin/scry-clean-journal': `[Scry 模拟执行]
approval: verified
vacuum_before: 34.2G
vacuum_after: 9.8G
released: 24.4G
result: completed`,
};
export function simulateSSHCommand(command) {
    const stdout = simulatedOutputByCommand[command] || `[Scry 模拟执行]\ncommand: ${command}\nresult: completed`;
    return {
        stdout,
        stderr: '',
        exitCode: 0,
        signal: null,
        durationMs: command.includes('quote-service')
            ? 2_480
            : command.includes('restart')
                ? 842
                : 126,
        stdoutBytes: Buffer.byteLength(stdout),
        stderrBytes: 0,
        truncated: false,
    };
}
function fingerprint(key) {
    return `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
}
function normalizedFingerprint(value) {
    return value.trim().replace(/^SHA256:/i, '').replace(/=+$/, '');
}
function connectionConfig(host) {
    return {
        host: host.hostname,
        port: host.port,
        username: host.username,
        password: host.authType === 'password' ? host.password : undefined,
        privateKey: host.authType === 'private_key' ? host.privateKey : undefined,
        passphrase: host.authType === 'private_key' ? host.passphrase : undefined,
        hostVerifier: (key) => normalizedFingerprint(fingerprint(key)) === normalizedFingerprint(host.hostKeyFingerprint),
        readyTimeout: 15_000,
        keepaliveInterval: 5_000,
        keepaliveCountMax: 3,
    };
}
export async function probeSSHHostKey(hostname, port) {
    return new Promise((resolve, reject) => {
        const client = new Client();
        let settled = false;
        const finish = (error, value) => {
            if (settled)
                return;
            settled = true;
            client.end();
            if (error)
                reject(error);
            else
                resolve(value);
        };
        client
            .once('error', (error) => {
            if (!settled)
                finish(new Error(`无法获取 SSH 主机指纹：${error.message}`));
        })
            .connect({
            host: hostname,
            port,
            username: '__scry_fingerprint_probe__',
            readyTimeout: 15_000,
            hostVerifier: (key) => {
                finish(undefined, fingerprint(key));
                return false;
            },
        });
    });
}
export async function executeSSHCommand(host, command, timeoutSeconds = 30, outputLimit = DEFAULT_OUTPUT_LIMIT) {
    if (host.simulated)
        return simulateSSHCommand(command);
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
        const client = new Client();
        let settled = false;
        let stdout = Buffer.alloc(0);
        let stderr = Buffer.alloc(0);
        let stdoutBytes = 0;
        let stderrBytes = 0;
        let truncated = false;
        const finish = (error, result) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            client.end();
            if (error)
                reject(error);
            else
                resolve({
                    ...result,
                    durationMs: Date.now() - startedAt,
                    stdoutBytes,
                    stderrBytes,
                    truncated,
                });
        };
        const append = (target, chunk) => {
            if (target === 'stdout')
                stdoutBytes += chunk.length;
            else
                stderrBytes += chunk.length;
            const captured = stdout.length + stderr.length;
            const remaining = Math.max(0, outputLimit - captured);
            if (remaining === 0) {
                truncated = true;
                return;
            }
            const next = chunk.subarray(0, remaining);
            if (next.length < chunk.length)
                truncated = true;
            if (target === 'stdout')
                stdout = Buffer.concat([stdout, next]);
            else
                stderr = Buffer.concat([stderr, next]);
        };
        const timer = setTimeout(() => finish(new Error(`SSH 命令执行超过 ${timeoutSeconds} 秒，已终止连接`)), timeoutSeconds * 1000);
        client
            .once('ready', () => {
            client.exec(command, { pty: false }, (error, stream) => {
                if (error) {
                    finish(new Error(`SSH 命令启动失败：${error.message}`));
                    return;
                }
                stream.on('data', (chunk) => append('stdout', chunk));
                stream.stderr.on('data', (chunk) => append('stderr', chunk));
                stream.once('close', (code, signal) => finish(undefined, {
                    stdout: stdout.toString('utf8'),
                    stderr: stderr.toString('utf8'),
                    exitCode: code,
                    signal,
                }));
                stream.once('error', (streamError) => finish(new Error(`SSH 数据流错误：${streamError.message}`)));
            });
        })
            .once('error', (error) => finish(new Error(`SSH 连接失败：${error.message}`)))
            .connect(connectionConfig(host));
    });
}
export async function testSSHConnection(host) {
    return executeSSHCommand(host, '/opt/scry-ops/bin/scry-connection-test', 15, 1024);
}
//# sourceMappingURL=ssh.js.map