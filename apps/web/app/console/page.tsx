import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { devices, plugins } from '@/lib/schema'
import { auth } from '@/lib/auth'
import ConsoleClient from './ConsoleClient'

export const dynamic = 'force-dynamic'

export default async function ConsolePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const deviceRows = await db
    .select()
    .from(devices)
    .where(eq(devices.userId, session.user.id))
    .orderBy(desc(devices.updatedAt))
    .all()

  const storePlugins = await db
    .select()
    .from(plugins)
    .orderBy(desc(plugins.heat))
    .all()
  const installable = storePlugins.filter(
    (p) => p.status === 'approved' || p.status === 'manual',
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold text-white">远程控制台</h1>
      <p className="mt-2 text-slate-400">
        通过 dsh-link-plugin 远程管理你的本机 dsh。先安装并配对插件,再从这里下发指令。
      </p>

      <div className="mt-4 rounded-xl border border-ink-800 bg-ink-900 p-4">
        <p className="text-sm text-slate-400">
          没有本机 dsh?可以
          <a href="/hosting" className="mx-1 text-brand-400 hover:underline">
            领取一台托管 dsh
          </a>
          ,在浏览器里直接用。
        </p>
      </div>

      <ConsoleClient devices={deviceRows} installable={installable} />
    </div>
  )
}