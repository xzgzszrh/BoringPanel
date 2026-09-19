import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { WorkflowStepDefinition } from '../src/types.js';
import { workflowPresets } from '../src/workflows/presets.js';

function collectIds(steps: WorkflowStepDefinition[]): string[] {
  return steps.flatMap((step) => [
    step.id,
    ...(step.condition ? collectIds([...step.condition.whenTrue, ...step.condition.whenFalse]) : []),
    ...(step.parallel ? collectIds(step.parallel.branches.flatMap((branch) => branch.steps)) : []),
    ...(step.loop ? collectIds(step.loop.steps) : []),
  ]);
}

test('competition workflow presets have unique ids and bounded definitions', () => {
  const presets = workflowPresets();
  assert.equal(presets.length, 9);
  assert.equal(new Set(presets.map((preset) => preset.id)).size, presets.length);
  for (const preset of presets) {
    const ids = collectIds(preset.definition.steps);
    assert.equal(new Set(ids).size, ids.length, `${preset.id} contains duplicate step ids`);
    assert.ok(ids.length <= 100);
  }
});

test('change presets include approval and verification', () => {
  for (const id of ['preset-disk-full', 'preset-service-recovery']) {
    const preset = workflowPresets().find((item) => item.id === id);
    assert.ok(preset);
    assert.ok(preset.definition.steps.some((step) => step.type === 'approval'));
    assert.ok(preset.definition.steps.some((step) => step.type === 'verify'));
  }
});
