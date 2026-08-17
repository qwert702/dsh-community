import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { plugins } from '@/lib/schema'
import { auth } from '@/lib/auth'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const action = body?.action ?? ''

  const target = await db.select().from(plugins).where(eq(plugins.id, id)).get()
  if (!target) return NextResponse.json({ error: '插件不存在' }, { status: 404 })

  let newStatus: 'approved' | 'rejected' | 'removed'
  if (action === 'approve') newStatus = 'approved'
  else if (action === 'reject') newStatus = 'rejected'
  else if (action === 'remove') newStatus = 'removed'
  else return NextResponse.json({ error: 'action 必须是 approve/reject/remove' }, { status: 400 })

  await db
    .update(plugins)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(plugins.id, id))

  return NextResponse.json({ ok: true, status: newStatus })
}