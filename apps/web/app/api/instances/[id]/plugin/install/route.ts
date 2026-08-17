import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { plugins } from '@/lib/schema'
import { auth } from '@/lib/auth'
import { installPluginInInstance } from '@/lib/instance-manager'

// POST /api/instances/[id]/plugin/install —— 在托管实例内安装本站商店插件
// 校验:登录 + 实例归属(installPluginInInstance 内) + spec 必须是 approved/manual 白名单
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const spec = String(body?.spec ?? '').trim()
  if (!spec) return NextResponse.json({ error: '缺少插件 spec' }, { status: 400 })

  // 白名单:spec 必须精确命中 approved/manual 插件
  const row = await db.select().from(plugins).where(eq(plugins.spec, spec)).get()
  if (!row || (row.status !== 'approved' && row.status !== 'manual')) {
    return NextResponse.json({ error: '该插件不在商店白名单中' }, { status: 403 })
  }

  // 构造本站 tarball URL(白名单插件的 slug 是已知的,无注入风险)
  const tarballUrl = `https://dsh.cbnac.com/api/plugins/${encodeURIComponent(row.slug)}/tarball`

  try {
    const output = await installPluginInInstance(session.user.id, id, tarballUrl)
    return NextResponse.json({ ok: true, output: output.slice(0, 500) })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}
