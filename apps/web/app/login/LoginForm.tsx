'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError('用户名或密码错误')
      return
    }
    router.push('/console')
    router.refresh()
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
        <label className="text-sm text-slate-300">密码</label>
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
        className="w-full rounded-lg bg-brand-500 px-4 py-2.5 font-medium text-ink-950 hover:bg-brand-400 disabled:opacity-60"
      >
        {loading ? '登录中…' : '登录'}
      </button>
      <p className="text-center text-sm text-slate-500">
        没有账号?{' '}
        <a href="/register" className="text-brand-400 hover:underline">
          注册一个
        </a>
      </p>
    </form>
  )
}