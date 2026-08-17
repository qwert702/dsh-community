import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import fs from 'node:fs'
import path from 'node:path'
import * as schema from './schema'

function resolveDbPath(): string {
  const fromEnv = process.env.DATABASE_PATH
  if (fromEnv) return fromEnv
  // 默认放 apps/web/data/dsh.db
  const dir = path.join(process.cwd(), 'data')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'dsh.db')
}

const dbPath = resolveDbPath()

// 确保 data 目录存在
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

// 生产环境用单例(Next.js standalone / route handler 可能多次加载)
const globalForDb = globalThis as unknown as {
  __dshClient?: Client
  __dshDb?: LibSQLDatabase<typeof schema>
}

function createClientAndDb() {
  const client = createClient({ url: `file:${dbPath}` })
  client.execute('PRAGMA journal_mode = WAL')
  client.execute('PRAGMA busy_timeout = 5000')
  client.execute('PRAGMA foreign_keys = ON')
  return { client, db: drizzle(client, { schema }) }
}

const inst = globalForDb.__dshDb
  ? { client: globalForDb.__dshClient!, db: globalForDb.__dshDb }
  : (() => {
      const { client, db } = createClientAndDb()
      globalForDb.__dshClient = client
      globalForDb.__dshDb = db
      return { client, db }
    })()

export const client = inst.client
export const db = inst.db
export { dbPath }
