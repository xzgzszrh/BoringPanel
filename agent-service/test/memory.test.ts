import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const testDirectory = await mkdtemp(join(tmpdir(), 'scry-memory-'));
process.env.SCRY_AGENT_DATABASE_URL = `file:${join(testDirectory, 'agent.db')}`;

const {
  createMemory,
  extractErrorSignature,
  extractTraceEdges,
  maintainMemories,
  retrieveMemories,
} = await import('../src/memory/index.js');
const {
  deleteSampleMemory,
  generateMemorySamples,
  listMemorySamples,
} = await import('../src/memory/samples.js');
const { db, initializeDatabase } = await import('../src/db.js');

await initializeDatabase();
after(async () => {
  await db.close();
  await rm(testDirectory, { recursive: true, force: true });
});

const user = {
  id: 'memory-user',
  orgId: 'memory-org',
  email: 'memory@example.invalid',
  role: 'ADMIN' as const,
  token: 'test-token',
};

test('trace extraction and signature extraction use runtime incident fields', () => {
  const trace = { spans: [
    { spanId: '1', serviceName: 'checkout', status: 'ERROR' },
    { spanId: '2', parentSpanId: '1', serviceName: 'currency', errorRate: 0.4 },
    { spanId: '3', parentSpanId: '2', serviceName: 'postgres', errorRate: 0.8, error: 'pool_exhausted' },
  ] };
  const edges = extractTraceEdges(trace);
  assert.deepEqual(edges.map((edge) => `${edge.from}->${edge.to}`), ['checkout->currency', 'currency->postgres']);
  assert.ok(extractErrorSignature('checkout HTTP 500', [{
    id: 'e', threadId: 't', orgId: user.orgId, userId: user.id, traceId: 'trace', messageId: '',
    sourceType: 'telemetry', sourceName: 'trace', title: 'trace', summary: 'pool_exhausted', content: trace,
    contentHash: 'h', confidence: 90, relevance: 90,
    scoreFactors: { sourceReliability: 90, dataQuality: 90, freshness: 90, executionIntegrity: 90, directness: 90, lexicalMatch: 90 },
    status: 'active', selected: true, note: '', capturedAt: Date.now(), updatedAt: Date.now(), relations: [], actions: [],
  }]).some((token) => token.includes('500') || token.includes('pool_exhausted')));
});

test('TopoMem prioritizes a root-service record across a vocabulary gap', async () => {
  await createMemory({
    user, type: 'semantic', scope: 'organization', serviceName: 'checkout', title: '前端 HTTP 500 排查',
    summary: '检查页面延迟和购物车超时。', content: { symptoms: ['HTTP 500', 'cart_timeout'] }, confidence: 80, importance: 65,
  });
  const root = await createMemory({
    user, type: 'procedural', scope: 'organization', serviceName: 'postgres', title: 'PostgreSQL 连接池耗尽处置',
    summary: 'pool_exhausted 时检查连接上限、泄漏和等待队列。', content: { signature: 'pool_exhausted', action: 'inspect connection pool' },
    confidence: 92, importance: 90, status: 'verified',
  });
  const evidence = [{
    id: 'trace-evidence', threadId: 'thread', orgId: user.orgId, userId: user.id, traceId: 'runtime-trace', messageId: '',
    sourceType: 'telemetry' as const, sourceName: 'query-signals', title: '异常链路', summary: 'checkout HTTP 500，终端 span pool_exhausted',
    content: { spans: [
      { spanId: '1', serviceName: 'checkout', status: 'ERROR' },
      { spanId: '2', parentSpanId: '1', serviceName: 'currency', errorRate: 0.5 },
      { spanId: '3', parentSpanId: '2', serviceName: 'postgres', errorRate: 0.9, error: 'pool_exhausted' },
    ] },
    contentHash: 'trace-hash', confidence: 94, relevance: 96,
    scoreFactors: { sourceReliability: 92, dataQuality: 90, freshness: 100, executionIntegrity: 100, directness: 96, lexicalMatch: 80 },
    status: 'active' as const, selected: true, note: '', capturedAt: Date.now(), updatedAt: Date.now(), relations: [], actions: [],
  }];
  const packet = await retrieveMemories({ user, query: 'checkout 出现 HTTP 500，先检查哪里？',
    context: { threadId: 'thread', traceId: 'runtime-trace', evidence }, limit: 5 });
  assert.equal(packet.strategy, 'topomem');
  assert.deepEqual(packet.paths[0], ['checkout', 'currency', 'postgres']);
  assert.equal(packet.results[0].memory.id, root.id);
  assert.ok(packet.results[0].factors.topology > packet.results[1].factors.topology);
  assert.ok(packet.results[0].memory.chunks.length >= 1);
  assert.ok(packet.results[0].matchedChunks.length >= 1);
});

