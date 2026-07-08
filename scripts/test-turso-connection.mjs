// Quick smoke test: connects to Turso via Prisma adapter and counts contacts
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log('🔗 URL:', url);

const libsql = createClient({ url, authToken });
const adapter = new PrismaLibSql(libsql);
const db = new PrismaClient({ adapter });

const count = await db.contact.count();
console.log('✅ Contacts in Turso via Prisma adapter:', count);

const first = await db.contact.findFirst({ select: { name: true, email: true } });
console.log('✅ First contact:', first);

await db.$disconnect();
process.exit(0);
