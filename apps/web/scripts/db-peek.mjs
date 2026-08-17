import { createClient } from '@libsql/client'
const c = createClient({ url: 'file:data/dsh.db' })
const r = await c.execute('SELECT expires_at FROM pairing_codes LIMIT 1')
const row = r.rows[0]
console.log('stored values:', JSON.stringify(row))
const v = row.expires_at
console.log('typeof:', typeof v, '| Date-as-ms:', new Date(v).toISOString(), '| Date-as-s:', new Date(v * 1000).toISOString())
process.exit(0)