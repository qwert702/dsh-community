import type { Metadata } from 'next'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: '登录',
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="rounded-2xl border border-ink-800 bg-ink-900 p-8">
        <h1 className="text-2xl font-bold text-white">登录</h1>
        <p className="mt-2 text-sm text-slate-400">登录后可提交插件、远程管理设备。</p>
        <LoginForm />
      </div>
    </div>
  )
}