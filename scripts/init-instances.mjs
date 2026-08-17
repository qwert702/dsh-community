// 服务器:初始化托管实例池(建表 + 种 6 个槽,幂等)
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createClient } = require('@libsql/client')
const c = createClient({ url: 'file:/www/wwwroot/cbnac.com/dsh-site/data/dsh.db' })

const DDL = String.raw`
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
for (const s of DDL.split(';').map((x) => x.trim()).filter(Boolean)) await c.execute(s)

const slots = [
  ['inst-u1', 'u1', 'u1.dsh.cbnac.com', 3101, 'dsh-u1'],
  ['inst-u2', 'u2', 'u2.dsh.cbnac.com', 3102, 'dsh-u2'],
  ['inst-u3', 'u3', 'u3.dsh.cbnac.com', 3103, 'dsh-u3'],
  ['inst-u4', 'u4', 'u4.dsh.cbnac.com', 3104, 'dsh-u4'],
  ['inst-u5', 'u5', 'u5.dsh.cbnac.com', 3105, 'dsh-u5'],
  ['inst-u6', 'u6', 'u6.dsh.cbnac.com', 3106, 'dsh-u6'],
]
for (const [id, slot, sub, port, cname] of slots) {
  await c.execute({
    sql: 'INSERT OR IGNORE INTO instances (id, slot, subdomain, host_port, container_name, status) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, slot, sub, port, cname, 'available'],
  })
}
const r = await c.execute('SELECT slot, status FROM instances ORDER BY host_port')
console.log('INSTANCES:', JSON.stringify(r.rows))
process.exit(0)