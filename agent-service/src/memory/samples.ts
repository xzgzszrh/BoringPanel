import { db } from '../db.js';
import { addSecurityAuditEvent } from '../security/audit.js';
import type { AuthenticatedUser, MemoryItem } from '../types.js';
import { createMemory, getMemory } from './index.js';
import {
  memorySampleCatalog,
  type MemorySampleCatalogItem,
  type MemorySampleDefinition,
} from './sample-catalog.js';

const SAMPLE_TAG = 'sample';
const SAMPLE_ID_PREFIX = 'sample:';

function sampleIdTag(sampleId: string): string {
  return `${SAMPLE_ID_PREFIX}${sampleId}`;
}

function sampleIdFromTags(tags: string[]): string {
  return tags.find((tag) => tag.startsWith(SAMPLE_ID_PREFIX))?.slice(SAMPLE_ID_PREFIX.length) || '';
}

async function generatedSamples(user: AuthenticatedUser): Promise<Map<string, string>> {
  const result = await db.execute({
    sql: `SELECT id, tags_json FROM scry_memory_items
      WHERE org_id = ? AND user_id = ? AND scope = 'user' AND status <> 'forgotten' AND tags_json LIKE ?
      ORDER BY updated_at DESC`,
    args: [user.orgId, user.id, `%"${SAMPLE_TAG}"%`],
  });
  const generated = new Map<string, string>();
  for (const row of result.rows) {
    let tags: string[] = [];
    try { tags = JSON.parse(String(row.tags_json || '[]')); } catch { tags = []; }
    const sampleId = sampleIdFromTags(tags);
    if (sampleId && !generated.has(sampleId)) generated.set(sampleId, String(row.id));
  }
  return generated;
}

function catalogItem(sample: MemorySampleDefinition, generatedMemoryId = ''): MemorySampleCatalogItem {
  const { content: _content, ...item } = sample;
  return { ...item, generatedMemoryId };
}

export async function listMemorySamples(user: AuthenticatedUser): Promise<MemorySampleCatalogItem[]> {
  const generated = await generatedSamples(user);
  return memorySampleCatalog.map((sample) => catalogItem(sample, generated.get(sample.id)));
}

export async function generateMemorySamples(input: {
  user: AuthenticatedUser;
  sampleIds: string[];
}): Promise<{ memories: MemoryItem[]; createdCount: number; existingCount: number }> {
  const requested = [...new Set(input.sampleIds)];
  const definitions = requested.map((sampleId) => memorySampleCatalog.find((sample) => sample.id === sampleId));
  if (definitions.some((sample) => !sample)) throw new Error('包含未知的示例记忆');
  const generated = await generatedSamples(input.user);
  const memories: MemoryItem[] = [];
  let createdCount = 0;
  let existingCount = 0;

  for (const definition of definitions as MemorySampleDefinition[]) {
    const existingId = generated.get(definition.id);
    if (existingId) {
      const existing = await getMemory(existingId, input.user);
      if (existing) {
        memories.push(existing);
        existingCount += 1;
        continue;
      }
    }
    const memory = await createMemory({
      user: input.user,
      type: definition.type,
      scope: 'user',
      title: definition.title,
      summary: definition.summary,
      serviceName: definition.serviceName,
      confidence: definition.confidence,
      importance: definition.importance,
      tags: [
        SAMPLE_TAG,
        'paper-derived',
        sampleIdTag(definition.id),
        `category:${definition.category}`,
      ],
      note: '示例记忆来源于论文语料，用作可检索的历史经验；它不能替代当前运行证据。',
      content: {
        sample: true,
        catalog: {
          id: definition.id,
          category: definition.category,
          categoryLabel: definition.categoryLabel,
          generatedFor: input.user.id,
        },
        sourceDocument: definition.sourceDocument,
        ...definition.content,
      },
      sources: [{
        sourceType: 'document',
        sourceId: `paper-workspace:${definition.sourceDocument.path}`,
        relation: 'derived_from',
        weight: definition.confidence,
      }],
    });
    generated.set(definition.id, memory.id);
    memories.push(memory);
    createdCount += 1;
  }

  return { memories, createdCount, existingCount };
}

export async function deleteSampleMemory(
  memoryId: string,
  user: AuthenticatedUser,
): Promise<{ memoryId: string; sampleId: string } | null> {
  const memory = await getMemory(memoryId, user);
  if (!memory) return null;
  if (!memory.tags.includes(SAMPLE_TAG)) throw new Error('只有示例记忆可以使用彻底删除');
  const sampleId = sampleIdFromTags(memory.tags);
  await db.batch([
    { sql: 'DELETE FROM scry_memory_chunks WHERE memory_id = ?', args: [memoryId] },
    { sql: 'DELETE FROM scry_memory_sources WHERE memory_id = ?', args: [memoryId] },
    { sql: 'DELETE FROM scry_memory_relations WHERE from_memory_id = ? OR to_memory_id = ?', args: [memoryId, memoryId] },
    { sql: 'DELETE FROM scry_memory_actions WHERE memory_id = ?', args: [memoryId] },
    { sql: 'DELETE FROM scry_memory_items WHERE id = ? AND org_id = ? AND user_id = ?', args: [memoryId, user.orgId, user.id] },
  ]);
  await addSecurityAuditEvent({
    traceId: memoryId,
    orgId: user.orgId,
    userId: user.id,
    eventType: 'memory.sample_deleted',
    source: 'memory',
    target: memoryId,
    decision: 'allow',
    details: { sampleId, title: memory.title },
  });
  return { memoryId, sampleId };
}
