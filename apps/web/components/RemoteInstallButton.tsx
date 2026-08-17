'use client'

import { useState } from 'react'

export default function RemoteInstallButton({
  spec,
  name,
}: {
  spec: string
  name: string
}) {
  const [state, setState] = useState<
    'idle' | 'login' | 'no-device' | 'installing' | 'done' | 'error'
  >('idle')
  const [msg, setMsg] = useState('')

  async function install(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (state === 'installing') return
    setState('installing')
    setMsg('')
    try {
      const devRes = await fetch('/api/devices')
      if (devRes.status === 401) {
        setState('login')
        return
      }
      const devData = await devRes.json().catch(() => null)
      const online = (devData?.devices ?? []).filter((d: any) => d.status === 'online')
      if (online.length === 0) {
        setState('no-device')
        return
      }
      const deviceId = online[0].id
      const res = await fetch(`/api/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', spec }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setState('error')
        setMsg(data?.error || '安装失败')
        return
      }
      setState('done')
    } catch {
      setState('error')
      setMsg('网络错误')
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={install}
        disabled={state === 'installing'}
        className={`w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          state === 'done'
            ? 'bg-accent-500/15 text-accent-400'
            : 'bg-brand-500/15 text-brand-400 hover:bg-brand-500 hover:text-ink-950'
        } disabled:opacity-50`}
      >
        {state === 'installing'
          ? '安装中…'
          : state === 'done'
            ? '✓ 已下发安装'
            : '远程安装'}
      </button>
      {state === 'login' && (
        <p className="mt-1 text-center text-[11px] text-amber-400">
          请先<a href="/login" className="underline">登录</a>再远程安装
        </p>
      )}
      {state === 'no-device' && (
        <p className="mt-1 text-center text-[11px] text-slate-500">
          无在线设备,请先在<a href="/console" className="text-brand-400 underline">控制台</a>配对
        </p>
      )}
      {state === 'error' && msg && (
        <p className="mt-1 text-center text-[11px] text-red-400">{msg}</p>
      )}
    </div>
  )
}