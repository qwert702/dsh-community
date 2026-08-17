'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function logout() {
    await signOut({ redirect: false })
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={logout}
      className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
    >
      退出
    </button>
  )
}