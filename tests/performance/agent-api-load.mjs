import { performance } from 'node:perf_hooks';

const baseUrl = process.env.SCRY_AGENT_URL || 'http://127.0.0.1:4111';
const token = process.env.SCRY_TEST_TOKEN || '';
const requests = Number(process.env.SCRY_LOAD_REQUESTS || 200);
const concurrency = Number(process.env.SCRY_LOAD_CONCURRENCY || 20);
const path = token ? '/api/mcp/tools' : '/health';
const durations = [];
let failures = 0;
let cursor = 0;

async function worker() {
  while (cursor < requests) {
    cursor += 1;
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch {
      failures += 1;
    }
    durations.push(performance.now() - started);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
durations.sort((left, right) => left - right);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.floor(durations.length * value))] || 0;
const result = {
  target: `${baseUrl}${path}`,
  requests,
  concurrency,
  failures,
  p50Ms: Number(percentile(0.5).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
};
console.log(JSON.stringify(result, null, 2));
if (failures > 0) process.exitCode = 1;
