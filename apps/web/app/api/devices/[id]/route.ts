import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { devices, commands } from '@/lib/schema'
import { auth } from '@/lib/auth'

// GET /api/devices/:id —— 设备详情(轮询状态/进度用)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const { id } = await params
  const device = await db.select().from(devices).where(eq(devices.id, id)).get()
  if (!device || device.userId !== session.user.id) {
    return NextResponse.json({ error: '设备不存在' }, { status: 404 })
  }

  const cmds = await db
    .select()
    .from(commands)
    .where(eq(commands.deviceId, id))
    .orderBy(commands.createdAt)
    .all()

  return NextResponse.json({ device, commands: cmds })
}