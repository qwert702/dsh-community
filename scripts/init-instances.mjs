// 服务器:初始化托管实例池(建表 + 种 12 个槽,幂等)
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
  host TEXT NOT NULL DEFAULT 'local',
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
  // 服务器本地(host=local)
  ['inst-u1', 'u1', 'u1.dsh.cbnac.com', 3101, 'dsh-u1', 'local'],
  ['inst-u2', 'u2', 'u2.dsh.cbnac.com', 3102, 'dsh-u2', 'local'],
  ['inst-u3', 'u3', 'u3.dsh.cbnac.com', 3103, 'dsh-u3', 'local'],
  ['inst-u4', 'u4', 'u4.dsh.cbnac.com', 3104, 'dsh-u4', 'local'],
  ['inst-u5', 'u5', 'u5.dsh.cbnac.com', 3105, 'dsh-u5', 'local'],
  ['inst-u6', 'u6', 'u6.dsh.cbnac.com', 3106, 'dsh-u6', 'local'],
  // 内网 NAS(host=nas,tailnet 100.76.91.96)
  ['inst-u7', 'u7', 'u7.dsh.cbnac.com', 3107, 'dsh-u7', 'nas'],
  ['inst-u8', 'u8', 'u8.dsh.cbnac.com', 3108, 'dsh-u8', 'nas'],
  ['inst-u9', 'u9', 'u9.dsh.cbnac.com', 3109, 'dsh-u9', 'nas'],
  ['inst-u10', 'u10', 'u10.dsh.cbnac.com', 3110, 'dsh-u10', 'nas'],
  ['inst-u11', 'u11', 'u11.dsh.cbnac.com', 3111, 'dsh-u11', 'nas'],
  ['inst-u12', 'u12', 'u12.dsh.cbnac.com', 3112, 'dsh-u12', 'nas'],
]
for (const [id, slot, sub, port, cname, host] of slots) {
  await c.execute({
    sql: 'INSERT OR IGNORE INTO instances (id, slot, subdomain, host_port, container_name, host, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, slot, sub, port, cname, host, 'available'],
  })
}
const r = await c.execute('SELECT slot, status, host FROM instances ORDER BY host_port')
console.log('INSTANCES:', JSON.stringify(r.rows))
process.exit(0)