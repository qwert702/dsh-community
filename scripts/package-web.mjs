/**
 * 把 Next.js standalone 构建打包成可上传到服务器的部署包。
 * 用法: (在仓库根) node scripts/package-web.mjs
 *
 * 产物: dist/dsh-web.tar.gz
 *   server.js  (standalone 入口)
 *   .next/static/
 *   node_modules/ (standalone 已包含运行时依赖)
 *   data/         (空,部署时建表)
 *   .env.example
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const web = path.join(root, 'apps', 'web')
const standalone = path.join(web, '.next', 'standalone')
const dist = path.join(root, 'dist')
const stage = path.join(dist, 'dsh-web')

// 1) 构建
console.log('[1/4] 构建生产包 …')
execSync('pnpm --filter @dsh-community/web build', { stdio: 'inherit', cwd: root, shell: true })

// 2) 组装
console.log('[2/4] 组装 standalone …')
fs.rmSync(stage, { recursive: true, force: true })
fs.cpSync(standalone, stage, { recursive: true })

// .next/static
fs.mkdirSync(path.join(stage, '.next'), { recursive: true })
fs.cpSync(path.join(web, '.next', 'static'), path.join(stage, '.next', 'static'), { recursive: true })

// public
if (fs.existsSync(path.join(web, 'public'))) {
  fs.cpSync(path.join(web, 'public'), path.join(stage, 'public'), { recursive: true })
}

// data 目录占位
fs.mkdirSync(path.join(stage, 'data'), { recursive: true })

// 环境变量样例
fs.writeFileSync(
  path.join(stage, '.env.example'),
  `DATABASE_PATH=/www/wwwroot/cbnac.com/dsh-site/data/dsh.db
AUTH_SECRET=<replace>
GITHUB_TOKEN=<replace>
DSH_REGISTRY_HMAC=<replace>
WS_GATEWAY_URL=http://127.0.0.1:3001
WS_GATEWAY_KEY=<replace>
SYNC_KEY=<replace>
PORT=3002
HOSTNAME=127.0.0.1
`,
)

// 3) 压缩
console.log('[3/4] 压缩 …')
const tgz = path.join(dist, 'dsh-web.tar.gz')
fs.rmSync(tgz, { force: true })
// standalone 的 node_modules 已 inline;server.js 走 node dist/dsh-web/server.js
execSync(`bash -lc "tar -czf '${tgz}' -C '${stage}' ."`, { stdio: 'inherit' })

console.log(`[4/4] 完成: ${tgz}`)
console.log(`  部署时: scp ${tgz} root@cbnac.com:/www/wwwroot/cbnac.com/dsh-site/`)
console.log('  然后执行 scripts/deploy.sh 完成剩余步骤')