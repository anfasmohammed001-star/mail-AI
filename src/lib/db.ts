import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./db/custom.db';

if (process.env.VERCEL && databaseUrl.startsWith('file:')) {
  // Warn strongly: file-based sqlite on Vercel will not persist across deployments
  // and should not be used as the production database. Set a persistent DB URL.
  console.warn(
    '⚠️ Running on Vercel with a file-based sqlite DATABASE_URL. This will NOT persist across deployments. ' +
      'Set a persistent DATABASE_URL (Postgres/Supabase) in Vercel env for production.'
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    // If DATABASE_URL is set to a file-based sqlite in development that's fine.
    // In production prefer a persistent provider (postgres, supabase, etc.).
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: databaseUrl,
          },
        }
      : undefined,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
