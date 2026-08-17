import { notFound } from 'next/navigation'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { plugins, comments, users } from '@/lib/schema'
import CopyButton from '@/components/CopyButton'
import CommentSection, { type CommentItem } from '@/components/CommentSection'
import { categoryName, categoryColor, fmtStars } from '@/components/PluginCard'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const row = await db.select().from(plugins).where(eq(plugins.slug, slug)).get()
  if (!row) return { title: '未找到插件' }
  return {
    title: row.name,
    description: row.desc,
  }
}

export default async function PluginDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const row = await db.select().from(plugins).where(eq(plugins.slug, slug)).get()
  if (!row) notFound()

  const installable = row.status === 'approved' || row.status === 'manual'

  const commentRows = await db
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      userName: users.username,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.pluginId, row.id))
    .orderBy(asc(comments.createdAt))
    .all()

  const commentsForClient: CommentItem[] = commentRows.map((c) => ({
    id: c.id,
    userName: c.userName ?? '??',
    body: c.body,
    createdAt: c.createdAt
      ? new Date(c.createdAt).toLocaleDateString('zh-CN')
      : '',
    parentId: c.parentId,
  }))

  const githubData = (row.githubData as any) ?? {}

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-6 rounded-2xl border border-ink-800 bg-ink-900 p-6 md:flex-row md:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-4xl font-bold text-brand-400">
          {row.name[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{row.name}</h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs ${categoryColor(row.category)}`}
            >
              {categoryName(row.category)}
            </span>
            {installable ? (
              <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs text-brand-400">
                已验证 ✓
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-400">
                待管理员审核
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            作者 <span className="text-slate-300">{row.author}</span> · ★{' '}
            {fmtStars(row.stars)}
            {row.version && <span> · v{row.version}</span>}
          </p>
          <p className="mt-3 text-slate-300">{row.longDesc || row.desc || '暂无描述'}</p>
        </div>
      </div>

      {installable && (
        <div className="mt-6 rounded-2xl border border-brand-500/25 bg-brand-500/5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">🧩 一键安装到本机 dsh</h2>
            <span className="text-xs text-slate-500">
              在你的 dsh 终端里执行下面的命令
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink-950/80 px-3 py-2.5">
            <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-brand-400">
              {row.installCommand}
            </code>
            <CopyButton text={row.installCommand} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            <span className="text-amber-400">⚠️ 安全提示:</span> 安装插件等于运行其构建脚本
            (prepare),仅从可信来源安装。安装到 profile: web。
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <h3 className="text-sm font-semibold text-white">安装源 (spec)</h3>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-ink-950/80 px-3 py-2 font-mono text-xs text-slate-300">
            {row.spec}
          </code>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <h3 className="text-sm font-semibold text-white">链接</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {row.repoUrl && (
              <li>
                <a
                  href={row.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-400 hover:underline"
                >
                  GitHub 仓库 ↗
                </a>
              </li>
            )}
            {row.homepage && (
              <li>
                <a
                  href={row.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-400 hover:underline"
                >
                  官网 {row.homepage} ↗
                </a>
              </li>
            )}
            {githubData.ref && (
              <li className="text-xs text-slate-500">锁定 ref: {githubData.ref}</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <CommentSection pluginSlug={slug} comments={commentsForClient} />
      </div>
    </div>
  )
}