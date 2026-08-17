# 安装 dsh

dsh 通过 pnpm + Node.js 18+ 运行。推荐 Node 20+。

## 环境要求

- Node.js >= 18
- pnpm >= 9

## 安装

全局安装 dsh CLI:

```bash
npm install -g @deepseek-ai/dsh
# 或
pnpm add -g @deepseek-ai/dsh
```

## 启动与 profile

```bash
# 默认 profile
dsh start

# 指定 profile(web UI 通常用 web)
dsh start --profile web
```

## 安装一个插件

```bash
dsh plugin --profile web add "github:owner/repo#main"
```

查看已安装:

```bash
dsh plugin --profile web list
```

## 常见问题

- **启动报 "cannot resolve profile bundle"**: 说明某 bundle 的依赖未安装,运行
  `dsh plugin --profile <name> install` 修复。
- **插件安装了但 UI 没出现**: 确认它声明了 `dsh.bundle.patch`,并在 UI 中刷新。