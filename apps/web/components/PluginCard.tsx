import Link from 'next/link'
import type { Plugin } from '@/lib/schema'
import RemoteInstallButton from './RemoteInstallButton'

export function categoryName(cat: string): string {
  const map: Record<string, string> = {
    vision: '视觉',
    voice: '语音',
    llm: '模型',
    tool: '工具',
    database: '数据',
    web: '网络',
    other: '其他',
  }
  return map[cat] ?? cat
}

export function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    vision: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    voice: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    llm: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    tool: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    database: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    web: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  }
  return map[cat] ?? 'bg-slate-500/15 text-slate-300 border-slate-500/30'
}

export function fmtStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function PluginCard({ plugin }: { plugin: Plugin }) {
  const installable = plugin.status === 'approved' || plugin.status === 'manual'
  return (
    <div className="group flex flex-col rounded-xl border border-ink-800 bg-ink-900 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/5">
      <Link href={`/plugins/${plugin.slug}`} className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-ink-700 to-ink-800 text-xl font-bold text-brand-400">
              {plugin.name[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-white group-hover:text-brand-400">
                {plugin.name}
              </h2>
              <p className="text-xs text-slate-500">
                {plugin.author} · {plugin.manifestValid ? '已验证' : '待验证'}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${categoryColor(plugin.category)}`}
          >
            {categoryName(plugin.category)}
          </span>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-slate-400">
          {plugin.desc || '暂无描述'}
        </p>
      </Link>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="text-amber-400">★</span>
          {fmtStars(plugin.stars)}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 ${
            installable ? 'bg-brand-500/10 text-brand-400' : 'bg-amber-500/10 text-amber-400'
          }`}
        >
          {installable ? '可安装' : '审核中'}
        </span>
      </div>

      {installable && <RemoteInstallButton spec={plugin.spec} name={plugin.name} />}
    </div>
  )
}