/**
 * 全量插件同步(带限速/重试/断点续传/进度)——本机跑,后台 nohup。
 * 用法: cd apps/web && npx tsx scripts/full-sync.ts
 * 覆盖 GitHub Search API 限流(30/min):每页(100 个)处理完间隔 3s。
 * 断点:进度记在 data/sync-progress.json;中断后重跑从上次续传。
 */
import fs from 'node:fs'
import { config } from 'dotenv'
if (fs.existsSync('.env.local')) config({ path: '.env.local' })

const { syncFromGithub } = await import('../lib/registry')

const PROGRESS_FILE = 'data/sync-progress.json'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const TOTAL_PAGES = 10 // Search API 最多取前 1000 条

async function main() {
  let donePages = 0
  try {
    const p = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
    donePages = p.donePages ?? 0
  } catch {}
  console.log(`[full-sync] 开始,已完成 ${donePages}/${TOTAL_PAGES} 页`)

  for (let page = donePages + 1; page <= TOTAL_PAGES; page++) {
    console.log(`[full-sync] page ${page}/${TOTAL_PAGES} …`)
    try {
      const result = await syncFromGithub({ limit: 100, page })
      donePages = page
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ donePages, at: new Date().toISOString() }))
      console.log(
        `[full-sync] page ${page} ok: added=${result.added} updated=${result.updated} validated=${result.validated}`,
      )
    } catch (e: any) {
      console.error(`[full-sync] page ${page} 失败:`, String(e?.message ?? e).slice(0, 200))
      if (e?.rateLimit) console.error(`[full-sync] rateLimit remaining=${e.rateLimit}`)
      console.error(`[full-sync] 等待 70s 后重试本页 …`)
      await sleep(70000)
      page--
      continue
    }
    await sleep(3000) // 页间限速(Search API 30/min)
  }

  console.log('[full-sync] 全部完成!')
  process.exit(0)
}

main().catch((e) => {
  console.error('[full-sync] fatal:', e)
  process.exit(1)
})
