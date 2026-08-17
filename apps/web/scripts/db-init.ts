/**
 * 数据库初始化:幂等建表。
 * 用法: pnpm tsx scripts/db-init.ts   (在 apps/web 目录下)
 */
import { client } from '../lib/db'

const DDL = String.raw`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  author TEXT NOT NULL,
  author_id TEXT REFERENCES users(id),
  category TEXT NOT NULL DEFAULT 'tool',
  desc TEXT NOT NULL DEFAULT '',
  long_desc TEXT,
  spec TEXT NOT NULL,
  install_command TEXT NOT NULL,
  repo TEXT,
  repo_url TEXT,
  homepage TEXT,
  source TEXT NOT NULL DEFAULT 'github',
  status TEXT NOT NULL DEFAULT 'pending',
  heat INTEGER NOT NULL DEFAULT 0,
  downloads INTEGER NOT NULL DEFAULT 0,
  stars INTEGER NOT NULL DEFAULT 0,
  github_data TEXT,
  manifest_valid INTEGER NOT NULL DEFAULT 0,
  patch_path TEXT,
  version TEXT,
  last_validated_at INTEGER,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS plugins_status_category_idx ON plugins(status, category);
CREATE INDEX IF NOT EXISTS plugins_slug_idx ON plugins(slug);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  plugin_id TEXT NOT NULL REFERENCES plugins(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  parent_id TEXT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS comments_plugin_idx ON comments(plugin_id);
CREATE INDEX IF NOT EXISTS comments_user_idx ON comments(user_id);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  profile_name TEXT NOT NULL DEFAULT 'web',
  platform TEXT,
  dsh_version TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  token_hash TEXT,
  installed_json TEXT,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS devices_user_idx ON devices(user_id);
CREATE TABLE IF NOT EXISTS pairing_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  device_id TEXT
);
CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  spec TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  detail_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS commands_device_idx ON commands(device_id);
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES instances(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER,
  resolved_by TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
CREATE INDEX IF NOT EXISTS tickets_instance_idx ON tickets(instance_id);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON tickets(user_id);
`

async function main() {
  const statements = DDL.split(';').map((s) => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    await client.execute(stmt)
  }
  console.log('✅ 数据库表已创建/确认 (SQLite via libsql)')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ 初始化失败:', e)
  process.exit(1)
})
