import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

import initSqlJs, { type Database, type SqlValue } from 'sql.js';

export type DatabaseValue = string | number | bigint | boolean | Uint8Array | null;
export interface DatabaseStatement {
  sql: string;
  args?: DatabaseValue[];
}
export interface DatabaseResult {
  rows: Array<Record<string, unknown>>;
  rowsAffected: number;
}
export interface DatabaseClient {
  execute(statement: string | DatabaseStatement): Promise<DatabaseResult>;
  batch(statements: Array<string | DatabaseStatement>, mode?: 'read' | 'write'): Promise<DatabaseResult[]>;
  close(): Promise<void>;
}

function databasePath(url: string): string {
  if (!url.startsWith('file:')) throw new Error('WASM SQLite 仅支持 file: 数据库地址');
  return decodeURIComponent(new URL(url).pathname);
}

function bindValues(values: DatabaseValue[] = []): SqlValue[] {
  return values.map((value) => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'bigint') return Number(value);
    return value;
  });
}

function isWrite(sql: string): boolean {
  return /^(?:\s|--[^\n]*\n)*(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|PRAGMA|VACUUM|BEGIN|COMMIT|ROLLBACK)/i.test(sql);
}

class WasmSQLiteClient implements DatabaseClient {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly database: Database, private readonly path: string) {}

  private async locked<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release: () => void = () => undefined;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private run(statement: string | DatabaseStatement): DatabaseResult {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    const args = typeof statement === 'string' ? [] : bindValues(statement.args);
    const prepared = this.database.prepare(sql);
    try {
      if (args.length) prepared.bind(args);
      const rows: Array<Record<string, unknown>> = [];
      while (prepared.step()) rows.push({ ...prepared.getAsObject() });
      return { rows, rowsAffected: this.database.getRowsModified() };
    } finally {
      prepared.free();
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, this.database.export());
    await rename(temporary, this.path);
  }

  async execute(statement: string | DatabaseStatement): Promise<DatabaseResult> {
    return this.locked(async () => {
      const result = this.run(statement);
      const sql = typeof statement === 'string' ? statement : statement.sql;
      if (isWrite(sql)) await this.persist();
      return result;
    });
  }

  async batch(statements: Array<string | DatabaseStatement>, mode: 'read' | 'write' = 'write'): Promise<DatabaseResult[]> {
    return this.locked(async () => {
      const transaction = mode === 'write';
      let transactionOpen = false;
      if (transaction) {
        this.database.run('BEGIN IMMEDIATE');
        transactionOpen = true;
      }
      try {
        const results = statements.map((statement) => this.run(statement));
        if (transactionOpen) {
          this.database.run('COMMIT');
          transactionOpen = false;
        }
        if (transaction || statements.some((statement) => isWrite(typeof statement === 'string' ? statement : statement.sql))) {
          await this.persist();
        }
        return results;
      } catch (error) {
        if (transactionOpen) {
          try {
            this.database.run('ROLLBACK');
          } catch {
            // Preserve the original SQL or persistence error when SQLite already ended the transaction.
          }
        }
        throw error;
      }
    });
  }

  async close(): Promise<void> {
    await this.locked(async () => {
      await this.persist();
      this.database.close();
    });
  }
}

export async function createWasmSQLiteClient(url: string): Promise<DatabaseClient> {
  const path = databasePath(url);
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  let contents: Buffer | undefined;
  try {
    contents = await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const database = new SQL.Database(contents);
  database.run('PRAGMA foreign_keys = ON');
  return new WasmSQLiteClient(database, path);
}
