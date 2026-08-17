import fs from 'node:fs'
import path from 'node:path'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const CONTENT_DIR = path.join(process.cwd(), 'docs-content')

interface DocNav {
  slug: string
  title: string
}

// 侧边栏导航顺序与标题
const NAV: DocNav[] = [
  { slug: 'getting-started', title: '快速上手' },
  { slug: 'installation', title: '安装 dsh' },
  { slug: 'link', title: '远程连接(dsh-link-plugin)' },
  { slug: 'store', title: '插件商店与安装' },
  { slug: 'build-a-plugin', title: '构建你的插件' },
  { slug: 'faq', title: '常见问题' },
]

function readDoc(slug: string): { title: string; content: string } | null {
  const file = path.join(CONTENT_DIR, `${slug}.md`)
  if (!fs.existsSync(file)) return null
  const raw = fs.readFileSync(file, 'utf-8')
  // 首行 # Title 作为元数据
  const lines = raw.split('\n')
  let title = slug
  let content = raw
  if (lines[0]?.startsWith('# ')) {
    title = lines[0].slice(2).trim()
    content = lines.slice(1).join('\n').trim()
  }
  return { title, content }
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const docSlug = (slug ?? [])[0] ?? 'getting-started'

  const navMap = new Map(NAV.map((n) => [n.slug, n.title]))
  const loaded = readDoc(docSlug)
  if (!loaded) notFound()

  const prev = NAV[NAV.findIndex((n) => n.slug === docSlug) - 1]
  const next = NAV[NAV.findIndex((n) => n.slug === docSlug) + 1]

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-6 py-10">
      <aside className="hidden w-52 shrink-0 lg:block">
        <nav className="sticky top-24 space-y-1">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            文档
          </p>
          {NAV.map((item) => (
            <Link
              key={item.slug}
              href={`/docs/${item.slug}`}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                item.slug === docSlug
                  ? 'bg-brand-500/10 font-medium text-brand-400'
                  : 'text-slate-400 hover:bg-ink-800 hover:text-white'
              }`}
            >
              {item.title}
            </Link>
          ))}
          <Link
            href="/plugins"
            className="mt-4 block rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-brand-400"
          >
            ← 返回商店
          </Link>
        </nav>
      </aside>

      <article className="min-w-0 flex-1">
        <div className="prose-doc max-w-none">
          <h1>{loaded.title}</h1>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug, rehypeHighlight]}
          >
            {loaded.content}
          </ReactMarkdown>
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-ink-800 pt-6">
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="text-sm text-slate-400 hover:text-brand-400"
            >
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className="text-sm text-slate-400 hover:text-brand-400"
            >
              {next.title} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </article>
    </div>
  )
}