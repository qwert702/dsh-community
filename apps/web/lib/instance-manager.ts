import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { db } from './db'
import { instances, type Instance } from './schema'

const run = promisify(execFile)

export const INSTANCE_TTL_DAYS = 7
const IMAGE = process.env.DSH_HARNESS_IMAGE || 'dsh-harness:latest'
const NAS_HOST = process.env.DSH_NAS_HOST || '100.76.91.96'

function runDocker(args: string[], opts?: { timeout?: number }): Promise<{ stdout: string }> {
  return run('docker', args, { timeout: opts?.timeout ?? 60000 }) as unknown as Promise<{ stdout: string }>
}

/** NAS 上执行 docker 命令(经 tailnet ssh,与服务器同网)。 */
function runDockerOnNas(args: string[]): Promise<{ stdout: string }> {
  const quoted = args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')
  return run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', `root@${NAS_HOST}`, `docker ${quoted}`], {
    timeout: 90000,
  }) as unknown as Promise<{ stdout: string }>
}

/** NAS 上执行任意命令(经 tailnet ssh)。 */
function runOnNas(cmd: string): Promise<{ stdout: string }> {
  return run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', `root@${NAS_HOST}`, cmd], {
    timeout: 90000,
  }) as unknown as Promise<{ stdout: string }>
}

/** NAS 实例的 socat 转发端口:服务器 nginx 连 410N,转发到 NAS 本机 127.0.0.1:310N
 *  (dsh 出于安全只绑 127.0.0.1,拒绝 --host 0.0.0.0) */
function socatPort(slot: Instance): number {
  return slot.hostPort + 1000
}

/** 随机子域名池(领取时分配,释放回池)。文件由 scripts/gen-random-domains.ts 生成。 */
let randomDomains: string[] | null = null
function loadRandomDomains(): string[] {
  if (randomDomains) return randomDomains
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const file = path.join(process.cwd(), 'data', 'random-domains.json')
    randomDomains = JSON.parse(fs.readFileSync(file, 'utf8')) as string[]
  } catch {
    randomDomains = []
  }
  return randomDomains
}

