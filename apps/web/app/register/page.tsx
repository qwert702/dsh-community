import type { Metadata } from 'next'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = {
  title: '注册',
}

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="rounded-2xl border border-ink-800 bg-ink-900 p-8">
        <h1 className="text-2xl font-bold text-white">创建账号</h1>
        <p className="mt-2 text-sm text-slate-400">加入 dsh 社区,提交插件并远程管理设备。</p>
        <RegisterForm />
      </div>
    </div>
  )
}