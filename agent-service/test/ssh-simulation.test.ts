import assert from "node:assert/strict";
import { test } from "node:test";

import { simulateSSHCommand, SSH_READONLY_COMMANDS } from "../src/tools/ssh.js";

test("simulated SSH connection and inspection return deterministic Kylin data", () => {
  const connection = simulateSSHCommand(
    "/opt/scry-ops/bin/scry-connection-test"
  );
  assert.equal(connection.stdout, "SCRY_SSH_OK");
  assert.equal(connection.exitCode, 0);

  const overview = simulateSSHCommand(SSH_READONLY_COMMANDS.system_overview);
  assert.match(overview.stdout, /Scry 模拟执行/);
  assert.match(overview.stdout, /Kylin Advanced Server V11/);
  assert.match(overview.stdout, /loongarch64/);
  assert.equal(overview.stderr, "");
});

test("simulated approved operation produces an auditable success result", () => {
  const result = simulateSSHCommand("/opt/scry-ops/bin/scry-restart-service");
  assert.match(result.stdout, /approval: verified/);
  assert.match(result.stdout, /active \(running\)/);
  assert.equal(result.exitCode, 0);
  assert.equal(result.durationMs, 842);
  assert.equal(result.stdoutBytes, Buffer.byteLength(result.stdout));
});

test("quote saturation recovery has an exact approved rolling-restart command", () => {
  const result = simulateSSHCommand(
    "/opt/scry-ops/bin/scry-restart-quote-service"
  );
  assert.match(result.stdout, /target: 调试-报价服务/);
  assert.match(result.stdout, /strategy: rolling restart/);
  assert.match(result.stdout, /queue_depth: 21\/500/);
  assert.equal(result.exitCode, 0);
  assert.equal(result.durationMs, 2_480);
});
