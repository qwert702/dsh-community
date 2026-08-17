import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import HostingClient from './HostingClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '托管 dsh',
  description: '领取一台托管 dsh,在浏览器里跟正常 dsh 一样使用。',
}

export default async function HostingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold text-white">托管 dsh</h1>
      <p className="mt-2 text-slate-400">
        领取一台托管 dsh 实例,在浏览器里跟正常 dsh 一样使用。每人一台,时长 7 天,可续期。
      </p>
      <HostingClient />
    </div>
  )
}