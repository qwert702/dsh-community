import type { Metadata } from 'next'
import './globals.css'
import Header from '../components/Header'
import Footer from '../components/Footer'

export const metadata: Metadata = {
  title: {
    default: 'dsh 社区 — DeepSeek Harness 开源插件市场',
    template: '%s · dsh 社区',
  },
  description:
    'dsh (DeepSeek Harness) 开源社区与插件商店。浏览、安装、远程管理您的 dsh 插件。',
  keywords: ['dsh', 'DeepSeek', 'harness', 'Cordis', '插件', 'plugin'],
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🧩</text></svg>',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}