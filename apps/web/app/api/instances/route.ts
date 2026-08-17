import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { instances } from '@/lib/schema'
import { auth } from '@/lib/auth'
import { claimInstance, probeReady, sweepExpiredInstances, dockerStatus } from '@/lib/instance-manager'

// GET /api/instances —— 池列表(空闲 + 我领的 + 容器实际状态 + 服务就绪)
// 注:开头会顺带做过期回收,外部 cron 定时 curl 本接口即可兜底回收
// 安全:不暴露内部字段(hostPort/containerName/host/userId/时间戳)
export async function GET() {
  await sweepExpiredInstances().catch(() => {})
  const session = await auth()
  const rows = await db.select().from(instances).orderBy(desc(instances.hostPort)).all()
  const out = await Promise.all(
    rows.map(async (r) => {
      const containerStatus = await dockerStatus(r)
      // 已领取的实例顺带探测 dsh web 是否真正就绪(前端进度条依据)
      const httpReady = r.status === 'claimed' ? await probeReady(r) : false
      const mine = session?.user?.id ? r.userId === session.user.id : false
      // 公开字段:到期时间对本人可见(倒计时用);隐藏 hostPort/containerName/host
      // 对外地址优先用随机域名(randSubdomain),未分配时回退内部 slot 域名
      return {
        id: r.id,
        slot: r.slot,
        subdomain: r.randSubdomain ?? r.subdomain,
        status: r.status,
        claimedAt: r.claimedAt,
        expiresAt: r.expiresAt,
        containerStatus,
        httpReady,
        mine,
      }
    }),
  )
  return NextResponse.json({ instances: out })
}

// POST /api/instances —— 领取一台
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  try {
    const instance = await claimInstance(session.user.id)
    // 领取响应同样裁剪内部字段
    return NextResponse.json({
      ok: true,
      instance: {
        id: instance.id,
        slot: instance.slot,
        subdomain: instance.subdomain,
        status: instance.status,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}
