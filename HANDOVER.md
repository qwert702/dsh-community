# dsh 开源社区项目 · 交接总结

> 交接时间:2026-08-17
> 项目地址:`D:\CBN-HT\Desktop\AI编程\dsh-community`(本地开发,已含全部源码)
> 线上站点:**https://dsh.cbnac.com**
> 一句话:给 **DeepSeek Harness (dsh)** 做了个开源社区站 —— 插件商店 + 远程连接 + 托管实例。

---

## 一、项目是什么

为 dsh(DeepSeek Harness)搭建的开源社区,包含三个核心能力:

1. **插件商店**:自动同步 GitHub 上 `topic:dsh-plugin` 的仓库,校验后上架,提供一键安装命令、签名注册表。
2. **远程连接(dsh-link-plugin)**:用户本机跑着的 dsh 主动连到网站(WebSocket),在浏览器里就能远程给用户本机安装插件。
3. **托管实例**:网站用 Docker 提供 6 台托管 dsh 实例(2026-08-17 由 3 台扩容),用户可"领取"一台,在浏览器里像正常 dsh 一样用。

主站 cbnac.com(英语学习站)和 blog.cbnac.com(博客)**都未动**,新站跑在子域 dsh.cbnac.com。

---

## 二、已上线并验证的功能

| 功能 | 状态 | 说明 |
|---|---|---|
| 首页/插件商店/插件详情 | ✅ | 30 个已批准插件;搜索、分类、HMAC 签名注册表 `/api/plugins/registry.json` |
| 中文文档(6 篇) | ✅ | 快速上手/安装/远程连接/商店/构建插件/FAQ |
| 注册/登录(Auth.js v5) | ✅ | 登录后顶栏显示用户名+退出 |
| 社区/评论 | ✅ | 插件页评论区 |
| 远程控制台 | ✅ | 设备在线列表、已装插件、指令历史 |
| 远程安装(dsh-link-plugin) | ✅ | 端到端真机验证:配对→在线→远程装插件→进度回写;非白名单 spec 会被拦截 |
| 托管功能(Docker) | ✅ | 领取/续期/释放/到期回池;u1.dsh.cbnac.com 打开是完整 dsh Web UI(200) |
| 前端验收(deepseek-eye) | ✅ | 首页/商店/详情/文档/登录/注册 逐页视觉检查通过 |

---

## 三、架构与部署

### 服务器(腾讯云,现为阿里云 Linux 3)

- IP:**47.98.207.149**;root 密码见本机 `scripts/.env.local`(**敏感,不入库**)
- 配置:**2 核 / 1.8GB 内存** / 40GB 磁盘 —— 资源很紧张,托管 6 台实例已是上限
- 软件:nginx 1.24、Node.js 20(站点)、PM2、Docker 26.1.3、Let's Encrypt(certbot)

### 端口 / PM2 进程

| 端口 | 进程 | 说明 |
|---|---|---|
| 3000 | `cbnac` | 旧英语学习站(**2026-08-17 已暂停释放内存**,`pm2 start cbnac` 可恢复) |
| 3001 | `dsh-ws` | WebSocket 网关(dsh-link 远程连接) |
| 3002 | `dsh-web` | Next.js 15 社区站(standalone→改为 npm 全量部署) |
| 3101~3106 | Docker `dsh-u1~u6` | 托管实例,host 网络绑定宿主 127.0.0.1 |

### 目录 / 配置

- 站点:`/www/wwwroot/cbnac.com/dsh-site/`(含 `data/dsh.db`)
- 网关:`/www/wwwroot/cbnac.com/ws-gateway/`
- Docker 镜像构建:`/www/wwwroot/cbnac.com/dsh-harness/`
- nginx:`/etc/nginx/conf.d/` → `cbnac.com.conf`(主站)、`dsh.cbnac.com.conf`(社区站)、`dsh-hosting.conf`(托管子域 u1~u6)
- PM2 配置:`/www/wwwroot/cbnac.com/ecosystem.config.cjs`
- 证书:`/etc/letsencrypt/live/{cbnac.com,dsh.cbnac.com,u1.dsh.cbnac.com}/`(u1 那张含 u1~u6 六个 SAN)

### 数据库(SQLite,`data/dsh.db`)

表:`users`、`plugins`、`comments`、`devices`、`pairing_codes`、`commands`、`instances`(托管池)
时间戳统一用 unix 秒(drizzle `timestamp` 模式);访问用 @libsql/client。

