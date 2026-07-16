/**
 * apply-schema-turso.mjs
 * Applies the Prisma-generated DDL directly to Turso via LibSQL client.
 */
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL) { console.error('❌ TURSO_DATABASE_URL not set'); process.exit(1); }

const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
console.log('🔗 Connected to Turso:', TURSO_URL, '\n');

const statements = [
  `CREATE TABLE IF NOT EXISTS "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "customFields" TEXT,
    "tags" TEXT,
    "groupName" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ResponseRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conditions" TEXT NOT NULL,
    "replyTemplate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "SentEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "templateId" TEXT,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" DATETIME,
    "attachments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("contactId") REFERENCES "Contact" ("id"),
    FOREIGN KEY ("templateId") REFERENCES "EmailTemplate" ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "ReceivedEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "autoReplied" BOOLEAN NOT NULL DEFAULT false,
    "replyRuleId" TEXT,
    "category" TEXT,
    "summary" TEXT,
    "extractedInfo" TEXT,
    "aiReplyDraft" TEXT,
    "aiReplyStatus" TEXT NOT NULL DEFAULT 'none',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("contactId") REFERENCES "Contact" ("id"),
    FOREIGN KEY ("replyRuleId") REFERENCES "ResponseRule" ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "EmailConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Contact_email_key" ON "Contact"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "EmailConfig_key_key" ON "EmailConfig"("key")`,
];

async function main() {
  for (const sql of statements) {
    const name = sql.match(/"(\w+)"/)?.[1] || sql.slice(0,40);
    try {
      await turso.execute(sql);
      console.log(`  ✅ Created: ${name}`);
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log(`  ⏭  Already exists: ${name}`);
      } else {
        console.error(`  ❌ Failed (${name}):`, err.message);
      }
    }
  }
  console.log('\n✅ Schema applied to Turso!\n');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
