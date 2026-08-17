import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { plugins } from '@/lib/schema'
import { auth } from '@/lib/auth'
import AdminActions from './AdminActions'
import { categoryName, categoryColor } from '@/components/PluginCard'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await auth()
  if (session?.user?.role !== 'admin') redirect('/login')

  const all = await db.select().from(plugins).orderBy(desc(plugins.updatedAt)).all()
  const pendingAll = all.filter((p) => p.status === 'pending')

  const groups = [
    { key: 'pending', label: '待审核', rows: pendingAll },
    { key: 'approved', label: '已批准', rows: all.filter((p) => p.status === 'approved') },
    { key: 'manual', label: '手动', rows: all.filter((p) => p.status === 'manual') },
    { key: 'rejected', label: '已拒绝', rows: all.filter((p) => p.status === 'rejected') },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold text-white">插件审核</h1>
      <p className="mt-1 text-sm text-slate-400">批准后插件进入白名单,可被远程安装。</p>

      {groups.map((g) => (
        <section key={g.key} className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
            {g.label}
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-400">
              {g.rows.length}
            </span>
          </h2>
          <AdminList rows={g.rows} />
        </section>
      ))}
    </div>
  )
}

function AdminList({
  rows,
}: {
  rows: Array<{
    id: string
    name: string
    category: string
    status: string
    source: string
    manifestValid: boolean
    desc: string
    repo: string | null
    spec: string
  }>
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-slate-600">无</p>
  }
  return (
    <div className="mt-3 space-y-3">
      {rows.map((p) => (
        <div key={p.id} className="rounded-lg border border-ink-800 bg-ink-900 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">{p.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${categoryColor(p.category)}`}>
              {categoryName(p.category)}
            </span>
            {p.manifestValid ? (
              <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs text-brand-400">
                校验通过
              </span>
            ) : (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
                校验失败
              </span>
            )}
            <span className="text-xs text-slate-500">source: {p.source}</span>
          </div>
          <p className="mt-1.5 text-sm text-slate-400 line-clamp-2">{p.desc}</p>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">{p.spec}</p>
          <AdminActions
            id={p.id}
            status={p.status}
            repo={p.repo}
          />
        </div>
      ))}
    </div>
  )
}