'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminActions({
  id,
  status,
  repo,
}: {
  id: string
  status: string
  repo: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function act(action: string) {
    setBusy(true)
    await fetch(`/api/admin/plugins/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {status !== 'approved' && (
        <button
          onClick={() => act('approve')}
          disabled={busy}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-brand-400 disabled:opacity-50"
        >
          ✓ 批准
        </button>
      )}
      {status !== 'rejected' && (
        <button
          onClick={() => act('reject')}
          disabled={busy}
          className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          ✕ 拒绝
        </button>
      )}
      {repo && (
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-400 hover:text-brand-400"
        >
          GitHub ↗
        </a>
      )}
    </div>
  )
}