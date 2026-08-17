/**
 * GitHub API 客户端 —— 插件商店数据源。
 * 搜索 topic:dsh-plugin 的仓库,读取 manifest,锁定精确 commit。
 */
const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'

export interface GithubRepo {
  fullName: string // owner/repo
  name: string
  owner: string
  description: string | null
  stargazersCount: number
  htmlUrl: string
  homepage: string | null
  defaultBranch: string
  updatedAt: string
  archived: boolean
  topics: string[]
}

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

async function ghFetch(url: string, token?: string): Promise<any> {
  const res = await fetch(url, { headers: authHeaders(token), signal: AbortSignal.timeout(30000) })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(`GitHub API ${res.status}: ${url} ${body.slice(0, 200)}`) as Error & {
      status?: number
      rateLimit?: string
    }
    err.status = res.status
    err.rateLimit = res.headers.get('x-ratelimit-remaining') ?? undefined
    throw err
  }
  return res.json()
}

/**
 * 搜索 topic:dsh-plugin 的仓库(未归档)。
 * Search API 限流: 30/min (带 token), 10/min (匿名)。
 */
export async function searchDshPlugins(token?: string, page = 1, perPage = 100): Promise<GithubRepo[]> {
  const q = 'topic:dsh-plugin archived:false'
  const url = `${API}/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${perPage}&page=${page}`
  const data = await ghFetch(url, token)
  const items: any[] = data.items ?? []
  return items.map((r) => ({
    fullName: r.full_name,
    name: r.name,
    owner: r.owner.login,
    description: r.description,
    stargazersCount: r.stargazers_count,
    htmlUrl: r.html_url,
    homepage: r.homepage,
    defaultBranch: r.default_branch,
    updatedAt: r.updated_at,
    archived: r.archived,
    topics: r.topics ?? [],
  }))
}

/** 读取仓库任意文件内容(raw)。ref 可为分支或 sha。 */
export async function fetchRaw(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  token?: string,
): Promise<string | null> {
  const url = `${RAW}/${owner}/${repo}/${ref}/${path}`
  const res = await fetch(url, {
    headers: authHeaders(token),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) return null
  return res.text()
}

/** 获取默认分支最新 commit sha(用于锁定精确安装源)。 */
export async function getDefaultBranchHead(owner: string, repo: string, token?: string): Promise<string | null> {
  try {
    const data = await ghFetch(`${API}/repos/${owner}/${repo}/commits?per_page=1`, token)
    if (Array.isArray(data) && data.length > 0) return data[0].sha
    return null
  } catch {
    return null
  }
}

/** 限流剩余查询(诊断用)。 */
export async function getRateLimit(token?: string): Promise<number | null> {
  try {
    const data = await ghFetch(`${API}/rate_limit`, token)
    return data?.resources?.search?.remaining ?? null
  } catch {
    return null
  }
}
