// 开发辅助:把 manifestValid 的插件批准为 approved
import fs from 'node:fs'
import { config } from 'dotenv'
if (fs.existsSync('.env.local')) config({ path: '.env.local' })
const { db } = await import('../lib/db')
const { plugins } = await import('../lib/schema')
const { eq } = await import('drizzle-orm')

const rows = await db.select().from(plugins).all()
let approved = 0
for (const p of rows) {
  if (p.manifestValid && p.status === 'pending') {
    await db
      .update(plugins)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(plugins.id, p.id))
    approved++
  }
}
console.log(`approved=${approved} total=${rows.length}`)
process.exit(0)