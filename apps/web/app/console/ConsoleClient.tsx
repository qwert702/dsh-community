'use client'

import { useEffect, useRef, useState } from 'react'

interface Device {
  id: string
  name: string
  profileName: string
  platform: string | null
  dshVersion: string | null
  status: 'online' | 'offline'
  installedJson: unknown
  lastSeenAt: string | number | Date | null
  updatedAt: string | number | Date | null
}

interface Installable {
  slug: string
  name: string
  desc: string
  spec: string
}

interface Cmd {
  id: string
  action: string
  spec: string | null
  status: string
}

export default function ConsoleClient({
  devices,
  installable,
}: {
  devices: Device[]
  installable: Installable[]
}) {
  const [pairCode, setPairCode] = useState<string | null>(null)
  const [pairExp, setPairExp] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)
  const [live, setLive] = useState<Record<string, Cmd[]>>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function genPairing() {
    setPairing(true)
    try {
      const res = await fetch('/api/devices', { method: 'POST' })
      const data = await res.json()
      setPairCode(data.pairingCode ?? null)
      setPairExp(data.expiresAt ? new Date(data.expiresAt).toLocaleTimeString('zh-CN') : null)
    } finally {
      setPairing(false)
    }
  }

  // 轮询在线设备的指令进度
  useEffect(() => {
    const online = devices.filter((d) => d.status === 'online')
    if (online.length === 0) return
    async function tick() {
      const next: Record<string, Cmd[]> = {}
      for (const d of online) {
        try {
          const res = await fetch(`/api/devices/${d.id}`)
          const data = await res.json()
          next[d.id] = data.commands ?? []
        } catch {
          /* ignore */
        }
      }
      setLive(next)
    }
    tick()
    pollRef.current = setInterval(tick, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [devices])

  async function runCommand(deviceId: string, action: string, spec?: string) {
    const res = await fetch(`/api/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, spec }),
    })
    const data = await res.json()
    if (!res.ok) alert(data.error ?? '指令失败')
  }

  return (
    <div className="mt-8 space-y-8">
      {/* 配对区 */}
      <section className="rounded-2xl border border-ink-800 bg-ink-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">① 配对设备</h2>
            <p className="mt-1 text-sm text-slate-400">
              生成配对码,在本机 dsh Web UI 的 dsh-link 设置里填入。
            </p>
          </div>
          <button
            onClick={genPairing}
            disabled={pairing}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400 disabled:opacity-50"
          >
            {pairing ? '生成中…' : '生成配对码'}
          </button>
        </div>
        {pairCode && (
          <div className="mt-4 rounded-lg border border-brand-500/30 bg-brand-500/10 p-4 text-center">
            <p className="text-xs text-slate-400">配对码(15 分钟内有效,一次性)</p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em] text-brand-400">
              {pairCode}
            </p>
            {pairExp && <p className="mt-2 text-xs text-slate-500">到期: {pairExp}</p>}
          </div>
        )}
      </section>

      {/* 设备列表 */}
      <section>
        <h2 className="font-semibold text-white">② 我的设备</h2>
        {devices.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-ink-700 p-10 text-center text-sm text-slate-500">
            暂无设备。生成配对码并配置 dsh-link-plugin 后,这里会显示你的设备。
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((d) => {
              const cmds = live[d.id] ?? []
              const last = cmds[cmds.length - 1]
              return (
                <div key={d.id} className="rounded-xl border border-ink-800 bg-ink-900 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-medium text-white">
                      <span
                        className={`h-2 w-2 rounded-full ${d.status === 'online' ? 'bg-accent-400' : 'bg-slate-600'}`}
                      />
                      {d.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        d.status === 'online'
                          ? 'bg-accent-500/15 text-accent-400'
                          : 'bg-slate-500/15 text-slate-500'
                      }`}
                    >
                      {d.status === 'online' ? '在线' : '离线'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    profile: {d.profileName}
                    {d.platform && ` · ${d.platform}`}
                    {d.dshVersion && ` · dsh ${d.dshVersion}`}
                  </p>

                  {/* 已装插件 */}
                  {Array.isArray(d.installedJson) && (d.installedJson as string[]).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-400">已安装</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(d.installedJson as string[]).slice(0, 6).map((p) => (
                          <span
                            key={p}
                            className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                          >
                            {p}
                          </span>
                        ))}
                        {(d.installedJson as string[]).length > 6 && (
                          <span className="text-[10px] text-slate-500">
                            +{(d.installedJson as string[]).length - 6}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 最新指令状态 */}
                  {last && (
                    <div className="mt-3 rounded bg-ink-950/60 px-2 py-1.5 text-[10px] text-slate-400">
                      <span className="text-slate-500">上次:</span> {last.action}
                      {last.spec ? ` ${last.spec}` : ''} ·{' '}
                      <StatusChip status={last.status} />
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="mt-4 flex gap-2">
                    {d.status === 'online' && (
                      <>
                        <button
                          onClick={() => runCommand(d.id, 'list')}
                          className="rounded-md border border-ink-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-brand-500 hover:text-brand-400"
                        >
                          刷新列表
                        </button>
                        <a
                          href="/plugins"
                          className="rounded-md bg-brand-500/15 px-2.5 py-1.5 text-xs text-brand-400 hover:bg-brand-500 hover:text-ink-950"
                        >
                          去商店安装 →
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 安装指引 */}
      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
        <h2 className="font-semibold text-white">还没装 dsh-link-plugin?</h2>
        <p className="mt-2 text-sm text-slate-400">
          在服务器文档里查看{' '}
          <a href="/docs/link" className="text-brand-400 hover:underline">
            远程连接配置
          </a>{' '}
          步骤:安装插件 → 填 serverUrl 与配对码 → 回到这里。
        </p>
      </section>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const color: Record<string, string> = {
    queued: 'text-slate-500',
    sent: 'text-brand-400',
    running: 'text-amber-400',
    done: 'text-accent-400',
    failed: 'text-red-400',
    timeout: 'text-red-400',
  }
  return <span className={color[status] ?? 'text-slate-400'}>{status}</span>
}