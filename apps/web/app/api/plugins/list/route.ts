import { NextResponse } from 'next/server'
import { and, desc, eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { plugins } from '@/lib/schema'

// GET /api/plugins/list —— 商店上架插件列表(approved/manual),供实例页面插件市场面板用
// 公开只读;不含内部字段
export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await db
    .select()
    .from(plugins)
    .where(or(eq(plugins.status, 'approved'), eq(plugins.status, 'manual')))
    .orderBy(desc(plugins.heat))
    .all()

  const out = rows.map((p) => ({
    slug: p.slug,
    name: p.name,
    desc: p.desc,
    category: p.category,
    spec: p.spec,
    status: p.status,
    stars: p.stars ?? 0,
  }))
  return NextResponse.json({ plugins: out })
}

// 兼容:旧查询可能带 ?installed=1 之类参数,忽略即可
export const dynamicParams = true
