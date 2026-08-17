'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface InstRow {
  id: string
  slot: string
  subdomain: string
  status: 'available' | 'claimed' | 'expired'
  claimedAt: string | Date | null
  expiresAt: string | Date | null
  containerStatus: string
  httpReady: boolean
  mine: boolean
}

const DAY = 86400000
/** 启动进度条预算,与后端 waitReady 的 25s 对齐 */
const READY_BUDGET = 25000

/** 容器在跑且端口上的 dsh web 返回 200 才算真正可用 */
function isReady(r: InstRow) {
  return r.containerStatus === 'running' && r.httpReady
}

export default function HostingClient() {
  const router = useRouter()
  const [rows, setRows] = useState<InstRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketFor, setTicketFor] = useState<string | null>(null)
  const [ticketMsg, setTicketMsg] = useState('')
  const [ticketSent, setTicketSent] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/instances')
    if (res.status === 401) {
      router.push('/login')
      return
    }
    const data = await res.json().catch(() => null)
    setRows(data?.instances ?? [])
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function claim() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/instances', { method: 'POST' })
    const data = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) {
      setError(data?.error ?? '领取失败')
      return
    }
    await load()
  }

  async function act(id: string, action: 'release' | 'renew' | 'restart' | 'upgrade') {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/instances/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) setError(data?.error ?? '操作失败')
    await load()
  }

  async function submitTicket(id: string) {
    const msg = ticketMsg.trim()
    if (!msg) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/instances/${id}/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    })
    const data = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) {
      setError(data?.error ?? '提交失败')
      return
    }
    setTicketSent(true)
    setTicketMsg('')
  }

  const now = Date.now()
  const available = rows.filter((r) => r.status === 'available')
  const mine = rows.filter((r) => r.mine)
  // 有实例还在启动就 2s 快速轮询,否则 30s 常规轮询
  const fastPoll = mine.some((r) => !isReady(r))
  useEffect(() => {
    const t = setInterval(load, fastPoll ? 2000 : 30000)
    return () => clearInterval(t)
  }, [load, fastPoll])

  return (
    <div className="mt-8 space-y-8">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* 我的实例 */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
          我的托管实例
          <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-400">{mine.length}</span>
        </h2>
        {mine.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-slate-500">
            你还没有领取托管实例。点下方空闲槽的「领取」。
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {mine.map((r) => {
              const exp = r.expiresAt ? new Date(r.expiresAt).getTime() : 0
              const remain = Math.max(0, exp - now)
              const days = Math.floor(remain / DAY)
              const hours = Math.floor((remain % DAY) / 3600000)
              const ready = isReady(r)
              const startedAt = r.claimedAt ? new Date(r.claimedAt).getTime() : now
              const elapsed = Math.max(0, now - startedAt)
              const pct = ready ? 100 : Math.min(96, Math.round((elapsed / READY_BUDGET) * 100))
              return (
                <div key={r.id} className="rounded-xl border border-brand-500/40 bg-brand-500/5">
                  <div className="flex">
                    {/* 左侧状态栏 */}
                    <div className="flex w-28 shrink-0 flex-col items-stretch gap-2 border-r border-brand-500/20 p-3">
                      <span className="text-center text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        实例控制
                      </span>
                      <button
                        onClick={() => act(r.id, 'restart')}
                        disabled={busy}
                        className="rounded-lg border border-ink-700 px-2 py-1.5 text-xs text-slate-200 hover:border-brand-500 hover:text-brand-400 disabled:opacity-50"
                      >
                        重启 dsh
                      </button>
                      <button
                        onClick={() => act(r.id, 'upgrade')}
                        disabled={busy}
                        title="重建镜像并以最新版本重建容器,保留数据,约需 1 分钟"
                        className="rounded-lg border border-ink-700 px-2 py-1.5 text-xs text-slate-200 hover:border-brand-500 hover:text-brand-400 disabled:opacity-50"
                      >
                        升级 dsh
                      </button>
                      <button
                        onClick={() => {
                          setTicketFor(ticketFor === r.id ? null : r.id)
                          setTicketSent(false)
                          setTicketMsg('')
                        }}
                        disabled={busy}
                        className="rounded-lg border border-amber-500/40 px-2 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        联系解决
                      </button>
                    </div>
                    {/* 右侧主体 */}
                    <div className="flex-1 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-medium text-white">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            ready ? 'bg-accent-400' : 'animate-pulse bg-amber-400'
                          }`}
                        />
                        {'我的 dsh 实例'}
                        {ready ? (
                          <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-xs text-accent-400">
                            运行中
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
                            启动中
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        剩余 {days} 天 {hours} 小时
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {ready ? (
                        <a
                          href={`https://${r.subdomain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400"
                        >
                          打开使用 ↗
                        </a>
                      ) : (
                        <button
                          disabled
                          className="cursor-wait rounded-lg bg-brand-500/50 px-4 py-2 text-sm font-medium text-ink-950"
                        >
                          启动中…
                        </button>
                      )}
                      <button
                        onClick={() => act(r.id, 'renew')}
                        disabled={busy}
                        className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-slate-200 hover:border-brand-500 hover:text-brand-400 disabled:opacity-50"
                      >
                        续期
                      </button>
                      <button
                        onClick={() => act(r.id, 'release')}
                        disabled={busy}
                        className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        释放
                      </button>
                    </div>
                  </div>
                  {!ready && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{r.containerStatus === 'running' ? 'dsh 服务启动中…' : '容器创建中…'}</span>
                        <span>
                          {elapsed >= 40000
                            ? '启动较慢,可稍候片刻;长时间未就绪可释放后重试'
                            : `已等待 ${Math.floor(elapsed / 1000)} 秒`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                    </div>
                  </div>
                  {ticketFor === r.id && (
                    <div className="border-t border-brand-500/20 p-4">
                      {ticketSent ? (
                        <p className="text-sm text-accent-400">
                          已提交,管理员会尽快处理。也可以先在右侧重试「重启 dsh」。
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          <textarea
                            value={ticketMsg}
                            onChange={(e) => setTicketMsg(e.target.value)}
                            rows={2}
                            maxLength={2000}
                            placeholder="描述你遇到的问题(如:打开后页面报错、接口 403、加载慢…)管理员会在后台看到并处理。"
                            className="flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
                          />
                          <button
                            onClick={() => submitTicket(r.id)}
                            disabled={busy || !ticketMsg.trim()}
                            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-amber-400 disabled:opacity-50"
                          >
                            提交
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 空闲池 */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-200">
          空闲实例
          <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs text-slate-400">
            {available.length}/3
          </span>
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border p-5 ${
                r.status === 'available'
                  ? 'border-ink-800 bg-ink-900'
                  : r.mine
                    ? 'border-brand-500/40 bg-ink-900'
                    : 'border-ink-800/60 bg-ink-900/50 opacity-60'
              }`}
            >
              <p className="font-mono text-sm font-semibold text-white">
                {r.status === 'available' ? '空闲实例' : 'dsh 实例'}
              </p>
              <div className="mt-3">
                {r.status === 'available' ? (
                  <button
                    onClick={claim}
                    disabled={busy}
                    className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400 disabled:opacity-50"
                  >
                    {busy ? '处理中…' : '领取'}
                  </button>
                ) : r.mine ? (
                  <span className="text-xs text-brand-400">已领取(上方)</span>
                ) : (
                  <span className="text-xs text-slate-600">已被他人领取</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          领取后 7 天内有效,可续期;释放或到期后实例停止、数据清空,回到池中。
        </p>
      </section>
    </div>
  )
}