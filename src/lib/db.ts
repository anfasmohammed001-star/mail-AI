import { PrismaClient } from '@prisma/client';

// Prefer explicit DATABASE_URL. Default to local sqlite only for local development.
const databaseUrl = process.env.DATABASE_URL ?? 'file:./db/custom.db';

// On Vercel (or any ephemeral host) warn strongly when using file-based sqlite.
// Do not throw during build — this allows deployments to proceed while you
// provision a persistent DATABASE_URL. This is a temporary measure; use a
// persistent Postgres/Supabase DB in production to ensure data persists.
if (process.env.VERCEL && databaseUrl.startsWith('file:')) {
  console.warn(
    '\n\n⚠️ WARNING: App is running on Vercel with a file-based sqlite DATABASE_URL.\n' +
      'This environment is ephemeral and file-based sqlite will NOT persist across deployments.\n' +
      'Set a persistent DATABASE_URL (Postgres/Supabase/PlanetScale) in your Vercel Environment Variables.\n' +
      'Example (Postgres): postgres://username:password@host:5432/dbname\n\n'
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: databaseUrl,
          },
        }
      : undefined,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
