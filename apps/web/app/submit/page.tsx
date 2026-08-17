import type { Metadata } from 'next'
import SubmitForm from './SubmitForm'

export const metadata: Metadata = {
  title: '提交插件',
}

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-14">
      <div className="rounded-2xl border border-ink-800 bg-ink-900 p-8">
        <h1 className="text-2xl font-bold text-white">提交插件</h1>
        <p className="mt-2 text-sm text-slate-400">
          想上架到商店的仓库必须满足:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>GitHub 仓库已打上 <code className="text-brand-400">dsh-plugin</code> topic</li>
          <li>
            <code className="text-brand-400">package.json</code> 声明{' '}
            <code className="text-brand-400">dsh.bundle.patch</code>
          </li>
          <li>提交后由管理员审核批准,即可被远程安装</li>
        </ul>
        <SubmitForm />
      </div>
    </div>
  )
}