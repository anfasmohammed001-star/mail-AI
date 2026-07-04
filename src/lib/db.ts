import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

if (process.env.VERCEL) {
  const tmpDbPath = '/tmp/custom.db';
  if (!fs.existsSync(tmpDbPath)) {
    try {
      const sourceDbRoot = path.join(process.cwd(), 'db', 'custom.db');
      const sourceDbPrisma = path.join(process.cwd(), 'prisma', 'db', 'custom.db');
      
      if (fs.existsSync(sourceDbRoot)) {
        fs.copyFileSync(sourceDbRoot, tmpDbPath);
      } else if (fs.existsSync(sourceDbPrisma)) {
        fs.copyFileSync(sourceDbPrisma, tmpDbPath);
      }
    } catch (e) {
      console.error('Failed to copy db to /tmp', e);
    }
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasources: process.env.VERCEL ? {
      db: {
        url: 'file:/tmp/custom.db'
      }
    } : undefined
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db