import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/lib/db'
import { plugins, comments, users } from '@/lib/schema'

export const dynamic = 'force-dynamic'

export default async function CommunityPage() {
  const recentPlugins = await db
    .select()
    .from(plugins)
    .orderBy(desc(plugins.updatedAt))
    .limit(8)
    .all()

  const recentComments = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userName: users.username,
      pluginName: plugins.name,
      pluginSlug: plugins.slug,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .leftJoin(plugins, eq(comments.pluginId, plugins.id))
    .orderBy(desc(comments.createdAt))
    .limit(12)
    .all()

  const visible = recentPlugins.filter((p) => ['approved', 'manual', 'pending'].includes(p.status))

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold text-white">社区</h1>
      <p className="mt-2 text-slate-400">最新上架的插件与讨论</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-slate-200">最近更新</h2>
          {visible.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">暂无</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {visible.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/plugins/${p.slug}`}
                    className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900 px-4 py-3 transition-colors hover:border-brand-500/40"
                  >
                    <span className="font-medium text-white">{p.name}</span>
                    <span className="text-xs text-slate-500">
                      {p.author} · {p.desc ? p.desc.slice(0, 40) : '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-200">最新讨论</h2>
          {recentComments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">还没有讨论,去插件页留言吧。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentComments.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/plugins/${c.pluginSlug}`}
                    className="block rounded-lg border border-ink-800 bg-ink-900 px-4 py-3 transition-colors hover:border-brand-500/40"
                  >
                    <p className="line-clamp-2 text-sm text-slate-300">{c.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.userName ?? '??'} 评论了 {c.pluginName ?? '某插件'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}