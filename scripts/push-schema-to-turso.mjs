/**
 * push-schema-to-turso.mjs
 * Reads the local SQLite schema and creates all tables in Turso via LibSQL HTTP API.
 */
import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localDbPath = path.join(__dirname, '..', 'db', 'custom.db');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL) { console.error('❌ TURSO_DATABASE_URL not set'); process.exit(1); }

console.log('🔗 Connecting to Turso:', TURSO_URL);
const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// Get schema DDL from local SQLite
const local = new Database(localDbPath, { readonly: true });
const ddlRows = local.prepare(`
  SELECT sql FROM sqlite_master 
  WHERE type IN ('table','index') 
  AND name NOT LIKE 'sqlite_%'
  AND sql IS NOT NULL
  ORDER BY type DESC, name ASC
`).all();
local.close();

async function main() {
  console.log(`\n📐 Found ${ddlRows.length} DDL statements to apply...\n`);

  for (const row of ddlRows) {
    const stmt = row.sql.trim();
    const name = stmt.match(/(?:TABLE|INDEX)\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?/i)?.[1] || 'unknown';
    try {
      // Add IF NOT EXISTS to table creation
      const safeSql = stmt.replace(/^CREATE TABLE\s+"/i, 'CREATE TABLE IF NOT EXISTS "')
                          .replace(/^CREATE TABLE\s+(\w)/i, 'CREATE TABLE IF NOT EXISTS $1')
                          .replace(/^CREATE INDEX\s+/i, 'CREATE INDEX IF NOT EXISTS ')
                          .replace(/^CREATE UNIQUE INDEX\s+/i, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
      await turso.execute(safeSql);
      console.log(`  ✅ Applied: ${name}`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ⏭  Already exists: ${name}`);
      } else {
        console.warn(`  ⚠️  ${name}: ${err.message}`);
      }
    }
  }

  console.log('\n✅ Schema pushed to Turso successfully!\n');
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
