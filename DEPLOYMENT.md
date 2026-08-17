# dsh 社区部署手册(dsh.cbnac.com)

本机运行 DeepSeek Harness (dsh) 的用户,通过 **dsh-link-plugin** 连接本社区网站,可在浏览器远程安装插件。

## 生产架构(腾讯云 47.98.207.149)

```
用户浏览器 → https://dsh.cbnac.com (nginx 443)
   ├─ /      → 127.0.0.1:3002  (dsh-web · Next.js 15)
   ├─ /ws    → 127.0.0.1:3001  (dsh-ws · WebSocket 网关, wss 经 nginx TLS)
   └─ /_next/static → 127.0.0.1:3002
用户本机 dsh harness ──wss://dsh.cbnac.com/ws/harness──► 网关
```

- 主站 cbnac.com / blog.cbnac.com 均不动,由 nginx 按 `server_name` 分流。
- PM2 进程:`cbnac`(旧站,3000)、`dsh-ws`(3001)、`dsh-web`(3002)。
- 站点目录:`/www/wwwroot/cbnac.com/dsh-site/`、`/www/wwwroot/cbnac.com/ws-gateway/`。
- nginx 配置:`/etc/nginx/conf.d/dsh.cbnac.com.conf`(独立 server 块)。

## 数据库

- SQLite:`/www/wwwroot/cbnac.com/dsh-site/data/dsh.db`(WAL)。
- 表:users / plugins / comments / devices / pairing_codes / commands。
- 种子数据由本机 `scripts/make-seed.mjs` 从开发库导出(含 30 个已批准插件),`scp` 到服务器替换。
- 建表脚本:`scripts/server-db-init.mjs`。

> ⚠️ 服务器(GFW 内网)无法直接访问 api.github.com,`/api/plugins/sync` 在服务器上会超时。
> 插件索引的更新方式:在本机跑 `npx tsx scripts/sync-cli.ts` 刷新本库,再导出种子上传。
> 后续可给服务器配代理后启用 30 分钟 cron:`curl -X POST -H "x-sync-key: <SYNC_KEY>" https://dsh.cbnac.com/api/plugins/sync`。

## 管理员

首屏无预置用户。注册后在本机把目标账号提升为管理员(服务器上):

```bash
cd /www/wwwroot/cbnac.com/dsh-site/data
node -e "const {createClient}=require('@libsql/client');const c=createClient({url:'file:dsh.db'});c.executeSync?null:null" 2>/dev/null
```
或直接改(用站点的 libsql):
```bash
cd /www/wwwroot/cbnac.com/dsh-site
node --input-type=module -e "
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:/www/wwwroot/cbnac.com/dsh-site/data/dsh.db' });
await c.execute(\"UPDATE users SET role='admin' WHERE username='<你的用户名>'\");
console.log('promoted'); process.exit(0);
"
```

然后访问 `https://dsh.cbnac.com/admin/plugins` 审核插件。

## 部署/回滚

- 部署包:`scripts/package-web.mjs` 或完整自包含 `deploy-web/`(npm 实装 node_modules)。
- 上传:`scripts/scp-put.sh <本地> root@47.98.207.149:<远程>`。
- 进程: `cd /www/wwwroot/cbnac.com && pm2 start ecosystem.config.cjs && pm2 save`。
- nginx: `nginx -t && nginx -s reload`。
- **回滚**:主站仍是原 3000 进程;只需把 dsh 域名 nginx 移除或改回即可,`pm2 delete dsh-web dsh-ws`。

## 远程连接验证

```bash
# 连接 wss(应能建连)
node -e "const W=require('ws');const s=new W('wss://dsh.cbnac.com/ws/harness');s.on('open',()=>console.log('WSS_OK'))"
```
完整流程:登录 → /console 生成配对码 → 本机 dsh-link-plugin 填入 → 设备上线 → 对已批准插件远程安装 → /console 看进度。

## dsh-link-plugin 开源

- 仓库:`github.com/qwert702/dsh-link-plugin`(需 Contents 写权限 push)。
- 用户安装:`dsh plugin --profile web add "github:qwert702/dsh-link-plugin#main"`。
