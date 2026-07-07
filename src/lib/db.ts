import { PrismaClient } from '@prisma/client';

// Prefer explicit DATABASE_URL. Default to local sqlite only for local development.
const databaseUrl = process.env.DATABASE_URL ?? 'file:./db/custom.db';

// On Vercel (or any ephemeral host) we must not use a checked-in file-based sqlite database.
// Fail fast so deployments don't silently run with an ephemeral DB that will be restored from repo.
if (process.env.VERCEL && databaseUrl.startsWith('file:')) {
  console.error(
    '\n\n⚠️ FATAL: App is running on Vercel with a file-based sqlite DATABASE_URL.\n' +
    'This environment is ephemeral and file-based sqlite will NOT persist across deployments.\n' +
    'Set a persistent DATABASE_URL (Postgres/Supabase/PlanetScale) in your Vercel Environment Variables.\n' +
    'Example (Postgres): postgres://username:password@host:5432/dbname\n\n'
  );

  // Throwing here prevents the app from starting with an unsafe configuration.
  throw new Error('Detected file-based sqlite DATABASE_URL on Vercel. Set a persistent DATABASE_URL before deploying.');
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
