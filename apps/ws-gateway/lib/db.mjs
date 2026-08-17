import { createClient } from '@libsql/client'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// 与 apps/web 共享同一个 SQLite 文件
function resolveDbPath() {
  const fromEnv = process.env.DATABASE_PATH
  if (fromEnv) return fromEnv
  const dir = path.join(process.cwd(), '..', 'web', 'data')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'dsh.db')
}

const db = createClient({ url: `file:${resolveDbPath()}` })
await db.execute('PRAGMA journal_mode = WAL')
await db.execute('PRAGMA busy_timeout = 5000')
await db.execute('PRAGMA foreign_keys = ON')

export function sha256(input) {
  return createHash('sha256').update(input).digest('hex')
}

export function randomHex(bytes = 32) {
  return randomBytes(bytes).toString('hex')
}

// drizzle 的 sqlite integer timestamp 列以 unix 秒存储;网关读写统一用秒
export function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

export function toDate(secondsOrNull) {
  if (secondsOrNull == null) return null
  return new Date(secondsOrNull * 1000)
}

export async function getScalar(sql, params = []) {
  const r = await db.execute({ sql, args: params })
  const row = r.rows[0]
  return row ? Object.values(row)[0] : null
}

export async function getRow(sql, params = []) {
  const r = await db.execute({ sql, args: params })
  return r.rows[0] ?? null
}

export async function exec(sql, params = []) {
  await db.execute({ sql, args: params })
}

export { db }