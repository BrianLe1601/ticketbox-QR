// Full schema verification on a uniquely named disposable database only.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

if (process.env.NODE_ENV === 'production') throw new Error('Disposable verification is forbidden in production');
const database = `ticketboxqr_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
if (!/^ticketboxqr_test_\d+_[a-f0-9]{8}$/.test(database)) throw new Error('Unsafe test database');
const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const testEnv = { ...process.env, NODE_ENV: 'test', DB_NAME: database,
    QR_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString('base64'), QR_ENCRYPTION_KEY_ID: 'disposable-test-only' };
let created = false;
async function run(script, args = []) {
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, ...args], { env: testEnv, stdio: 'inherit' });
        child.on('error', reject);
        child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)));
    });
}
try {
    let sql = await readFile(new URL('../../database/migrations/001_initial_schema.sql', import.meta.url), 'utf8');
    // Never execute the canonical DROP against the user's database.
    sql = sql.replace(/^DROP DATABASE IF EXISTS ticketboxqr;\s*/m, '').replace(/\bticketboxqr\b/g, database);
    await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    sql = sql.replace(new RegExp(`CREATE DATABASE ${database}\\s+CHARACTER SET utf8mb4\\s+COLLATE utf8mb4_unicode_ci;`), '');
    let delimiter = ';', statement = '';
    for (const line of sql.split(/\r?\n/)) {
        const change = line.trim().match(/^DELIMITER\s+(\S+)$/);
        if (change) { delimiter = change[1]; continue; }
        if (!line.trim() || line.trim().startsWith('--')) continue;
        statement += line + '\n';
        if (statement.trimEnd().endsWith(delimiter)) {
            await connection.query(statement.trimEnd().slice(0, -delimiter.length));
            statement = '';
        }
    }
    if (statement.trim()) throw new Error('Unparsed schema statement');
    console.log(`Disposable schema ready: ${database}`);
    for (const script of ['seed.ts', 'seed-workflows.ts', 'verify-workflows.ts']) await run('node_modules/tsx/dist/cli.mjs', [`src/database/${script}`]);
    await run('node_modules/vitest/vitest.mjs', ['run']);
} finally {
    if (created) { await connection.query(`DROP DATABASE \`${database}\``); console.log(`Removed disposable database: ${database}`); }
    await connection.end();
}
