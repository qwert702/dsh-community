// PM2 进程配置 —— dsh 社区(dsh.cbnac.com)
// dsh-ws  : WS 网关 127.0.0.1:3001
// dsh-web : Next.js 127.0.0.1:3002
//
// 密钥从环境变量读取(不写死在仓库):部署时 export 或在 .env.local 里配置,
// 参考 scripts/.env.local.example。服务器上的实际配置在
// /www/wwwroot/cbnac.com/ecosystem.config.cjs(不入库)。
module.exports = {
  apps: [
    {
      name: 'dsh-ws',
      cwd: '/www/wwwroot/cbnac.com/ws-gateway',
      script: 'server.mjs',
      interpreter: 'node',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        HOST: '127.0.0.1',
        WS_GATEWAY_KEY: process.env.WS_GATEWAY_KEY || '',
        DATABASE_PATH: '/www/wwwroot/cbnac.com/dsh-site/data/dsh.db',
      },
    },
    {
      name: 'dsh-web',
      cwd: '/www/wwwroot/cbnac.com/dsh-site',
      script: 'node_modules/next/dist/bin/next',
      args: ['start', '-p', '3002'],
      interpreter: 'node',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
        AUTH_URL: 'https://dsh.cbnac.com',
        AUTH_TRUSTED_HOSTS: 'dsh.cbnac.com,localhost,127.0.0.1',
        DATABASE_PATH: '/www/wwwroot/cbnac.com/dsh-site/data/dsh.db',
        AUTH_SECRET: process.env.AUTH_SECRET || '',
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
        DSH_REGISTRY_HMAC: process.env.DSH_REGISTRY_HMAC || '',
        WS_GATEWAY_URL: 'http://127.0.0.1:3001',
        WS_GATEWAY_KEY: process.env.WS_GATEWAY_KEY || '',
        SYNC_KEY: process.env.SYNC_KEY || '',
      },
    },
  ],
}
