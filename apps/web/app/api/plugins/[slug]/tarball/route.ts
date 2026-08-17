import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createGzip } from 'node:zlib'
import { Readable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { plugins } from '@/lib/schema'
import { GITHUB_TOKEN } from '@/lib/env'

// GET /api/plugins/[slug]/tarball —— 本站分发的插件源码包(仅 approved/manual)
// 用 GitHub Contents API 递归拉取打包(服务器可稳定访问 api.github.com;tarball/codeload 端点会被限流)
// 缓存到 data/plugin-cache/
export const dynamic = 'force-dynamic'

const API = 'https://api.github.com'

async function ghGet(url: string): Promise<any> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  return res.json()
}

/** 收集文件清单(git/trees recursive 一次拿全,比逐目录 Contents 快) */
async function collectFiles(repo: string, ref: string): Promise<Array<{ path: string; sha: string }>> {
  const url = `${API}/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`
  const data = await ghGet(url)
  if (!Array.isArray(data.tree)) throw new Error('无法获取仓库文件树')
  return data.tree
    .filter((t: any) => t.type === 'blob')
    .map((t: any) => ({ path: t.path as string, sha: t.sha as string }))
}

/** 下载文件内容(blob API, 并发受限) */
async function fetchBlob(repo: string, sha: string): Promise<Buffer> {
  const url = `${API}/repos/${repo}/git/blobs/${sha}`
  const data = await ghGet(url)
  if (data.encoding === 'base64' && data.content) return Buffer.from(data.content, 'base64')
  throw new Error(`无法解码 blob ${sha}`)
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const row = await db.select().from(plugins).where(eq(plugins.slug, slug)).get()
  if (!row || (row.status !== 'approved' && row.status !== 'manual')) {
    return NextResponse.json({ error: '插件不存在或未上架' }, { status: 404 })
  }

  const m = /^github:([^/]+\/[^#]+)(?:#(.+))?$/.exec(row.spec)
  if (!m) return NextResponse.json({ error: '不支持的插件源' }, { status: 400 })
  const [, repo, ref] = m
  const resolvedRef = ref || 'HEAD'

  const cacheDir = path.join(process.cwd(), 'data', 'plugin-cache')
  fs.mkdirSync(cacheDir, { recursive: true })
  const cacheKey = crypto.createHash('sha256').update(`${repo}@${resolvedRef}`).digest('hex').slice(0, 16)
  const cacheFile = path.join(cacheDir, `${slug}-${cacheKey}.tar.gz`)

  if (fs.existsSync(cacheFile)) {
    const data = fs.readFileSync(cacheFile)
    return new NextResponse(data, {
      headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${slug}.tar.gz"`, 'Cache-Control': 'public, max-age=86400' },
    })
  }

  try {
    // 文件清单(一次 trees API)
    const files = await collectFiles(repo, resolvedRef)
    if (files.length === 0) throw new Error('仓库为空')

    // 跳过非必要文件(.github/workflows 等),减少下载量
    const wanted = files.filter((f) => !f.path.startsWith('.github/') && !f.path.startsWith('.git/') && !f.path.includes('/node_modules/'))
    // 并发下载 blob(限 8 并发,避免 GitHub 限流)
    const entries: Array<{ path: string; content: Buffer }> = []
    const queue = [...wanted]
    const workers = Array.from({ length: 8 }, async () => {
      while (queue.length > 0) {
        const f = queue.shift()!
        entries.push({ path: f.path, content: await fetchBlob(repo, f.sha) })
      }
    })
    await Promise.all(workers)

    // 打包为 tar.gz(根目录 = {slug}/)
    const tar = await buildTar(entries, slug)
    const gz = await gzip(tar)
    fs.writeFileSync(cacheFile, gz)

    return new NextResponse(gz, {
      headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${slug}.tar.gz"`, 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: `插件打包失败:${String(e?.message ?? e).slice(0, 200)}` }, { status: 502 })
  }
}

/** 极简 tar 打包(仅普通文件, ustar 格式) */
async function buildTar(files: Array<{ path: string; content: Buffer }>, root: string): Promise<Buffer> {
  const chunks: Buffer[] = []
  const now = Math.floor(Date.now() / 1000)
  const header = (name: string, size: number) => {
    const buf = Buffer.alloc(512)
    const nameBuf = Buffer.from(name)
    nameBuf.copy(buf, 0, 0, Math.min(nameBuf.length, 100))
    // mode(8): 0644, uid/gid, size, mtime, checksum
    buf.write('0000644', 100, 7, 'ascii')
    buf.write('0000000', 108, 7, 'ascii')
    buf.write('0000000', 116, 7, 'ascii')
    buf.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii')
    buf.write(now.toString(8).padStart(11, '0') + '\0', 136, 12, 'ascii')
    buf.write('        ', 148, 8, 'ascii') // checksum placeholder
    buf.write('0', 156, 1, 'ascii') // typeflag = file
    buf.write('ustar\0', 257, 6, 'ascii')
    buf.write('00', 263, 2, 'ascii')
    // 计算 checksum
    let sum = 0
    for (let i = 0; i < 512; i++) sum += buf[i]
    buf.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
    return buf
  }

  for (const f of files) {
    const name = `${root}/${f.path}`
    chunks.push(header(name, f.content.length))
    chunks.push(f.content)
    const pad = (512 - (f.content.length % 512)) % 512
    if (pad) chunks.push(Buffer.alloc(pad))
  }
  chunks.push(Buffer.alloc(1024)) // 结束块
  return Buffer.concat(chunks)
}

async function gzip(buf: Buffer): Promise<Buffer> {
  const gz = createGzip()
  const out: Buffer[] = []
  const stream = Readable.from([buf]).pipe(gz)
  for await (const chunk of stream) out.push(chunk as Buffer)
  return Buffer.concat(out)
}