### Docker 镜像(dsh-harness)

- `deploy/dsh-harness/`:Dockerfile(node:24-slim + build-essential,pnpm@9)+ entrypoint(DSH_PORT 指定端口)+ web profile
- **关键坑**:dsh 只允许绑 127.0.0.1(0.0.0.0 会被安全拒绝),所以容器用 `--network host` + 每实例独立端口;dsh rc.6 的会话持久化要 node:zlib 的 zstd,必须 Node≥22
- 国内拉镜像走镜像源(腾讯云内网 mirror.ccs.tencentyun.com + daocloud)

### DNS(阿里云)

- `dsh.cbnac.com → 47.98.207.149`
- `u1.dsh / u2.dsh / u3.dsh / u4.dsh / u5.dsh / u6.dsh → 47.98.207.149`(6 条,**不是一级 `*`**,阿里云一级 `*` 不覆盖 `*.dsh.`)

---

## 四、外部依赖与凭据

> ⚠️ 以下为敏感信息,交接后建议轮换。真值不在此文件,存放在**服务器** `/www/wwwroot/cbnac.com/ecosystem.config.cjs`(PM2 实际加载)与本机 `scripts/.env.local`(已 gitignore,不入库)。

- **服务器**:root@47.98.207.149;root 密码见本机 `scripts/.env.local` 的 `DSH_SERVER_PASS`(或服务器 SSH 密钥)
- **GitHub**:账号 `qwert702`;fine-grained PAT(已授权 Contents 写;git push 用 `x-access-token` 作用户名)见本机 `scripts/.env.local` 的 `GITHUB_TOKEN`
- **开源仓库**:`github.com/qwert702/dsh-link-plugin`(public,MIT,已带 `dsh-plugin` topic)
- **站点账号**:`shuishui`(admin);`linktest`(测试账号,待清理)
- **密钥清单**(AUTH_SECRET / WS_GATEWAY_KEY / SYNC_KEY / DSH_REGISTRY_HMAC):全部在本机 `scripts/.env.local`,服务器端在 `/www/wwwroot/cbnac.com/ecosystem.config.cjs`

---

## 五、开发 / 部署工作流

### 本地构建 → 部署(重要!)

1. `cd deploy-web`(npm 全量依赖的构建目录,不是 standalone)→ `npx next build`
2. `rm -rf deploy-web/data`(**必须**,否则构建会生成空 dsh.db 打进包覆盖线上库!)
3. 打包:`tar -czf dist/dsh-web-full.tar.gz --exclude='./data' -C deploy-web .`
4. 上传:`./scripts/scp-put.sh <本地> root@47.98.207.149:<远程>`
5. 服务器:`pm2 stop dsh-web` → 清 dsh-site(保留 data/)→ 解压 → `pm2 start dsh-web`

辅助脚本都在 `scripts/`:`ssh-run.sh`、`scp-put.sh`(SSH_ASKPASS 传密码)、`ecosystem.config.cjs`、`server-db-init.mjs`、`make-seed.mjs`、`init-instances.mjs`、`package-web.mjs`。

### 商店数据同步(GFW 限制,关键)

**服务器在国内连不上 api.github.com**,`/api/plugins/sync` 会超时。商店数据更新方式(本机):
1. 本机跑 `cd apps/web && npx tsx scripts/sync-cli.ts`(拉 GitHub 刷新本地库)
2. `node scripts/make-seed.mjs`(导出干净种子,含 plugins + 3 个托管槽)
3. scp `dist/seed.db` → 服务器替换 `dsh-site/data/dsh.db` 后 `pm2 restart dsh-web`

### 迁移到新目录后的注意

新目录 `D:\CBN-HT\Desktop\AI编程\dsh-community` 与旧 `D:\CBN-HT\Desktop\dsh-community` 并存。旧目录里有 `deploy-web/`(自包含构建产物,146MB)和 `dist/`(tar 包),如果搬新目录记得一起搬,或在新目录重新 `npm i` + 构建。

---

## 六、未完成 / 待办(详细)

