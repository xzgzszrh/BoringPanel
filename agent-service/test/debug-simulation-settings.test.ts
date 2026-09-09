import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('debug simulation setting injects and removes the organization SSH host', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scry-debug-simulation-'));
  process.env.SCRY_AGENT_DATA_DIR = directory;

  try {
    const { db, initializeDatabase } = await import('../src/db.js');
    const {
      getDebugSimulationSettings,
      SIMULATED_SSH_COMMANDS,
      SIMULATED_SSH_HOST_ID,
      updateDebugSimulationSettings,
    } = await import('../src/debug/simulation.js');
    const { listSSHHosts } = await import('../src/ssh/repository.js');
    const { createSSHTools } = await import('../src/tools/ssh-tools.js');

    await initializeDatabase();
    assert.equal(
      (await getDebugSimulationSettings('org-debug')).simulatedSSHEnabled,
      false,
    );

    await updateDebugSimulationSettings('org-debug', true);
    const enabledHosts = await listSSHHosts(true, 'org-debug');
    const simulated = enabledHosts.find((host) => host.id === SIMULATED_SSH_HOST_ID);
    assert.equal(simulated?.simulated, true);
    assert.match(simulated?.name || '', /模拟/);
    assert.equal(
      (await listSSHHosts(true, 'another-org')).some(
        (host) => host.id === SIMULATED_SSH_HOST_ID,
      ),
      false,
    );
    assert.ok(
      SIMULATED_SSH_COMMANDS.some(
        (command) => command.id === 'rolling-restart-quote-service',
      ),
    );

    const sshTools = createSSHTools({
      id: 'debug-admin',
      orgId: 'org-debug',
      email: 'debug@scry.local',
      role: 'ADMIN',
      token: 'debug-token',
    });
    const readonlyApproval = sshTools.sshReadonlyInspect.requireApproval;
    assert.equal(typeof readonlyApproval, 'function');
    if (typeof readonlyApproval === 'function') {
      assert.equal(
        await readonlyApproval({
          hostId: SIMULATED_SSH_HOST_ID,
          commandId: 'disk_usage',
        }),
        true,
      );
    }
    assert.equal(sshTools.sshExecuteCommand.requireApproval, true);

    await updateDebugSimulationSettings('org-debug', false);
    assert.equal(
      (await listSSHHosts(true, 'org-debug')).some(
        (host) => host.id === SIMULATED_SSH_HOST_ID,
      ),
      false,
    );
    await db.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
