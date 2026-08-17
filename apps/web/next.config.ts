import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  serverExternalPackages: ['@libsql/client'],
  // libsql 的 native 二进制在 standalone 下需要显式打包
  webpack: (config) => {
    config.externals = [...(config.externals || []), '@libsql/client']
    return config
  },
}

export default nextConfig
