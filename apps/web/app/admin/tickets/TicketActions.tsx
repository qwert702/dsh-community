'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TicketActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function act(action: string) {
    setBusy(true)
    await fetch(`/api/admin/tickets/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== 'resolved' ? (
        <button
          onClick={() => act('resolve')}
          disabled={busy}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-brand-400 disabled:opacity-50"
        >
          ✓ 标记已解决
        </button>
      ) : (
        <button
          onClick={() => act('reopen')}
          disabled={busy}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 hover:border-brand-500 hover:text-brand-400 disabled:opacity-50"
        >
          重新打开
        </button>
      )}
    </div>
  )
}
