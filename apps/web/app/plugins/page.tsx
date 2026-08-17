import { desc, eq, inArray, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { plugins } from '@/lib/schema'
import PluginCard from '@/components/PluginCard'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '插件商店',
  description: '浏览、搜索 dsh 开源插件,并一键安装到你的本机 harness。',
}

export default async function PluginsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ''
  const cat = sp.cat ?? ''

  const VIEWABLE: Array<'approved' | 'manual' | 'pending'> = ['approved', 'manual', 'pending']
  const where = cat ? and(eq(plugins.category, cat), inArray(plugins.status, VIEWABLE)) : undefined
  const all = where
    ? await db.select().from(plugins).where(where).orderBy(desc(plugins.heat)).all()
    : await db.select().from(plugins).orderBy(desc(plugins.heat)).all()

  const visible = all.filter((p) =>
    ['approved', 'manual', 'pending'].includes(p.status),
  )
  const filtered = q
    ? visible.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.desc.toLowerCase().includes(q.toLowerCase()) ||
          (p.repo ?? '').toLowerCase().includes(q.toLowerCase()),
      )
    : visible

  const cats = [
    ['', '全部'],
    ['vision', '视觉'],
    ['voice', '语音'],
    ['llm', '模型'],
    ['tool', '工具'],
    ['database', '数据'],
    ['web', '网络'],
  ]

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">插件商店</h1>
          <p className="mt-2 text-slate-400">
            {visible.length} 个 dsh 插件,自动同步自 GitHub topic:dsh-plugin
          </p>
        </div>
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="搜索插件名 / 描述 / 仓库…"
            className="w-64 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400"
          >
            搜索
          </button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {cats.map(([key, label]) => (
          <a
            key={key}
            href={key ? `/plugins?cat=${key}` : '/plugins'}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              (cat || '') === key
                ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                : 'border-ink-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">
          <p className="text-4xl">🔍</p>
          <p className="mt-4">没有匹配的插件。试试其他关键词,或提交一个新插件。</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PluginCard key={p.id} plugin={p} />
          ))}
        </div>
      )}
    </div>
  )
}