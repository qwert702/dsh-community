/**
 * 本机预生成插件 tarball 缓存(有代理访问 GitHub)。
 * 用法: cd apps/web && HTTPS_PROXY=http://127.0.0.1:7897 npx tsx scripts/prebuild-tarballs.ts
 * 遍历 approved/manual 插件,从 GitHub 下载 zipball → 解压 → 重新打包为 pnpm 可用的 tar.gz
 * (pnpm add URL 需要 tar 格式且包根目录是 package.json;GitHub zipball 是嵌套目录的 zip)
 * 存到 data/plugin-cache/{slug}-{hash}.tar.gz,部署时随包上传,服务器 tarball API 命中缓存直接返回。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { config } from 'dotenv'
if (fs.existsSync('.env.local')) config({ path: '.env.local' })

const { db } = await import('../lib/db')
const { plugins } = await import('../lib/schema')
const { eq, or } = await import('drizzle-orm')
const { GITHUB_TOKEN } = await import('../lib/env')

const API = 'https://api.github.com'
const cacheDir = path.join(process.cwd(), 'data', 'plugin-cache')
fs.mkdirSync(cacheDir, { recursive: true })

/** 把 GitHub zipball 转成 pnpm 可用的 tar.gz(根目录 = 包名) */
function zipballToTarGz(zipPath: string, outPath: string, pkgName: string): void {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-tar-'))
  try {
    execFileSync('unzip', ['-q', zipPath, '-d', tmp])
    const dirs = fs.readdirSync(tmp)
    if (dirs.length !== 1) throw new Error('zipball 应只含一个根目录')
    const src = path.join(tmp, dirs[0])
    // 根目录改为包名,打包 tar.gz
    const stage = path.join(tmp, 'stage')
    fs.mkdirSync(stage)
    execFileSync('mv', [src, path.join(stage, pkgName)])
    execFileSync('tar', ['-czf', outPath, '-C', stage, pkgName])
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

async function main() {
  const rows = await db.select().from(plugins).where(or(eq(plugins.status, 'approved'), eq(plugins.status, 'manual'))).all()
  console.log(`[tarballs] 共 ${rows.length} 个上架插件`)

  let ok = 0
  let fail = 0
  for (const row of rows) {
    const m = /^github:([^/]+\/[^#]+)(?:#(.+))?$/.exec(row.spec)
    if (!m) { console.log(`  skip ${row.slug} (非 github 源)`); continue }
    const [, repo, ref] = m
    const resolvedRef = ref || 'HEAD'
    const cacheKey = crypto.createHash('sha256').update(`${repo}@${resolvedRef}`).digest('hex').slice(0, 16)
    const cacheFile = path.join(cacheDir, `${row.slug}-${cacheKey}.tar.gz`)

    if (fs.existsSync(cacheFile)) { console.log(`  cache-hit ${row.slug}`); ok++; continue }

    try {
      console.log(`  下载 ${row.slug} (${repo}@${resolvedRef}) …`)
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
      if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`
      const res = await fetch(`${API}/repos/${repo}/zipball/${encodeURIComponent(resolvedRef)}`, {
        headers,
        signal: AbortSignal.timeout(120000),
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const zipBuf = Buffer.from(await res.arrayBuffer())
      const zipPath = path.join(os.tmpdir(), `${row.slug}-${cacheKey}.zip`)
      fs.writeFileSync(zipPath, zipBuf)
      // 包名:插件 slug 或 package.json name
      const pkgName = row.slug
      zipballToTarGz(zipPath, cacheFile, pkgName)
      fs.rmSync(zipPath, { force: true })
      const size = fs.statSync(cacheFile).size
      console.log(`  OK ${row.slug} (${(size / 1024).toFixed(0)}KB)`)
      ok++
    } catch (e: any) {
      console.error(`  FAIL ${row.slug}: ${String(e?.message ?? e).slice(0, 100)}`)
      fail++
    }
    await new Promise((r) => setTimeout(r, 1000)) // 限流保护
  }
  console.log(`[tarballs] 完成: ok=${ok} fail=${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('[tarballs] fatal:', e); process.exit(1) })
