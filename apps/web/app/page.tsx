import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { plugins } from '@/lib/schema'
import PluginCard from '@/components/PluginCard'

export const dynamic = 'force-dynamic'

const features = [
  {
    icon: '🧩',
    title: '插件商店',
    desc: '自动同步 GitHub 上所有 topic:dsh-plugin 仓库,校验后一键安装。',
    href: '/plugins',
  },
  {
    icon: '🔗',
    title: '远程安装',
    desc: 'dsh-link-plugin 把你的本机 harness 连到这里,从浏览器远程安装插件。',
    href: '/docs/link',
  },
  {
    icon: '📚',
    title: '完整文档',
    desc: '从 dsh 入门到构建你的第一个插件,中文章节式指南。',
    href: '/docs',
  },
  {
    icon: '💬',
    title: '开放社区',
    desc: '提交你的插件,与其他 dsh 开发者交流与评论。',
    href: '/community',
  },
]

export default async function HomePage() {
  const top = await db
    .select()
    .from(plugins)
    .orderBy(desc(plugins.heat))
    .limit(6)
    .all()
  const topVisible = top.filter((p) => ['approved', 'manual', 'pending'].includes(p.status))

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-800">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(600px circle at 20% 0%, rgba(34,184,240,0.15), transparent 60%), radial-gradient(500px circle at 80% 100%, rgba(61,220,148,0.1), transparent 60%)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
            DeepSeek Harness · 开源社区
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white md:text-6xl">
            为你的 <span className="bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">dsh harness</span>
            <br />
            找到下一个插件
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            浏览、安装、远程管理 DeepSeek Harness 插件。
            连接你的本机 dsh,网页上点一下即可远程安装。
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/plugins"
              className="rounded-xl bg-brand-500 px-6 py-3 font-medium text-ink-950 transition-colors hover:bg-brand-400"
            >
              浏览插件商店 →
            </Link>
            <Link
              href="/docs/getting-started"
              className="rounded-xl border border-ink-700 px-6 py-3 text-slate-200 transition-colors hover:border-brand-500 hover:text-brand-400"
            >
              快速上手
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-xl border border-ink-800 bg-ink-900 p-6 transition-all hover:-translate-y-0.5 hover:border-brand-500/40"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 font-semibold text-white group-hover:text-brand-400">
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Top plugins */}
      {topVisible.length > 0 && (
        <section className="border-t border-ink-800 bg-ink-900/40 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">热门插件</h2>
              <Link href="/plugins" className="text-sm text-brand-400 hover:underline">
                查看全部 →
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topVisible.map((p) => (
                <PluginCard key={p.id} plugin={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-white">开发者们,动起来</h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          用 dsh 构建一个插件?提交到商店,让整个社区都能远程安装它。
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/submit"
            className="rounded-xl bg-accent-500 px-6 py-3 font-medium text-ink-950 transition-colors hover:bg-accent-400"
          >
            提交我的插件
          </Link>
          <Link
            href="/docs/build-a-plugin"
            className="rounded-xl border border-ink-700 px-6 py-3 text-slate-200 transition-colors hover:border-accent-500 hover:text-accent-400"
          >
            如何构建插件
          </Link>
        </div>
      </section>
    </>
  )
}