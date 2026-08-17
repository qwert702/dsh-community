import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { comments, plugins } from '@/lib/schema'
import { auth } from '@/lib/auth'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const { slug } = await params
  const plugin = await db.select().from(plugins).where(eq(plugins.slug, slug)).get()
  if (!plugin) return NextResponse.json({ error: '插件不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const text = String(body?.body ?? '').trim()
  if (!text || text.length > 2000) {
    return NextResponse.json({ error: '评论内容 1-2000 字符' }, { status: 400 })
  }

  await db.insert(comments).values({
    id: randomUUID(),
    pluginId: plugin.id,
    userId: session.user.id,
    body: text,
    createdAt: new Date(),
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}