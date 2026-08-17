'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function RegisterForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? '注册失败')
        return
      }
      // 注册成功后自动登录
      await signIn('credentials', { username, password, redirect: false })
      router.push('/console')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="text-sm text-slate-300">用户名</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="text-sm text-slate-300">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="text-sm text-slate-300">密码(至少 8 位)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          required
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent-500 px-4 py-2.5 font-medium text-ink-950 hover:bg-accent-400 disabled:opacity-60"
      >
        {loading ? '创建中…' : '创建账号'}
      </button>
      <p className="text-center text-sm text-slate-500">
        已有账号?{' '}
        <a href="/login" className="text-brand-400 hover:underline">
          去登录
        </a>
      </p>
    </form>
  )
}