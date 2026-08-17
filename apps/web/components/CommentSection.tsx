'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface CommentItem {
  id: string
  userName: string
  body: string
  createdAt: string
  parentId: string | null
}

export default function CommentSection({
  pluginSlug,
  comments,
}: {
  pluginSlug: string
  comments: CommentItem[]
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginNeeded, setLoginNeeded] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError(null)
    setLoginNeeded(false)
    try {
      const res = await fetch(`/api/plugins/${pluginSlug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      if (res.status === 401) {
        setLoginNeeded(true)
        return
      }
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? '提交失败')
        return
      }
      setBody('')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const top = comments.filter((c) => !c.parentId)
  const replies = comments.filter((c) => c.parentId)

  return (
    <div>
      <h2 className="text-xl font-semibold text-white">评论 ({top.length})</h2>

      <form onSubmit={submit} className="mt-4">
        {loginNeeded && (
          <p className="mb-2 text-sm text-amber-400">
            请先<a href="/login" className="underline">登录</a>后再评论
          </p>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="分享你的使用体验…"
          className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400 disabled:opacity-50"
          >
            {submitting ? '发布中…' : '发布评论'}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {top.length === 0 && (
          <p className="text-sm text-slate-500">还没有评论,来抢沙发吧。</p>
        )}
        {top.map((c) => (
          <div key={c.id} className="rounded-lg border border-ink-800 bg-ink-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">{c.userName}</span>
              <span className="text-xs text-slate-500">{c.createdAt}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
        {replies.length > 0 && (
          <div className="ml-6 space-y-3">
            {replies.map((c) => (
              <div key={c.id} className="rounded-lg border border-ink-800/60 bg-ink-900/60 p-3">
                <span className="text-sm font-medium text-slate-300">{c.userName}</span>
                <p className="mt-1 text-sm text-slate-400">{c.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}