### ✅ 已完成(2026-08-17)
1. **托管领取/释放进度条**:完成。`claimInstance` 领取后立即返回,前端轮询 `GET /api/instances` 新增的 `httpReady` 字段显示启动进度条(未就绪时 2s 快轮询,25s 预算对齐 `waitReady`),服务就绪后才出现「打开使用」按钮;`dockerStop -t 3` 一并保留。
2. **托管实例到期自动清理**:完成。服务器 crontab 每 10 分钟 curl `http://127.0.0.1:3002/api/instances` 触发 `sweepExpiredInstances()`,无人访问托管页也会及时回收。
3. **实例状态栏 + 管理员工单后台**:完成(2026-08-17 已上线)。每张托管卡片左侧新增状态栏(「实例控制」):「重启 dsh」(`docker restart`,保留容器与 volume)、「升级 dsh」(`docker build` 重新构建镜像 → stop+rm 容器但保留 volume → 重新启动)、「联系解决」(提交工单,≤2000 字)。工单落库 `tickets` 表(open/resolved),「管理员后台」(`/admin/tickets`,仅 `role=admin` 可见,Header 导航按角色隐藏)分组展示待处理/已解决工单,可标记解决/重新打开。`shuishui` 已提升为 admin(角色在 JWT 里,升级后需重新登录一次才生效)。
4. **实例网页内控制条(重启/升级/联系解决)**:完成(2026-08-17 已上线)。用户点「打开使用」进入的 dsh 实例页面(u1/u2/u3.dsh.cbnac.com)左侧也有同款控制条 —— nginx `sub_filter` 往三个实例页面 `</head>` 前注入 `<script src="https://dsh.cbnac.com/ctrl/ctrl-bar.js">`(脚本在站点 `public/ctrl/`,Next.js 静态服务),并 `proxy_set_header Accept-Encoding ""` 防止上游 gzip 导致替换失败。脚本从 `location.hostname` 识别 slot → `GET /api/instances` 找实例 id → 调重启/升级/提交工单。跨子域(u1.dsh.cbnac.com → dsh.cbnac.com)是**同站**请求,SameSite=Lax 的 cookie 自动携带,只需 API 侧 CORS:`apps/web/middleware.ts` 对 `/api/instances/:path*` 加 `Access-Control-Allow-Origin`(仅回显 `*.dsh.cbnac.com`)+ `Allow-Credentials` + 处理 OPTIONS preflight(204),**不做登录拦截**(Edge 下解 JWE 的坑仍在,登录判断都在 route handler 里)。验证:三页面注入 ✓、GET/POST 带 Origin 返回正确 CORS 头 ✓、evil.com 无 CORS 头 ✓、未登录 POST 仍 401 ✓。控制条可收起/展开并记忆状态;2026-08-17 改为**并排占列**(dsh 内容右推,不悬浮遮挡)。
5. **仓库开源 + 凭据脱敏**:完成(2026-08-17)。仓库推送至 **github.com/qwert702/dsh-community**(public)。推送前已脱敏:git 历史重写为单个初始 commit(彻底清除旧历史里的 root 密码/PAT/密钥),HANDOVER.md 凭据改为引用,scp/ssh/ecosystem 脚本密钥改环境变量(真值在本机 `scripts/.env.local`,已 gitignore)。本机 push 需走代理 `git config http.proxy http://127.0.0.1:7897`。
6. **容量优化**:完成(2026-08-17)。旧站 `cbnac` 已 `pm2 stop`(释放 ~280MB,可 `pm2 start cbnac` 恢复);托管实例内存限制 350MB → **150MB**(`dockerStart`/`run-instance.sh` 改 `--memory=150m`,已运行容器 `docker update` 动态降限)。实测 dsh 在 150MB 下占用 90~115MB,服务正常。**注意**:若以后加更多实例,先 `docker update` 已有容器并确认站点进程内存。
7. **实例池扩至 6 台**:完成(2026-08-17)。新增 u4/u5/u6(端口 3104~3106):DB 种 6 槽(`init-instances.mjs` 已更新)、证书 expand 为 6 个 SAN(u1 证书)、nginx `dsh-hosting.conf` 加 3 个 server block(含 sub_filter 注入 + Host/Origin 重写)。实测 u4 测试容器 150m 限制 + dsh web 200,清理后恢复 available。当前池:u1/u2 被领取运行中,u3~u6 空闲。

### ⏳ 待办 / 打磨(M4 计划项,未做)
3. **i18n 中英双语**(参照 dsh.so)—— 全站目前只有中文。
4. **GitHub OAuth 登录**(现在是账号密码)。
5. **注册表 Ed25519 签名**(现在是 HMAC-SHA256)。
6. **控制台 SSE 实时状态**(现在是 5s 轮询)。
7. **/hosting 托管页的 deepseek-eye 视觉检查**(只验证了功能,没逐页看布局)。

