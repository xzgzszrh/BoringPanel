import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createWasmSQLiteClient } from '../src/database/wasm-sqlite.js';

test('WASM SQLite persists data without native bindings', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scry-wasm-'));
  const url = `file:${join(directory, 'test.db')}`;
  try {
    const first = await createWasmSQLiteClient(url);
    await first.batch([
      'CREATE TABLE sample (id TEXT PRIMARY KEY, value TEXT NOT NULL)',
      { sql: 'INSERT INTO sample (id, value) VALUES (?, ?)', args: ['one', 'stored'] },
    ]);
    await first.close();

    const second = await createWasmSQLiteClient(url);
    const result = await second.execute({ sql: 'SELECT value FROM sample WHERE id = ?', args: ['one'] });
    assert.equal(result.rows[0]?.value, 'stored');
    await second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('WASM SQLite preserves the original batch error after a transaction is ended', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scry-wasm-'));
  const url = `file:${join(directory, 'test.db')}`;
  try {
    const client = await createWasmSQLiteClient(url);
    await assert.rejects(
      client.batch(['ROLLBACK', 'SELECT * FROM missing_table']),
      /missing_table|no such table/i,
    );
    await client.execute('CREATE TABLE recovered (id TEXT PRIMARY KEY)');
    await client.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
