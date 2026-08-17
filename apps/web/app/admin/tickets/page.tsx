import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { instances, tickets, users } from '@/lib/schema'
import { auth } from '@/lib/auth'
import TicketActions from './TicketActions'

export const dynamic = 'force-dynamic'

interface TicketRow {
  id: string
  instanceId: string
  userId: string
  message: string
  status: 'open' | 'resolved'
  createdAt: Date
  resolvedAt: Date | null
  resolvedBy: string | null
  slot: string | null
  subdomain: string | null
  submitter: string | null
  resolver: string | null
}

export default async function AdminTicketsPage() {
  const session = await auth()
  if (session?.user?.role !== 'admin') redirect('/login')

  const rows = await db.select().from(tickets).orderBy(desc(tickets.createdAt)).all()
  const out: TicketRow[] = []
  for (const t of rows) {
    const inst = await db.select().from(instances).where(eq(instances.id, t.instanceId)).get()
    const submitter = await db.select().from(users).where(eq(users.id, t.userId)).get()
    const resolver = t.resolvedBy
      ? await db.select().from(users).where(eq(users.id, t.resolvedBy!)).get()
      : undefined
    out.push({
      ...t,
      slot: inst?.slot ?? null,
      subdomain: inst?.subdomain ?? null,
      submitter: submitter?.username ?? null,
      resolver: resolver?.username ?? null,
    })
  }

  const open = out.filter((t) => t.status === 'open')
  const resolved = out.filter((t) => t.status === 'resolved')

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold text-white">管理员后台</h1>
      <p className="mt-1 text-sm text-slate-400">
        联系解决工单:用户对托管实例提交的问题,在此查看并处理。此页仅管理员可见。
      </p>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
          待处理
          <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-400">{open.length}</span>
        </h2>
        <TicketList rows={open} />
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
          已解决
          <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-400">{resolved.length}</span>
        </h2>
        <TicketList rows={resolved} />
      </section>
    </div>
  )
}

function TicketList({ rows }: { rows: TicketRow[] }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-slate-600">无</p>
  return (
    <div className="mt-3 space-y-3">
      {rows.map((t) => (
        <div key={t.id} className="rounded-lg border border-ink-800 bg-ink-900 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-brand-500/15 px-2 py-0.5 font-mono text-brand-400">{t.slot ?? t.instanceId}</span>
            <span className="font-mono text-slate-400">{t.subdomain ?? '—'}</span>
            <span className="text-slate-500">提交人:{t.submitter ?? '?'}</span>
            <span className="text-slate-500">{new Date(t.createdAt).toLocaleString('zh-CN')}</span>
            {t.status === 'resolved' && (
              <span className="text-slate-500">
                已由 {t.resolver ?? '管理员'} 处理于 {t.resolvedAt ? new Date(t.resolvedAt).toLocaleString('zh-CN') : ''}
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{t.message}</p>
          <div className="mt-3">
            <TicketActions id={t.id} status={t.status} />
          </div>
        </div>
      ))}
    </div>
  )
}