/** 领取时分配一个未用的随机子域名(必须匹配实例端口,nginx map 按域名→固定端口路由);无空闲返回 null */
async function allocateRandomDomain(hostPort: number): Promise<string | null> {
  const pool = loadRandomDomains()
  if (pool.length === 0) return null
  // 找出已分配的,从映射到该实例端口的域名里随机取一个未用的
  const usedRows = await db.select({ randSubdomain: instances.randSubdomain }).from(instances).all()
  const used = new Set(usedRows.map((r) => r.randSubdomain).filter(Boolean))
  const candidates = pool
    .map((d, i) => ({ d, port: 3101 + (i % 12) }))
    .filter(({ d, port }) => port === hostPort && !used.has(d))
    .map((x) => x.d)
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/** 按实例所在主机选择 docker 执行器。 */
function dockerFor(slot: Instance): (args: string[], opts?: { timeout?: number }) => Promise<{ stdout: string }> {
  return slot.host === 'nas' ? runDockerOnNas : runDocker
}

/** 启动容器(安全加固版):
 *  - bridge 网络:容器间/到宿主隔离;本地映射 127.0.0.1:310N,NAS 映射 100.76.91.96:410N(socat 端口)
 *  - 非 root(node) + cap-drop ALL + no-new-privileges + 只读根 + pids 限制
 *  - 容器内 entrypoint 起 socat 把 eth0:PORT 转发到 127.0.0.1:PORT(dsh 拒绝绑 0.0.0.0)
 *  - volume 挂 /home/node/.dsh(node 用户 DSH_HOME) */
export async function dockerStart(slot: Instance): Promise<void> {
  const volume = `${slot.containerName}-data`
  const exposedPort = slot.host === 'nas' ? socatPort(slot) : slot.hostPort
  const bindHost = slot.host === 'nas' ? NAS_HOST : '127.0.0.1'
  // 内存:NAS 实例 300m(内存充裕,留足插件安装);服务器本地 200m(受宿主机总量限制)
  const memLimit = slot.host === 'nas' ? '300m' : '200m'
  const args = [
    'run', '-d',
    '--name', slot.containerName,
    '--network', 'bridge',
    '-p', `${bindHost}:${exposedPort}:${slot.hostPort}`,
    `--memory=${memLimit}`,
    '--pids-limit=256',
    '--cap-drop=ALL',
    '--cap-add', 'SETUID',
    '--cap-add', 'SETGID',
    '--cap-add', 'CHOWN',
    '--cap-add', 'DAC_OVERRIDE',
    '--security-opt', 'no-new-privileges',
    '--read-only',
    '--tmpfs', '/tmp',
    '--restart=unless-stopped',
    '-e', `DSH_PORT=${slot.hostPort}`,
    '-e', `DSH_TRUSTED_HOST=${slot.randSubdomain ?? slot.subdomain}`,
    '-v', `${volume}:/home/node/.dsh`,
    '-v', `${slot.containerName}-cache:/home/node/.cache`,
    IMAGE,
  ]

  if (slot.host === 'nas') {
    // NAS:经 tailnet ssh 执行(与本地同参数)
    const dockerCmd = args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')
    await runOnNas(`docker ${dockerCmd}`).catch((e) => {
      throw new Error(`NAS 实例启动失败:${String(e?.message ?? e).slice(0, 200)}`)
    })
    return
  }

  await runDocker(args)
}

export async function dockerStop(slot: Instance): Promise<void> {
  const docker = dockerFor(slot)
  // 忽略不存在容器的报错
  await docker(['stop', '-t', '3', slot.containerName]).catch(() => {})
  await docker(['rm', slot.containerName]).catch(() => {})
  await docker(['volume', 'rm', `${slot.containerName}-data`]).catch(() => {})
  await docker(['volume', 'rm', `${slot.containerName}-cache`]).catch(() => {})
}

/** 重启容器(保留容器与数据卷)。 */
export async function dockerRestart(slot: Instance): Promise<void> {
  const docker = dockerFor(slot)
  await docker(['restart', slot.containerName])
}

/** 等待容器端口上的 dsh web 就绪(轮询到 HTTP 200,最长约 25s)。 */
export async function waitReady(slot: Instance): Promise<boolean> {
  const deadline = Date.now() + 25000
  while (Date.now() < deadline) {
    if (await probeReady(slot)) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

/** 单次探测容器端口上的 dsh web 是否已就绪(短超时,给轮询接口用)。 */
export async function probeReady(slot: Instance): Promise<boolean> {
  try {
    // NAS 实例暴露在 socat 端口(hostPort+1000),本地实例直接 hostPort
    const exposed = slot.host === 'nas' ? socatPort(slot) : slot.hostPort
    const base = slot.host === 'nas' ? `http://${NAS_HOST}:${exposed}` : `http://127.0.0.1:${exposed}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${base}/`, { signal: controller.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

export async function dockerStatus(slot: Instance): Promise<string> {
  const docker = dockerFor(slot)
  try {
    const { stdout } = await docker(['inspect', '--format', '{{.State.Status}}', slot.containerName])
    return stdout.trim()
  } catch {
    return 'missing'
  }
}

/** 领取:抢一台空闲槽并启动容器。返回该实例。
 *  释放后的实例有 5 分钟冷却(availableAt),避免刚释放就被原用户立刻领回。 */
const RELEASE_COOLDOWN_MS = 5 * 60 * 1000

export async function claimInstance(userId: string): Promise<Instance> {
  const mine = await db
    .select()
    .from(instances)
    .where(eq(instances.userId, userId))
    .get()
  if (mine) throw new Error('你已领取过一台托管 dsh')

  const now = new Date()
  const free = await db
    .select()
    .from(instances)
    .where(
      and(
        eq(instances.status, 'available'),
        // 可领:未设置冷却(availableAt 为 null)或冷却已过
        or(isNull(instances.availableAt), lt(instances.availableAt, now)),
      ),
    )
    .orderBy(instances.availableAt)
    .limit(1)
    .get()
  if (!free) throw new Error('当前无空闲实例,稍后再试')

  // NAS 实例 docker run 较慢(~16s+),先标记领取再后台启动,让点击立即有响应
  const isNas = free.host === 'nas'
  const randSub = await allocateRandomDomain(free.hostPort)
  await db
    .update(instances)
    .set({
      userId,
      status: 'claimed',
      claimedAt: now,
      expiresAt: new Date(now.getTime() + INSTANCE_TTL_DAYS * 86400000),
      availableAt: null,
      randSubdomain: randSub,
      updatedAt: now,
    })
    .where(eq(instances.id, free.id))

  // 用随机域名作为实例对外地址(容器 trusted-host + 前端显示)
  const claimedSlot = { ...free, randSubdomain: randSub }

  if (isNas) {
    // 后台异步启动,不阻塞领取响应;前端轮询 httpReady 显示进度
    dockerStart(claimedSlot).catch((e) => {
      // 启动失败:回滚为 available,让用户能重试
      console.error(`[claim] NAS 实例 ${free.slot} 启动失败,回滚:`, e)
      db.update(instances)
        .set({ userId: null, status: 'available', claimedAt: null, expiresAt: null, randSubdomain: null, updatedAt: new Date() })
        .where(eq(instances.id, free.id))
        .catch(() => {})
    })
  } else {
    await dockerStart(claimedSlot)
  }

  return (await db.select().from(instances).where(eq(instances.id, free.id)).get())!
}

/** 释放:本人可释放;停止容器、清数据、回池(带 5 分钟冷却,防止立刻被同一用户领回)。 */
export async function releaseInstance(userId: string, id: string): Promise<void> {
  const slot = await db.select().from(instances).where(eq(instances.id, id)).get()
  if (!slot) throw new Error('实例不存在')
  if (slot.userId !== userId) throw new Error('只能释放自己领取的实例')
  await dockerStop(slot)
  const now = new Date()
  await db
    .update(instances)
    .set({
      userId: null,
      status: 'available',
      claimedAt: null,
      expiresAt: null,
      randSubdomain: null,
      availableAt: new Date(now.getTime() + RELEASE_COOLDOWN_MS),
      updatedAt: now,
    })
    .where(eq(instances.id, id))
}

/** 重启:本人可操作;重启容器,数据卷保留。 */
export async function restartInstance(userId: string, id: string): Promise<void> {
  const slot = await db.select().from(instances).where(eq(instances.id, id)).get()
  if (!slot) throw new Error('实例不存在')
  if (slot.userId !== userId) throw new Error('只能操作自己领取的实例')
  await dockerRestart(slot)
}

/** 升级:本人可操作;重建镜像 + 保留数据卷重建容器(容器没跑则直接拉起)。
 *  NAS 实例在 NAS 上构建镜像(同源码目录经 tailnet 挂载/拷贝),构建可能较慢。 */
export async function upgradeInstance(userId: string, id: string): Promise<void> {
  const slot = await db.select().from(instances).where(eq(instances.id, id)).get()
  if (!slot) throw new Error('实例不存在')
  if (slot.userId !== userId) throw new Error('只能操作自己领取的实例')

  const docker = dockerFor(slot)
  if (slot.host === 'nas') {
    // NAS 上没有构建源码,改用 NAS 上已有的最新镜像(或由管理员手动构建)
    await docker(['stop', '-t', '3', slot.containerName]).catch(() => {})
    await docker(['rm', slot.containerName]).catch(() => {})
    await dockerStart(slot)
    return
  }

  const buildDir = process.env.DSH_HARNESS_BUILD_DIR || '/www/wwwroot/cbnac.com/dsh-harness'
  // 镜像构建可能超过默认 60s,单独放宽
  await run('docker', ['build', '-t', IMAGE, buildDir], { timeout: 300000 }).catch((e) => {
    throw new Error(`镜像构建失败:${String(e?.message ?? e).slice(0, 200)}`)
  })
  // 保留数据卷:只停+删容器,不动 volume,再用新镜像拉起
  await docker(['stop', '-t', '3', slot.containerName]).catch(() => {})
  await docker(['rm', slot.containerName]).catch(() => {})
  await dockerStart(slot)
}

/** 在指定实例容器内安装插件(经 docker exec;只允许安装本站商店白名单插件)。
 *  tarballUrl 必须是本站域名(防任意源),调用方负责白名单校验。 */
export async function installPluginInInstance(userId: string, id: string, tarballUrl: string): Promise<string> {
  const slot = await db.select().from(instances).where(eq(instances.id, id)).get()
  if (!slot) throw new Error('实例不存在')
  if (slot.userId !== userId) throw new Error('只能操作自己领取的实例')
  if (slot.status !== 'claimed') throw new Error('实例未在运行')

  // 只允许本站分发的 tarball
  const allowed = /^https:\/\/dsh\.cbnac\.com\/api\/plugins\/[a-z0-9-]+\/tarball$/.test(tarballUrl)
  if (!allowed) throw new Error('仅支持安装本站商店插件')

  const docker = dockerFor(slot)
  // 以 node 用户执行;profile 内 .npmrc 已配 store-dir + ignore-workspace-root-check(镜像预置)
  // pnpm add 装依赖 + dsh-add-bundle.js 把包名加入 dsh.profile.bundles
  const installCmd =
    `su -s /bin/bash node -c "cd /home/node/.dsh/profiles/web && ` +
    `pnpm add '${tarballUrl}' && node /usr/local/bin/dsh-add-bundle.js /home/node/.dsh/profiles/web"`
  const { stdout } = (await docker(
    ['exec', slot.containerName, 'sh', '-c', installCmd],
    { timeout: 300000 },
  ).catch((e) => {
    throw new Error(`插件安装失败:${String(e?.message ?? e).slice(0, 200)}`)
  })) as unknown as { stdout: string }
  return stdout
}

/** 续期(每次 +7 天)。 */
export async function renewInstance(userId: string, id: string): Promise<Instance> {
  const slot = await db.select().from(instances).where(eq(instances.id, id)).get()
  if (!slot) throw new Error('实例不存在')
  if (slot.userId !== userId) throw new Error('只能续期自己领取的实例')
  const base = slot.expiresAt && new Date(slot.expiresAt).getTime() > Date.now() ? new Date(slot.expiresAt) : new Date()
  const next = new Date(base.getTime() + INSTANCE_TTL_DAYS * 86400000)
  await db
    .update(instances)
    .set({ expiresAt: next, status: 'claimed', updatedAt: new Date() })
    .where(eq(instances.id, id))
  return (await db.select().from(instances).where(eq(instances.id, id)).get())!
}

/** 过期扫描:停容器、清数据、回池。 */
export async function sweepExpiredInstances(): Promise<number> {
  const now = new Date()
  const expired = await db
    .select()
    .from(instances)
    .where(and(eq(instances.status, 'claimed'), lt(instances.expiresAt, now)))
    .all()
  for (const slot of expired) {
    await dockerStop(slot).catch(() => {})
    await db
      .update(instances)
      .set({
        userId: null,
        status: 'available',
        claimedAt: null,
        expiresAt: null,
        availableAt: new Date(now.getTime() + RELEASE_COOLDOWN_MS),
        updatedAt: now,
      })
      .where(eq(instances.id, slot.id))
  }
  return expired.length
}
