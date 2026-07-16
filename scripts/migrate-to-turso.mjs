/**
 * migrate-to-turso.mjs
 * 
 * Reads all data from the local SQLite database and upserts it into Turso (LibSQL).
 * Run this ONCE after setting up your Turso database:
 * 
 *   node scripts/migrate-to-turso.mjs
 * 
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to be set in .env
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

if (!fs.existsSync(localDbPath)) {
  console.error('❌ Local db/custom.db not found');
  process.exit(1);
}

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL) {
  console.error('❌ TURSO_DATABASE_URL is not set in .env');
  process.exit(1);
}

console.log('🔗 Connecting to Turso:', TURSO_URL);
const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

console.log('📂 Opening local SQLite:', localDbPath);
const local = new Database(localDbPath, { readonly: true });

async function migrateTable(tableName, rows) {
  if (rows.length === 0) {
    console.log(`   ⏭  ${tableName}: 0 rows, skipping`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const colNames = columns.join(', ');
  const sql = `INSERT OR REPLACE INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;

  let count = 0;
  for (const row of rows) {
    const values = columns.map(col => {
      const v = row[col];
      // Convert booleans (SQLite stores as 0/1)
      if (typeof v === 'number' && (col.startsWith('is') || col.startsWith('auto'))) return v;
      return v;
    });
    try {
      await turso.execute({ sql, args: values });
      count++;
    } catch (err) {
      console.warn(`   ⚠️  Row skipped in ${tableName}:`, err.message, JSON.stringify(row).slice(0, 80));
    }
  }
  console.log(`   ✅ ${tableName}: ${count}/${rows.length} rows migrated`);
}

async function main() {
  const tables = [
    'Contact',
    'EmailTemplate',
    'ResponseRule',
    'SentEmail',
    'ReceivedEmail',
    'ActivityLog',
    'EmailConfig',
  ];

  console.log('\n📊 Starting migration...\n');

  for (const table of tables) {
    try {
      const rows = local.prepare(`SELECT * FROM "${table}"`).all();
      process.stdout.write(`📋 ${table}: ${rows.length} rows → `);
      await migrateTable(table, rows);
    } catch (err) {
      if (err.message.includes('no such table')) {
        console.log(`   ⏭  ${table}: table not found in local db, skipping`);
      } else {
        console.error(`   ❌ ${table}: failed —`, err.message);
      }
    }
  }

  console.log('\n🎉 Migration complete!\n');

  // Verify
  try {
    const result = await turso.execute('SELECT COUNT(*) as count FROM "Contact"');
    console.log('✅ Verification — Contacts in Turso:', result.rows[0].count);
  } catch (err) {
    console.warn('Could not verify:', err.message);
  }

  local.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
