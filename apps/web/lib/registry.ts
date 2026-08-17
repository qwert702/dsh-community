import { eq, or } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from './db'
import { plugins, type NewPlugin } from './schema'
import { searchDshPlugins, getDefaultBranchHead, type GithubRepo } from './github'
import { validateDshPlugin } from './plugin-validator'
import { GITHUB_TOKEN, DSH_REGISTRY_HMAC } from './env'

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/vision|multimodal|image|视觉|图片/i, 'vision'],
  [/voice|audio|asr|tts|audio|语音/i, 'voice'],
  [/llm|model|deepseek|chat|对话/i, 'llm'],
  [/sql|database|db|存储/i, 'database'],
  [/web|http|server|网络/i, 'web'],
  [/tool|util|工具/i, 'tool'],
]

function guessCategory(repoName: string, desc: string | null): string {
  const haystack = `${repoName} ${desc ?? ''}`
  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(haystack)) return cat
  }
  return 'tool'
}

/**
 * 从 GitHub 同步 topic:dsh-plugin 仓库进 plugins 表。
 * - 校验 dsh.bundle.patch 声明 → manifestValid + 锁定 spec(github:owner/repo#sha)
 * - 已批准/手动行更新元数据;新仓库以 pending 进入待审核
 * - 未归档且出现在搜索结果但本地已 removed 的行不再激活(下架语义由审批流控制)
 * - 分页拉全:每页 100,最多 10 页(GitHub Search API 上限前 1000 条);
 *   opts.limit 若 <100 则视为单页条数(老行为),>100 时按页拉全。
 */
export async function syncFromGithub(opts?: { limit?: number }): Promise<SyncResult> {
  const requested = opts?.limit ?? 1000
  const pageSize = requested >= 100 ? 100 : requested
  const maxPages = requested >= 100 ? Math.min(Math.ceil(requested / 100), 10) : 1

  let repos: GithubRepo[] = []
  for (let page = 1; page <= maxPages; page++) {
    const pageRepos = await searchDshPlugins(GITHUB_TOKEN, page, pageSize)
    repos = repos.concat(pageRepos)
    if (pageRepos.length < pageSize) break
  }

  let added = 0
  let updated = 0
  let validated = 0
  const newRows: NewPlugin[] = []
  const repoFullNames = repos.map((r) => r.fullName)

  // 每个仓库校验 + 构造行
  for (const repo of repos) {
    const head = await getDefaultBranchHead(repo.owner, repo.name, GITHUB_TOKEN)
    const ref = head ?? repo.defaultBranch
    const v = await validateDshPlugin(repo.owner, repo.name, ref, GITHUB_TOKEN)

    const dshName = v.packageName
    const slug = suggestSlug(dshName, repo.owner, repo.name)
    const spec = v.valid
      ? `github:${repo.fullName}#${head ?? repo.defaultBranch}`
      : `github:${repo.fullName}`
    const installCommand = `dsh plugin --profile web add "${spec}"`

    newRows.push({
      id: randomUUID(),
      slug,
      name: displayName(dshName),
      author: repo.owner,
      category: guessCategory(repo.name, repo.description),
      desc: repo.description ?? '',
      longDesc: repo.description ?? '',
      spec,
      installCommand,
      repo: repo.fullName,
      repoUrl: repo.htmlUrl,
      homepage: repo.homepage,
      source: 'github',
      status: 'pending',
      stars: repo.stargazersCount,
      githubData: {
        topics: repo.topics,
        updatedAt: repo.updatedAt,
        ref,
      },
      manifestValid: v.valid,
      patchPath: v.patchPath,
      version: v.pkg?.version ?? null,
      lastValidatedAt: new Date(),
    })
  }

  // 事务写入:存在的行就 update,新的 insert
  for (const row of newRows) {
    const existing = await db
      .select({ id: plugins.id, status: plugins.status })
      .from(plugins)
      .where(eq(plugins.slug, row.slug))
      .get()

    if (existing) {
      // 仅刷新元数据,不覆盖人工审批的 status
      if (existing.status === 'pending' || existing.status === 'approved') {
        await db
          .update(plugins)
          .set({
            name: row.name,
            desc: row.desc,
            longDesc: row.longDesc,
            stars: row.stars,
            githubData: row.githubData,
            manifestValid: row.manifestValid,
            patchPath: row.patchPath,
            version: row.version,
            lastValidatedAt: row.lastValidatedAt,
            spec: row.spec,
            installCommand: row.installCommand,
            repoUrl: row.repoUrl,
            homepage: row.homepage,
            category: row.category,
            updatedAt: new Date(),
          })
          .where(eq(plugins.slug, row.slug))
        updated++
        if (row.manifestValid && existing.status === 'approved') validated++
      } else {
        // rejected / removed / manual 的用户态不覆盖
        updated++
      }
    } else {
      await db.insert(plugins).values(row)
      added++
      if (row.manifestValid) validated++
    }
  }

  return { added, updated, validated, total: repos.length }
}

export interface SyncResult {
  added: number
  updated: number
  validated: number
  total: number
}

/**
 * HMAC-SHA256 签名注册表,供 dsh-link-plugin 离线缓存与白名单校验。
 * /api/plugins/registry.json 返回 { version, generatedAt, plugins:[...], sig }
 */
export async function buildRegistry(): Promise<RegistryResponse> {
  const rows = await db
    .select({
      slug: plugins.slug,
      name: plugins.name,
      category: plugins.category,
      desc: plugins.desc,
      spec: plugins.spec,
      version: plugins.version,
      repoUrl: plugins.repoUrl,
    })
    .from(plugins)
    .where(or(eq(plugins.status, 'approved'), eq(plugins.status, 'manual')))
    .all()

  const version = Math.floor(Date.now() / 1000).toString()
  const payload: RegistryResponse = {
    version,
    generatedAt: new Date().toISOString(),
    plugins: rows,
    sig: DSH_REGISTRY_HMAC
      ? sign(JSON.stringify({ version, plugins: rows }), DSH_REGISTRY_HMAC)
      : `unsigned:${version}`,
  }
  return payload
}

interface RegistryPayload {
  version: string
  generatedAt: string
  plugins: Array<{
    slug: string
    name: string
    category: string
    desc: string
    spec: string
  }>
}

type RegistryResponse = RegistryPayload & { sig: string }

function sign(data: string, secret: string): string {
  const crypto = require('node:crypto') as typeof import('node:crypto')
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

/** 仓库名 → 人可读名 */
function displayName(packageName: string): string {
  return packageName.replace(/^@[^/]+\//, '').replace(/^dsh-/i, '').replace(/^dsh_/, '')
}

/** 包名 → URL slug 规范化 */
function suggestSlug(packageName: string, owner: string, repo: string): string {
  const base = packageName.replace(/^@[^/]+\//, '').toLowerCase()
  const out = base.replace(/[@/\\:#?&= ]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return out || `${owner.toLowerCase()}-${repo.toLowerCase()}`
}