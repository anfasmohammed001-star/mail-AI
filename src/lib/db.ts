import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

if (process.env.VERCEL && process.env.TURSO_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TURSO_DATABASE_URL
}


function createPrismaClient(): PrismaClient {
  if (process.env.VERCEL) {
    const url = process.env.TURSO_DATABASE_URL
    const authToken = process.env.TURSO_AUTH_TOKEN

    if (!url) {
      throw new Error('TURSO_DATABASE_URL environment variable is not set')
    }

    const libsql = createClient({ url, authToken })
    const adapter = new PrismaLibSql(libsql)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PrismaClient({ adapter } as any)
  }

  // Local development: use standard PrismaClient with local SQLite database file
  return new PrismaClient()
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db