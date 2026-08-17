# dsh Community —— DeepSeek Harness 插件商店与免费托管

[DeepSeek Harness (dsh)](https://github.com/deepseek-ai/dsh-harness) 的中文社区站点,提供两大核心能力:

- **🛍️ 插件商店**:自动同步 GitHub 上带 `dsh-plugin` topic 的仓库,审核后上架,提供一键安装命令与签名注册表
- **🖥️ 免费托管**:浏览器直接领取一台 dsh 实例(7 天有效期,自动到期回收),支持一键重启 / 升级 / 提交工单

在线地址:**https://dsh.cbnac.com**

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 插件商店 | 按分类浏览、搜索、一键复制安装命令、远程安装 |
| 插件投稿 | 在 `/submit` 提交 GitHub 仓库,管理员审核后上架 |
| 免费托管 | 领取/续期/释放 dsh 实例,启动进度条,到期自动回收 |
| 实例控制 | 实例页左侧控制条:重启 dsh / 升级 dsh / 联系解决 |
| 管理后台 | 插件审核、工单处理(仅 admin 可见) |

## 🚀 快速开始

### 作为用户

1. 打开 https://dsh.cbnac.com 注册账号
2. 进入**托管**页面,领取一台免费 dsh 实例
3. 等待启动完成,点「打开使用」进入 dsh 控制台
4. 在插件商店找需要的插件,复制安装命令到 dsh 中执行

### 作为插件作者

1. 将插件仓库打上 `dsh-plugin` topic(参考 [dsh-link-plugin](https://github.com/qwert702/dsh-link-plugin))
2. 在 https://dsh.cbnac.com/submit 提交仓库地址
3. 管理员审核通过后自动上架,用户即可一键安装

## 🏗️ 技术栈

- **前端/后端**:Next.js 15 (App Router) + Auth.js v5 + Tailwind CSS
- **数据**:SQLite (@libsql/client + drizzle-orm)
- **部署**:PM2 (dsh-web / dsh-ws) + Docker (托管实例,host 网络,每实例独立端口)
- **域名**:dsh.cbnac.com 主站,`*.dsh.cbnac.com` 通配子域给托管实例

## 🛠️ 本地开发

```bash
cd apps/web
pnpm install
pnpm dev        # http://localhost:3000
```

环境变量参考 `apps/web/.env.local.example`(密钥类值不提交仓库)。

## 📦 部署

部署流程与辅助脚本见 [HANDOVER.md](HANDOVER.md)(交接文档,含部署细节与已知坑)。

## 📄 License

MIT
