import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { instances } from '@/lib/schema'
import { auth } from '@/lib/auth'
import { claimInstance, probeReady, sweepExpiredInstances } from '@/lib/instance-manager'

// GET /api/instances —— 池列表(空闲 + 我领的 + 容器实际状态 + 服务就绪)
// 注:开头会顺带做过期回收,外部 cron 定时 curl 本接口即可兜底回收
export async function GET() {
  await sweepExpiredInstances().catch(() => {})
  const session = await auth()
  const rows = await db.select().from(instances).orderBy(desc(instances.hostPort)).all()
  const out = await Promise.all(
    rows.map(async (r) => {
      // 容器状态在 server 上可查;本地/开发时降级为 'unknown'
      let containerStatus = 'unknown'
      try {
        const { execFile } = await import('node:child_process')
        const { promisify } = await import('node:util')
        const run = promisify(execFile)
        const { stdout } = await run('docker', ['inspect', '--format', '{{.State.Status}}', r.containerName], {
          timeout: 8000,
        })
        containerStatus = stdout.trim()
      } catch {
        containerStatus = 'missing'
      }
      // 已领取的实例顺带探测 dsh web 是否真正就绪(前端进度条依据)
      const httpReady = r.status === 'claimed' ? await probeReady(r) : false
      return {
        ...r,
        containerStatus,
        httpReady,
        mine: session?.user?.id ? r.userId === session.user.id : false,
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
    return NextResponse.json({ ok: true, instance })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 })
  }
}