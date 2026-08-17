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

/** 按实例所在主机选择 docker 执行器。 */
function dockerFor(slot: Instance): (args: string[], opts?: { timeout?: number }) => Promise<{ stdout: string }> {
  return slot.host === 'nas' ? runDockerOnNas : runDocker
}

/** 启动容器(host 网络 + DSH_PORT 指定端口)。
 *  服务器本地实例绑 127.0.0.1(nginx 同机转发);NAS 实例绑 127.0.0.1 + socat 转发 410N 暴露给服务器 nginx。 */
export async function dockerStart(slot: Instance): Promise<void> {
  const volume = `${slot.containerName}-data`
  if (slot.host === 'nas') {
    // NAS:一条 ssh 命令里完成 docker run + socat(减少往返,领取响应快)
    const sp = socatPort(slot)
    const unit = `dsh-socat-${slot.containerName}`
    const args = [
      'run', '-d',
      '--name', slot.containerName,
      '--network', 'host',
      '--memory=150m',
      '--restart=unless-stopped',
      '-e', `DSH_PORT=${slot.hostPort}`,
      '-e', `DSH_TRUSTED_HOST=${slot.subdomain}`,
      '-v', `${volume}:/root/.dsh`,
      IMAGE,
    ]
    const dockerCmd = args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')
    const nasCmd = `docker ${dockerCmd} && systemctl stop ${unit} 2>/dev/null; cat > /etc/systemd/system/${unit}.service <<'EOF'
[Unit]
Description=socat forward ${sp} -> 127.0.0.1:${slot.hostPort} for dsh ${slot.slot}
After=docker.service
[Service]
ExecStart=/usr/bin/socat TCP-LISTEN:${sp},fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:${slot.hostPort}
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now ${unit} && systemctl restart ${unit}`
    await runOnNas(nasCmd).catch((e) => {
      throw new Error(`NAS 实例启动失败:${String(e?.message ?? e).slice(0, 200)}`)
    })
    return
  }

  await dockerFor(slot)([
    'run', '-d',
    '--name', slot.containerName,
    '--network', 'host',
    '--memory=150m',
    '--restart=unless-stopped',
    '-e', `DSH_PORT=${slot.hostPort}`,
    '-e', `DSH_TRUSTED_HOST=${slot.subdomain}`,
    '-v', `${volume}:/root/.dsh`,
    IMAGE,
  ])
}

/** NAS 实例:确保 socat 把 0.0.0.0:410N 转发到 127.0.0.1:310N(dsh 拒绝绑非回环)。
 *  用 systemd 用户级托管保证重启后仍在;每次启动幂等。 */
export async function ensureSocat(slot: Instance): Promise<void> {
  const sp = socatPort(slot)
  const unit = `dsh-socat-${slot.containerName}`
  const cmd = `systemctl stop ${unit} 2>/dev/null; cat > /etc/systemd/system/${unit}.service <<EOF
[Unit]
Description=socat forward ${sp} -> 127.0.0.1:${slot.hostPort} for dsh ${slot.slot}
After=docker.service
[Service]
ExecStart=/usr/bin/socat TCP-LISTEN:${sp},fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:${slot.hostPort}
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now ${unit} && systemctl restart ${unit}`
  await runOnNas(cmd).catch((e) => {
    throw new Error(`NAS socat 启动失败:${String(e?.message ?? e).slice(0, 200)}`)
  })
}

export async function dockerStop(slot: Instance): Promise<void> {
  const docker = dockerFor(slot)
  // 忽略不存在容器的报错
  await docker(['stop', '-t', '3', slot.containerName]).catch(() => {})
  await docker(['rm', slot.containerName]).catch(() => {})
  await docker(['volume', 'rm', `${slot.containerName}-data`]).catch(() => {})
  if (slot.host === 'nas') {
    // 清理 socat 转发服务
    await runOnNas(`systemctl stop dsh-socat-${slot.containerName} 2>/dev/null; systemctl disable dsh-socat-${slot.containerName} 2>/dev/null`).catch(() => {})
  }
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
    const base = slot.host === 'nas' ? `http://${NAS_HOST}:${slot.hostPort}` : `http://127.0.0.1:${slot.hostPort}`
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
  await db
    .update(instances)
    .set({
      userId,
      status: 'claimed',
      claimedAt: now,
      expiresAt: new Date(now.getTime() + INSTANCE_TTL_DAYS * 86400000),
      availableAt: null,
      updatedAt: now,
    })
    .where(eq(instances.id, free.id))

  if (isNas) {
    // 后台异步启动,不阻塞领取响应;前端轮询 httpReady 显示进度
    dockerStart(free).catch((e) => {
      // 启动失败:回滚为 available,让用户能重试
      console.error(`[claim] NAS 实例 ${free.slot} 启动失败,回滚:`, e)
      db.update(instances)
        .set({ userId: null, status: 'available', claimedAt: null, expiresAt: null, updatedAt: new Date() })
        .where(eq(instances.id, free.id))
        .catch(() => {})
    })
  } else {
    await dockerStart(free)
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
