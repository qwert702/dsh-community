import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tickets } from '@/lib/schema'
import { auth } from '@/lib/auth'

// POST /api/admin/tickets/:id —— action: resolve | reopen
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const action = body?.action
  if (action !== 'resolve' && action !== 'reopen') {
    return NextResponse.json({ error: 'action 必须是 resolve/reopen' }, { status: 400 })
  }

  const row = await db.select().from(tickets).where(eq(tickets.id, id)).get()
  if (!row) return NextResponse.json({ error: '工单不存在' }, { status: 404 })

  if (action === 'resolve') {
    await db
      .update(tickets)
      .set({ status: 'resolved', resolvedAt: new Date(), resolvedBy: session.user.id })
      .where(eq(tickets.id, id))
  } else {
    await db
      .update(tickets)
      .set({ status: 'open', resolvedAt: null, resolvedBy: null })
      .where(eq(tickets.id, id))
  }
  return NextResponse.json({ ok: true })
}
