import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { instances, tickets, users } from '@/lib/schema'
import { auth } from '@/lib/auth'

// GET /api/admin/tickets —— 管理员后台:全部工单(含实例/提交人信息)
export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const rows = await db.select().from(tickets).orderBy(desc(tickets.createdAt)).all()
  const out = await Promise.all(
    rows.map(async (t) => {
      const inst = await db.select().from(instances).where(eq(instances.id, t.instanceId)).get()
      const submitter = await db.select().from(users).where(eq(users.id, t.userId)).get()
      const resolver = t.resolvedBy
        ? await db.select().from(users).where(eq(users.id, t.resolvedBy!)).get()
        : undefined
      return {
        ...t,
        instance: inst ? { slot: inst.slot, subdomain: inst.subdomain, hostPort: inst.hostPort } : null,
        submitter: submitter?.username ?? null,
        resolver: resolver?.username ?? null,
      }
    }),
  )
  return NextResponse.json({ tickets: out })
}
