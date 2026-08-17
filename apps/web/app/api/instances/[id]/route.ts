import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  releaseInstance,
  renewInstance,
  restartInstance,
  upgradeInstance,
} from '@/lib/instance-manager'

// POST /api/instances/:id —— action: release | renew | restart | upgrade
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const action = body?.action

  try {
    if (action === 'release') {
      await releaseInstance(session.user.id, id)
      return NextResponse.json({ ok: true })
    }
    if (action === 'renew') {
      const instance = await renewInstance(session.user.id, id)
      return NextResponse.json({ ok: true, instance })
    }
    if (action === 'restart') {
      await restartInstance(session.user.id, id)
      return NextResponse.json({ ok: true })
    }
    if (action === 'upgrade') {
      await upgradeInstance(session.user.id, id)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'action 必须是 release/renew/restart/upgrade' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}