test('memory content is split into stable preview and retrieval chunks', async () => {
  const content = ['第一段描述服务画像和依赖。'.repeat(90), '第二段记录处置步骤和验证方法。'.repeat(90)].join('\n\n');
  const memory = await createMemory({
    user, type: 'procedural', scope: 'user', serviceName: 'chunk-service', title: '分块预览测试',
    summary: '验证长记忆按段落边界拆分。', content, confidence: 82, importance: 70,
  });
  assert.ok(memory.chunks.length >= 3);
  assert.deepEqual(memory.chunks.map((chunk) => chunk.index), memory.chunks.map((_, index) => index));
  assert.ok(memory.chunks.every((chunk) => chunk.content.length <= 1800));
});

test('paper-derived sample memories are selectable, idempotent, and removable', async () => {
  const catalog = await listMemorySamples(user);
  assert.equal(catalog.length, 9);
  assert.ok(new Set(catalog.map((sample) => sample.category)).size >= 5);

  const sampleIds = catalog.slice(0, 2).map((sample) => sample.id);
  const first = await generateMemorySamples({ user, sampleIds });
  assert.equal(first.createdCount, 2);
  assert.equal(first.existingCount, 0);
  assert.ok(first.memories.every((memory) => memory.tags.includes('sample')));
  assert.ok(first.memories.every((memory) => memory.sources.some((source) => source.sourceType === 'document')));

  const second = await generateMemorySamples({ user, sampleIds });
  assert.equal(second.createdCount, 0);
  assert.equal(second.existingCount, 2);
  assert.deepEqual(second.memories.map((memory) => memory.id), first.memories.map((memory) => memory.id));

  const removed = await deleteSampleMemory(first.memories[0].id, user);
  assert.equal(removed?.sampleId, sampleIds[0]);
  const removedMemoryId = first.memories[0].id;
  const [itemRows, chunkRows, sourceRows, relationRows, actionRows] = await Promise.all([
    db.execute({ sql: 'SELECT id FROM scry_memory_items WHERE id = ?', args: [removedMemoryId] }),
    db.execute({ sql: 'SELECT id FROM scry_memory_chunks WHERE memory_id = ?', args: [removedMemoryId] }),
    db.execute({ sql: 'SELECT id FROM scry_memory_sources WHERE memory_id = ?', args: [removedMemoryId] }),
    db.execute({
      sql: 'SELECT id FROM scry_memory_relations WHERE from_memory_id = ? OR to_memory_id = ?',
      args: [removedMemoryId, removedMemoryId],
    }),
    db.execute({ sql: 'SELECT id FROM scry_memory_actions WHERE memory_id = ?', args: [removedMemoryId] }),
  ]);
  assert.ok([itemRows, chunkRows, sourceRows, relationRows, actionRows].every((result) => result.rows.length === 0));
  const refreshed = await listMemorySamples(user);
  assert.equal(refreshed.find((sample) => sample.id === sampleIds[0])?.generatedMemoryId, '');
});

test('maintenance archives expired working memory without hard deletion', async () => {
  const expired = await createMemory({
    user, type: 'working', scope: 'user', title: '临时排查假设', summary: '只在本次短期排查中有效。',
    content: { hypothesis: 'temporary' }, expiresAt: Date.now() - 1, confidence: 50, importance: 20,
  });
  const report = await maintainMemories(user);
  assert.ok(report.expired >= 1);
  const row = await db.execute({ sql: 'SELECT status, content_json FROM scry_memory_items WHERE id = ?', args: [expired.id] });
  assert.equal(row.rows[0].status, 'archived');
  assert.notEqual(row.rows[0].content_json, 'null');
});
