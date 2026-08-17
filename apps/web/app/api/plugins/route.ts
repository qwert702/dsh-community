import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { plugins } from '@/lib/schema'
import { auth } from '@/lib/auth'
import { GITHUB_TOKEN } from '@/lib/env'
import { validateDshPlugin } from '@/lib/plugin-validator'
import { getDefaultBranchHead } from '@/lib/github'

const REPO_RE = /^[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: '无效请求' }, { status: 400 })

  const name = String(body.name ?? '').trim().slice(0, 80)
  const repo = String(body.repo ?? '').trim()
  const desc = String(body.desc ?? '').trim().slice(0, 500)

  if (!name) return NextResponse.json({ error: '请填写插件名' }, { status: 400 })
  if (!REPO_RE.test(repo)) {
    return NextResponse.json(
      { error: '仓库格式应为 owner/repo' },
      { status: 400 },
    )
  }

  const [owner, repoName] = repo.split('/')
  const slug = slugify(name) || `${owner.toLowerCase()}-${repoName.toLowerCase()}`

  const existing = await db.select().from(plugins).where(eq(plugins.slug, slug)).get()
  if (existing) {
    return NextResponse.json(
      { error: `slug 已存在(同名插件 "${slug}"),请换个名字` },
      { status: 409 },
    )
  }

  // 可选:校验 GitHub 仓库
  let manifestValid = false
  let spec = `github:${repo}`
  let version: string | null = null
  let patchPath: string | null = null
  if (GITHUB_TOKEN) {
    try {
      const head = await getDefaultBranchHead(owner, repoName, GITHUB_TOKEN)
      const ref = head ?? 'main'
      const v = await validateDshPlugin(owner, repoName, ref, GITHUB_TOKEN)
      manifestValid = v.valid
      patchPath = v.patchPath
      version = v.pkg?.version ?? null
      if (v.valid && head) spec = `github:${repo}#${head}`
    } catch {
      // 校验失败仍可提交,由管理员人工审查
    }
  }

  await db.insert(plugins).values({
    id: randomUUID(),
    slug,
    name,
    author: session.user.name ?? 'user',
    authorId: session.user.id,
    category: 'tool',
    desc,
    longDesc: desc,
    spec,
    installCommand: `dsh plugin --profile web add "${spec}"`,
    repo,
    repoUrl: repo && GITHUB_TOKEN ? `https://github.com/${repo}` : `https://github.com/${repo}`,
    source: 'user',
    status: 'pending',
    manifestValid,
    patchPath,
    version,
    lastValidatedAt: new Date(),
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
}