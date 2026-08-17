'use client'

import { useState } from 'react'

export default function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 某些浏览器(如无用户手势)会拒绝;回退到 select
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 rounded-md border border-ink-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-brand-500 hover:text-brand-400"
    >
      {copied ? '✓ 已复制' : label}
    </button>
  )
}