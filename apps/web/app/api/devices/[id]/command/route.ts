import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dispatchCommand } from '@/lib/commands'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const action = body?.action

  if (!['install', 'uninstall', 'list'].includes(action)) {
    return NextResponse.json({ error: 'action 必须是 install/uninstall/list' }, { status: 400 })
  }

  const result = await dispatchCommand(session.user.id, id, {
    action,
    spec: body?.spec ? String(body.spec) : undefined,
  })

  return result.ok
    ? NextResponse.json({ ok: true, commandId: result.commandId })
    : NextResponse.json({ error: result.error }, { status: 400 })
}