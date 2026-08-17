import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { instances, tickets } from '@/lib/schema'
import { auth } from '@/lib/auth'

// POST /api/instances/:id/ticket —— 联系解决:对某台实例提交工单
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const message = String(body?.message ?? '').trim()
  if (!message) return NextResponse.json({ error: '请填写问题描述' }, { status: 400 })
  if (message.length > 2000) return NextResponse.json({ error: '问题描述过长(最多 2000 字)' }, { status: 400 })

  const inst = await db.select().from(instances).where(eq(instances.id, id)).get()
  if (!inst) return NextResponse.json({ error: '实例不存在' }, { status: 404 })

  const ticketId = `tkt-${crypto.randomUUID()}`
  await db.insert(tickets).values({
    id: ticketId,
    instanceId: inst.id,
    userId: session.user.id,
    message,
    status: 'open',
  })

  return NextResponse.json({ ok: true, id: ticketId })
}
