import { NextResponse } from 'next/server'
import { syncFromGithub } from '@/lib/registry'
import { auth } from '@/lib/auth'
import { SYNC_KEY } from '@/lib/env'

// 触发 GitHub 同步。
// 认证: admin 会话 或 x-sync-key header(crontab 用)
export async function POST(req: Request) {
  const session = await auth()
  const headerKey = req.headers.get('x-sync-key') ?? ''

  const isAdmin = session?.user?.role === 'admin'
  const isCron = SYNC_KEY !== '' && headerKey === SYNC_KEY
  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: '无权限。需要 admin 登录或正确的 x-sync-key' }, { status: 403 })
  }

  try {
    const result = await syncFromGithub({ limit: 30 })
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e), rateLimit: e?.rateLimit ?? null },
      { status: 500 },
    )
  }
}