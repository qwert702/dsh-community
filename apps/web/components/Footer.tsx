import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-ink-800 bg-ink-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-ink-950 text-sm font-bold">
                d
              </span>
              <span className="font-semibold text-white">dsh 社区</span>
            </div>
            <p className="mt-3 text-sm text-slate-400 max-w-xs">
              DeepSeek Harness 开源的插件市场与社区。连接你的本机 dsh,一键远程安装插件。
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300">导航</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>
                <Link href="/plugins" className="hover:text-brand-400">插件商店</Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-brand-400">文档</Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-brand-400">社区</Link>
              </li>
              <li>
                <Link href="/console" className="hover:text-brand-400">远程控制台</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300">开源</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>
                <a
                  href="https://github.com/deepseek-ai/dsh"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-brand-400"
                >
                  GitHub · dsh
                </a>
              </li>
              <li>
                <Link href="/submit" className="hover:text-brand-400">提交你的插件</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-ink-800 pt-6 text-center text-xs text-slate-500">
          <p>dsh 社区 · DeepSeek Harness Open Source Community</p>
          <p className="mt-1">© {new Date().getFullYear()} dsh-community. Built with Next.js.</p>
        </div>
      </div>
    </footer>
  )
}