### 🧹 清理
8. **`linktest` 测试账号**及其名下设备/实例历史记录要删。
9. **dsh-link-plugin 里的联调 debug 日志**(`[dsh-link]` console.error)应移除,发布一个干净版本(v0.1.x)。
10. `cordis.patch.yml` 里残留的 serverUrl/proxy 兜底配置可考虑清掉,让配置完全走插件设置卡片。

### ⚠️ 已知限制
11. **重型插件远程安装**:better-markdown 这类带 esbuild 工具链的插件,prepare 里嵌套 `pnpm install` 会被 pnpm 11 的构建审批拦截(嵌套不继承 profile 的 allowBuilds),远程安装会失败 —— 需要用户手动在终端装一次接受审批。无 build 脚本的插件(sticky-note 等)远程装没问题。
12. **内存紧张**:2 核 / 1.8GB 内存,2026-08-17 已暂停旧站 cbnac(释放 ~280MB)+ 容器内存上限降到 **150MB**(实测 dsh 运行占用 90~115MB,余量 ~35-60MB,正常无 OOM);若继续 OOM 需降到 2 台实例。
13. **服务器商店同步依赖 GFW 外的本机**(见第五节),无法在服务器直接跑 sync。
14. **托管容器必须传 `DSH_TRUSTED_HOST=<子域>`**:dsh 的 `/api` 有 browser-trust fence,只接受 Host/Origin 都等于自身绑定地址(`127.0.0.1:端口`)的请求。不传该 env 时页面能开(静态资源不校验)但浏览器里所有 API 返回 403 forbidden(曾踩过:页面 200 但接口全 403)。2026-08-17 已完整修复,共两层:
    - 普通接口:`entrypoint.sh` 读取 `DSH_TRUSTED_HOST`(逗号分隔可多个,实测裸 host 即够,无需 `:443`),`instance-manager.dockerStart` 自动传 `slot.subdomain`;重建镜像后生效。
    - settings/credentials 等宿主特权接口(含密钥):**要求 Host 必须是本机绑定地址**,`--trusted-host` 也放行不了(实测矩阵:Host=127 无 Origin → 200,带外部 Origin → 403)。解法在 nginx:`dsh-hosting.conf` 里 `proxy_set_header Host 127.0.0.1:310N;` + `proxy_set_header Origin "";`(见 `docs/deploy/nginx-hosting.conf`)。两者配合后:页面/全部 /api(含 settings、credentials)/SSE `/plugins/events`/WS `/api/events.mux|host` 全通(200/101)。

---

## 七、最容易踩的坑(务必看)

1. **打包必须排除 data**:`tar --exclude='./data'`,否则构建时生成的空 `dsh.db` 打进 tar 会覆盖线上数据库(曾导致账号全丢)。
2. **Windows 构建的 node_modules 不能直接上 Linux**:`@next/swc` 平台二进制不同,必须在部署包手动加 `@next/swc-linux-x64-gnu@<同版本>`(或像现在这样用 npm 全量目录构建)。
3. **不要用 middleware 做登录拦截**:Edge 运行时下 getToken 解 JWE 会失败,登录后所有受保护页被弹回(已删除 middleware,改由页面内 `auth()` 判断)。
4. **必须设 `AUTH_URL=https://dsh.cbnac.com`**,否则认证回调跳到 localhost:3002。
5. **dsh 容器**:只允许 127.0.0.1 + host 网络 + DSH_PORT;镜像必须 node:24(dsh 要 zstd)。
6. **服务器装 npm 包 / 拉镜像都要走国内镜像**(npmmirror / 腾讯云 daocloud),直连会超时。

---

## 八、本地相关

- 本机 dsh harness:`D:\CBN-HT\Desktop\deepseek hnerses`(带空格那个,是**运行中的实例**,端口 3080;`deepseek-harness` 是 dsh **源码仓库**,不运行)
- 本机 dsh profile:`~/.dsh/profiles/web/`(装了 dsh-multimodal、dsh-link-plugin、sticky-note 等)
- dsh-link-plugin 在本机设置入口:dsh UI → 设置 →「连接 dsh.cbnac.com」(独立区块)

---

> 交接要点:功能全部上线且核心链路验证过;**商店数据同步(GFW)和托管进度条是接下来要做的两件事**;所有部署/凭据信息都在本文件第三节/第四节。
