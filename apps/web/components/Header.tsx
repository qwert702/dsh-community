import Link from 'next/link'
import { auth } from '@/lib/auth'
import LogoutButton from './LogoutButton'

const nav = [
  { href: '/plugins', label: '插件商店' },
  { href: '/docs', label: '文档' },
  { href: '/hosting', label: '托管' },
  { href: '/community', label: '社区' },
  { href: '/console', label: '远程控制台' },
]

export default async function Header() {
  const session = await auth()
  return (
    <header className="sticky top-0 z-50 border-b border-ink-800 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-ink-950 text-lg font-bold">
            d
          </span>
          <span className="text-lg font-semibold text-white tracking-tight">
            dsh<span className="text-brand-400">社区</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-ink-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          {session?.user?.role === 'admin' && (
            <Link
              href="/admin/tickets"
              className="rounded-lg px-3 py-2 text-sm text-amber-400/90 transition-colors hover:bg-ink-800 hover:text-amber-300"
            >
              管理员后台
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link
                href="/console"
                className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-brand-500 hover:text-brand-400"
              >
                {session.user.name ?? session.user.id}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/submit"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-brand-400"
              >
                提交插件
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-brand-500 hover:text-brand-400"
              >
                登录
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}