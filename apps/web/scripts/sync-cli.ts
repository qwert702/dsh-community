/**
 * 手动触发 GitHub 插件同步(CLI)。
 * 用法: cd apps/web && npx tsx scripts/sync-cli.ts
 */
import fs from 'node:fs'
import { config } from 'dotenv'
if (fs.existsSync('.env.local')) config({ path: '.env.local' })

const { syncFromGithub } = await import('../lib/registry')

async function main() {
  console.log('开始同步 GitHub topic:dsh-plugin …')
  const result = await syncFromGithub({ limit: 30 })
  console.log('同步完成:', JSON.stringify(result))
  process.exit(0)
}

main().catch((e) => {
  console.error('同步失败:', e)
  process.exit(1)
})