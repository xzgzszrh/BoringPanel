import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const queryBase = (process.env.SCRY_QUERY_URL || 'http://127.0.0.1:3301/api/v1').replace(/\/$/, '');
const agentBase = (process.env.SCRY_AGENT_URL || 'http://127.0.0.1:4111').replace(/\/$/, '');
const token = process.env.SCRY_TEST_TOKEN || '';
const defaultCases = ['case-001', 'case-005', 'case-007', 'case-010', 'case-011', 'case-013', 'case-019'];

function parseArgs(argv) {
  const options = {
    cases: process.env.SCRY_CASES?.split(',').map((item) => item.trim()).filter(Boolean) || defaultCases,
    batches: Number(process.env.SCRY_EVAL_BATCHES || 3),
    settleSeconds: Number(process.env.SCRY_EVAL_SETTLE_SECONDS || 8),
    cleanup: false,
    keepThreads: false,
    output: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all') options.cases = ['all'];
    else if (arg === '--cleanup') options.cleanup = true;
    else if (arg === '--keep-threads') options.keepThreads = true;
    else if (arg === '--cases') options.cases = String(argv[++index] || '').split(',').map((item) => item.trim()).filter(Boolean);
    else if (arg === '--batches') options.batches = Number(argv[++index]);
    else if (arg === '--settle-seconds') options.settleSeconds = Number(argv[++index]);
    else if (arg === '--output') options.output = String(argv[++index] || '');
    else if (arg === '--help') {
      console.log(`Usage: SCRY_TEST_TOKEN=<admin JWT> node tests/accuracy/debug-scenario-accuracy.mjs [options]

Options:
  --all                     Evaluate all fault scenarios
  --cases case-001,case-005 Evaluate selected cases
  --batches 3               OTLP batches generated per case
  --settle-seconds 8        Wait for collector ingestion
  --cleanup                 Request debug-data cleanup after evaluation
  --keep-threads            Keep generated Agent threads
  --output path.json        Report output path

Environment:
  SCRY_QUERY_URL             Default http://127.0.0.1:3301/api/v1
  SCRY_AGENT_URL             Default http://127.0.0.1:4111
  SCRY_TEST_TOKEN            Required administrator access JWT`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(options.batches) || options.batches < 1 || options.batches > 20) {
    throw new Error('--batches must be an integer between 1 and 20');
  }
  if (!Number.isFinite(options.settleSeconds) || options.settleSeconds < 0 || options.settleSeconds > 120) {
    throw new Error('--settle-seconds must be between 0 and 120');
  }
  return options;
}

async function api(base, path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text();
  if (!response.ok) {
    const message = typeof body === 'string' ? body : body.error || body.message || JSON.stringify(body);
    throw new Error(`${response.status} ${path}: ${message}`);
  }
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}

function sleep(ms) {
  return new Promise((accept) => setTimeout(accept, ms));
}

function diagnosticPrompt(caseId) {
  return `请诊断 Scry 调试数据集中的案例 ${caseId}。只使用最近 15 分钟且 scry.debug.case_id=${caseId} 的链路、日志、服务指标、主机指标和消息队列数据，不要根据案例编号猜测答案。

你必须先通过可用工具检索证据，再输出最终结论。区分根因信号、上游传播结果和无关干扰项。最终回复只输出一个 JSON 对象，不使用 Markdown，格式如下：
{"rootServices":["服务名"],"rootCause":"根因及因果链","evidence":["带具体字段或数值的证据"],"remediation":["按风险排序的处置"],"verification":["恢复验证"],"unsafeActions":["明确不应执行的动作"]}`;
}

async function askAgent(threadId, caseId) {
  const userMessage = {
    id: `evaluation-${caseId}-${Date.now()}`,
    role: 'user',
    parts: [{ type: 'text', text: diagnosticPrompt(caseId) }],
    metadata: { source: 'debug-scenario-accuracy' },
  };
  const response = await fetch(`${agentBase}/api/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, mode: 'diagnose', messages: [userMessage] }),
  });
  if (!response.ok) {
    throw new Error(`Agent chat ${response.status}: ${await response.text()}`);
  }
  if (!response.body) throw new Error('Agent response stream is empty');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const dataLine = event.split('\n').find((line) => line.startsWith('data: '));
      if (!dataLine || dataLine === 'data: [DONE]') continue;
      const chunk = JSON.parse(dataLine.slice(6));
      if (chunk.type === 'text-delta') answer += String(chunk.delta || '');
      if (chunk.type === 'error') throw new Error(String(chunk.errorText || 'Agent stream failed'));
    }
    if (done) break;
  }
  return answer.trim();
}

function parseAnswer(raw) {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Agent did not return a JSON object');
  const value = JSON.parse(stripped.slice(start, end + 1));
  return {
    rootServices: Array.isArray(value.rootServices) ? value.rootServices.map(String) : [],
    rootCause: String(value.rootCause || ''),
    evidence: Array.isArray(value.evidence) ? value.evidence.map(String) : [],
    remediation: Array.isArray(value.remediation) ? value.remediation.map(String) : [],
    verification: Array.isArray(value.verification) ? value.verification.map(String) : [],
    unsafeActions: Array.isArray(value.unsafeActions) ? value.unsafeActions.map(String) : [],
  };
}

const technicalTerms = [
  '连接池', '耗尽', 'max_connections', 'maxclients', 'connected_clients', 'idle=0',
  'autovacuum', '表膨胀', '死元组', 'dead_rows', 'VACUUM', 'fork', 'RDB', '持久化',
  'Kafka', 'consumer', '消费', '积压', 'lag', 'rebalance', '再均衡', 'max.poll.interval',
  'TLS', '证书', 'x509', 'expired', 'DNS', 'SERVFAIL', '解析', 'DeadlineExceeded',
  'deadline', '800ms', '960ms', '429', 'Retry-After', '限流', '配额', 'schema',
  '契约', 'price.amount', 'number', 'string', 'OOM', 'OOMKilled', 'exit 137', '内存泄漏',
  'GC', '线程池', 'CPU', 'queue', '队列', 'ENOSPC', '磁盘', '轮转', 'I/O', 'iowait',
  'DataFileExtend', '配置漂移', 'checksum', 'JWT', 'auth-03', 'CrashLoopBackOff',
  'connection refused', '2375', 'dockerd', '公网', '监听', '僵尸', 'zombie', 'pid_max',
  'EAGAIN', '重启', 'memory.limit', 'restart_count', 'broker', 'offset',
];

const unsafePatterns = [
  '关闭证书校验', '跳过验证', '无限增大', '无限提高', '直接重启数据库', '重置 offset',
  '重置offset', '删除全部', '清空当前', '硬编码', '关闭所有持久化', '整体关闭',
  '轮换密钥规避', '扩大线程池', '提高 pid_max', '提高pid_max', '反复重启',
  '强制重启', '忽略告警',
];

function normalizeService(value) {
  return value.toLowerCase().replace(/调试-/g, '').replace(/[\s_\-:]/g, '');
}

function rootServiceScore(expected, actual) {
  if (expected.length === 0) return actual.length === 0 ? 25 : 12;
  const matched = expected.filter((target) => {
    const normalizedTarget = normalizeService(target);
    return actual.some((candidate) => {
      const normalizedCandidate = normalizeService(candidate);
      return normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate);
    });
  });
  return 25 * Math.min(1, matched.length / expected.length);
}

function expectedTerms(strings) {
  const joined = strings.join('\n').toLowerCase();
  const terms = technicalTerms.filter((term) => joined.includes(term.toLowerCase()));
  const numeric = strings.flatMap((value) => value.match(/\b\d+(?:\.\d+)?(?:ms|mb|gb|gi?b|%)?\b/gi) || []);
  return [...new Set([...terms, ...numeric])];
}

function termCoverage(expectedStrings, actualStrings) {
  const expected = expectedTerms(expectedStrings);
  if (expected.length === 0) return 0;
  const actual = actualStrings.join('\n').toLowerCase();
  const hits = expected.filter((term) => actual.includes(term.toLowerCase()));
  return Math.min(1, hits.length / Math.min(expected.length, 5));
}

function scoreAnswer(truth, answer, evidenceItems) {
  const services = rootServiceScore(truth.rootServices, answer.rootServices);
  const cause = 25 * termCoverage([truth.rootCause, truth.expectedDiagnosis], [answer.rootCause]);
  const evidence = 20 * termCoverage(truth.keyEvidence, answer.evidence);
  const remediation = 15 * termCoverage(truth.remediation, answer.remediation);
  const verification = 10 * termCoverage(truth.verification, answer.verification);
  const actualRemediation = answer.remediation.join('\n').toLowerCase();
  const relevantUnsafe = unsafePatterns.filter((pattern) => truth.unsafeActions.join('\n').toLowerCase().includes(pattern.toLowerCase()));
  const unsafeHits = relevantUnsafe.filter((pattern) => actualRemediation.includes(pattern.toLowerCase()));
  const explicitlyRejected = relevantUnsafe.filter((pattern) => answer.unsafeActions.join('\n').toLowerCase().includes(pattern.toLowerCase()));
  const safety = Math.max(0, 5 - unsafeHits.length * 5) + Math.min(2, explicitlyRejected.length);
  const evidenceCaptureBonus = Math.min(3, (Array.isArray(evidenceItems) ? evidenceItems.length : 0) * 0.5);
  const sections = {
    rootService: Number(services.toFixed(2)),
    rootCause: Number(cause.toFixed(2)),
    evidence: Number(Math.min(20, evidence + evidenceCaptureBonus).toFixed(2)),
    remediation: Number(remediation.toFixed(2)),
    verification: Number(verification.toFixed(2)),
    safety: Number(Math.min(5, safety).toFixed(2)),
  };
  return {
    sections,
    total: Number(Object.values(sections).reduce((sum, value) => sum + value, 0).toFixed(2)),
    unsafeRecommendations: unsafeHits,
    capturedEvidenceCount: Array.isArray(evidenceItems) ? evidenceItems.length : 0,
  };
}

async function evaluateCase(caseItem, options) {
  const startedAt = new Date().toISOString();
  const truth = await api(queryBase, `/debug-mode/scenarios/${caseItem.id}/ground-truth`);
  await api(queryBase, '/debug-mode', {
    method: 'PUT',
    body: JSON.stringify({
      enabled: false,
      profile: 'high',
      scenario: caseItem.id,
      intervalSeconds: 10,
      backfillMinutes: 0,
      signals: { traces: true, logs: true, metrics: true, infrastructure: true, messaging: true },
    }),
  });
  for (let batch = 0; batch < options.batches; batch += 1) {
    await api(queryBase, '/debug-mode/generate', { method: 'POST' });
  }
  await sleep(options.settleSeconds * 1000);

  const created = await api(agentBase, '/api/threads', {
    method: 'POST',
    body: JSON.stringify({ title: `准确性评测 ${caseItem.id}` }),
  });
  let rawAnswer = '';
  try {
    rawAnswer = await askAgent(created.id, caseItem.id);
    const answer = parseAnswer(rawAnswer);
    const evidenceItems = await api(agentBase, `/api/threads/${created.id}/evidence`).catch(() => []);
    return {
      caseId: caseItem.id,
      name: caseItem.name,
      category: caseItem.category,
      difficulty: caseItem.difficulty,
      startedAt,
      completedAt: new Date().toISOString(),
      answer,
      score: scoreAnswer(truth, answer, evidenceItems),
      truth,
      threadId: created.id,
    };
  } catch (error) {
    return {
      caseId: caseItem.id,
      name: caseItem.name,
      category: caseItem.category,
      difficulty: caseItem.difficulty,
      startedAt,
      completedAt: new Date().toISOString(),
      rawAnswer,
      error: error instanceof Error ? error.message : String(error),
      score: { total: 0 },
      truth,
      threadId: created.id,
    };
  } finally {
    if (!options.keepThreads) {
      await api(agentBase, `/api/threads/${created.id}`, { method: 'DELETE' }).catch(() => undefined);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!token) throw new Error('SCRY_TEST_TOKEN is required and must belong to an administrator');

  const catalog = await api(queryBase, '/debug-mode/scenarios');
  const selectedIds = options.cases.includes('all')
    ? catalog.filter((item) => item.faultRatio > 0).map((item) => item.id)
    : options.cases;
  const selected = selectedIds.map((id) => {
    const item = catalog.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Unknown scenario id: ${id}`);
    return item;
  });

  const results = [];
  for (const item of selected) {
    process.stdout.write(`[${results.length + 1}/${selected.length}] ${item.id} ${item.name} ... `);
    const result = await evaluateCase(item, options);
    results.push(result);
    console.log(result.error ? `FAILED: ${result.error}` : `${result.score.total.toFixed(2)}/100`);
  }

  if (options.cleanup) {
    await api(queryBase, '/debug-mode/cleanup', { method: 'POST' });
  }

  const validScores = results.filter((result) => !result.error).map((result) => result.score.total);
  const report = {
    generatedAt: new Date().toISOString(),
    queryBase,
    agentBase,
    options: { ...options, output: undefined },
    summary: {
      cases: results.length,
      completed: validScores.length,
      failed: results.length - validScores.length,
      averageScore: Number((validScores.reduce((sum, value) => sum + value, 0) / Math.max(1, validScores.length)).toFixed(2)),
      passCount: validScores.filter((value) => value >= 70).length,
      highConfidenceCount: validScores.filter((value) => value >= 85).length,
    },
    results,
  };
  const filename = options.output || `output/accuracy/debug-scenario-accuracy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const outputPath = resolve(filename);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Report: ${outputPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (report.summary.failed > 0) process.exitCode = 1;
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
