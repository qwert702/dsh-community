import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { devices, commands } from '@/lib/schema'
import { auth } from '@/lib/auth'
import { issuePairingCode } from '@/lib/pair'

// GET /api/devices —— 我的设备列表(含最新状态)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const rows = await db
    .select()
    .from(devices)
    .where(eq(devices.userId, session.user.id))
    .orderBy(desc(devices.updatedAt))
    .all()

  // 附带最近一条指令
  const withCmds = await Promise.all(
    rows.map(async (d) => {
      const last = await db
        .select()
        .from(commands)
        .where(eq(commands.deviceId, d.id))
        .orderBy(desc(commands.createdAt))
        .limit(1)
        .get()
      return {
        ...d,
        lastCommand: last ?? null,
      }
    }),
  )

  return NextResponse.json({ devices: withCmds })
}

// POST /api/devices —— 生成配对码
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const { code, expiresAt } = await issuePairingCode(session.user.id)
  return NextResponse.json({
    pairingCode: code,
    expiresAt: new Date(expiresAt).toISOString(),
    // 8 位,15 分钟,一次性
  })
}