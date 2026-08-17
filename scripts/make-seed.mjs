// 从本地开发库导出 plugins 数据,生成一份干净的服务器种子库(无测试用户/设备)
import { createClient } from '@libsql/client'
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'D:/CBN-HT/Desktop/dsh-community/apps/web/data/dsh.db'
const OUT = 'D:/CBN-HT/Desktop/dsh-community/dist/seed.db'

const src = createClient({ url: `file:${SRC}` })
if (fs.existsSync(OUT)) fs.rmSync(OUT)
const dst = createClient({ url: `file:${OUT}` })

const DDL = String.raw`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, author TEXT NOT NULL,
  author_id TEXT REFERENCES users(id), category TEXT NOT NULL DEFAULT 'tool',
  desc TEXT NOT NULL DEFAULT '', long_desc TEXT, spec TEXT NOT NULL, install_command TEXT NOT NULL,
  repo TEXT, repo_url TEXT, homepage TEXT, source TEXT NOT NULL DEFAULT 'github',
  status TEXT NOT NULL DEFAULT 'pending', heat INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0, stars INTEGER NOT NULL DEFAULT 0,
  github_data TEXT, manifest_valid INTEGER NOT NULL DEFAULT 0, patch_path TEXT,
  version TEXT, last_validated_at INTEGER, last_synced_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS plugins_status_category_idx ON plugins(status, category);
CREATE INDEX IF NOT EXISTS plugins_slug_idx ON plugins(slug);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, plugin_id TEXT NOT NULL REFERENCES plugins(id),
  user_id TEXT NOT NULL REFERENCES users(id), parent_id TEXT, body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS comments_plugin_idx ON comments(plugin_id);
CREATE INDEX IF NOT EXISTS comments_user_idx ON comments(user_id);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
  profile_name TEXT NOT NULL DEFAULT 'web', platform TEXT, dsh_version TEXT,
  status TEXT NOT NULL DEFAULT 'offline', token_hash TEXT, installed_json TEXT,
  last_seen_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS devices_user_idx ON devices(user_id);
CREATE TABLE IF NOT EXISTS pairing_codes (
  code_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL, used_at INTEGER, device_id TEXT
);
CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id),
  user_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, spec TEXT,
  status TEXT NOT NULL DEFAULT 'queued', detail_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS commands_device_idx ON commands(device_id);
`

const stmts = DDL.split(';').map((s) => s.trim()).filter(Boolean)
for (const s of stmts) await dst.execute(s)

// 复制 plugins
const r = await src.execute('SELECT * FROM plugins')
for (const row of r.rows) {
  const cols = Object.keys(row)
  const vals = cols.map((c) => row[c])
  const placeholders = cols.map(() => '?').join(',')
  await dst.execute({
    sql: `INSERT OR IGNORE INTO plugins (${cols.join(',')}) VALUES (${placeholders})`,
    args: vals,
  })
}
const count = await dst.execute('SELECT COUNT(*) AS n FROM plugins')
console.log('SEED_OK plugins=', count.rows[0].n)

// 托管实例池槽(3 台)
const INSTANCES_DDL = String.raw`
CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  slot TEXT NOT NULL UNIQUE,
  subdomain TEXT NOT NULL UNIQUE,
  host_port INTEGER NOT NULL,
  container_name TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'available',
  claimed_at INTEGER,
  expires_at INTEGER,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS instances_user_idx ON instances(user_id);
CREATE INDEX IF NOT EXISTS instances_status_idx ON instances(status);
`
for (const s of INSTANCES_DDL.split(';').map((x) => x.trim()).filter(Boolean)) await dst.execute(s)
const slots = [
  ['inst-u1', 'u1', 'u1.dsh.cbnac.com', 3101, 'dsh-u1'],
  ['inst-u2', 'u2', 'u2.dsh.cbnac.com', 3102, 'dsh-u2'],
  ['inst-u3', 'u3', 'u3.dsh.cbnac.com', 3103, 'dsh-u3'],
]
for (const [id, slot, sub, port, cname] of slots) {
  await dst.execute({
    sql: 'INSERT OR IGNORE INTO instances (id, slot, subdomain, host_port, container_name, status) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, slot, sub, port, cname, 'available'],
  })
}
const ic = await dst.execute('SELECT COUNT(*) AS n FROM instances')
console.log('SEED_OK instances=', ic.rows[0].n)
process.exit(0)