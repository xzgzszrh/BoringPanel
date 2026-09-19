import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import initSqlJs from 'sql.js';
function databasePath(url) {
    if (!url.startsWith('file:'))
        throw new Error('WASM SQLite 仅支持 file: 数据库地址');
    return decodeURIComponent(new URL(url).pathname);
}
function bindValues(values = []) {
    return values.map((value) => {
        if (typeof value === 'boolean')
            return value ? 1 : 0;
        if (typeof value === 'bigint')
            return Number(value);
        return value;
    });
}
function isWrite(sql) {
    return /^(?:\s|--[^\n]*\n)*(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|PRAGMA|VACUUM|BEGIN|COMMIT|ROLLBACK)/i.test(sql);
}
class WasmSQLiteClient {
    database;
    path;
    queue = Promise.resolve();
    constructor(database, path) {
        this.database = database;
        this.path = path;
    }
    async locked(operation) {
        const previous = this.queue;
        let release = () => undefined;
        this.queue = new Promise((resolve) => { release = resolve; });
        await previous;
        try {
            return await operation();
        }
        finally {
            release();
        }
    }
    run(statement) {
        const sql = typeof statement === 'string' ? statement : statement.sql;
        const args = typeof statement === 'string' ? [] : bindValues(statement.args);
        const prepared = this.database.prepare(sql);
        try {
            if (args.length)
                prepared.bind(args);
            const rows = [];
            while (prepared.step())
                rows.push({ ...prepared.getAsObject() });
            return { rows, rowsAffected: this.database.getRowsModified() };
        }
        finally {
            prepared.free();
        }
    }
    async persist() {
        await mkdir(dirname(this.path), { recursive: true });
        const temporary = `${this.path}.${process.pid}.tmp`;
        await writeFile(temporary, this.database.export());
        await rename(temporary, this.path);
    }
    async execute(statement) {
        return this.locked(async () => {
            const result = this.run(statement);
            const sql = typeof statement === 'string' ? statement : statement.sql;
            if (isWrite(sql))
                await this.persist();
            return result;
        });
    }
    async batch(statements, mode = 'write') {
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
            }
            catch (error) {
                if (transactionOpen) {
                    try {
                        this.database.run('ROLLBACK');
                    }
                    catch {
                        // Preserve the original SQL or persistence error when SQLite already ended the transaction.
                    }
                }
                throw error;
            }
        });
    }
    async close() {
        await this.locked(async () => {
            await this.persist();
            this.database.close();
        });
    }
}
export async function createWasmSQLiteClient(url) {
    const path = databasePath(url);
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    let contents;
    try {
        contents = await readFile(path);
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    const database = new SQL.Database(contents);
    database.run('PRAGMA foreign_keys = ON');
    return new WasmSQLiteClient(database, path);
}
//# sourceMappingURL=wasm-sqlite.js.map