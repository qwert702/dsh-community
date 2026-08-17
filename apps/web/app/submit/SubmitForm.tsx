'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SubmitForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [repo, setRepo] = useState('') // owner/repo
  const [desc, setDesc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginNeeded, setLoginNeeded] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setOk(false)
    setLoginNeeded(false)
    try {
      const res = await fetch('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, repo, desc }),
      })
      if (res.status === 401) {
        setLoginNeeded(true)
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? '提交失败')
        return
      }
      setOk(true)
      setName('')
      setRepo('')
      setDesc('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {loginNeeded && (
        <p className="text-sm text-amber-400">
          请先<a href="/login" className="underline">登录</a>后再提交插件
        </p>
      )}
      <div>
        <label className="text-sm text-slate-300">插件名</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="text-sm text-slate-300">
          GitHub 仓库 <span className="text-slate-500">(owner/repo)</span>
        </label>
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="e.g. deepseek-ai/dsh-link-plugin"
          className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="text-sm text-slate-300">描述</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {ok && (
        <p className="text-sm text-accent-400">✓ 已提交,等待管理员审核。</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-500 px-4 py-2.5 font-medium text-ink-950 hover:bg-brand-400 disabled:opacity-60"
      >
        {loading ? '提交中…' : '提交审核'}
      </button>
    </form>
  )
}