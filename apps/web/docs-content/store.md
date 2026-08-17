# 插件商店与安装

dsh 社区商店自动同步 GitHub 上所有 `topic:dsh-plugin` 仓库,对其进行校验后提供一键安装。

## 商店如何工作

1. **同步** —— 每 30 分钟自动调用 GitHub Search API 拉取 `topic:dsh-plugin archived:false` 的仓库。
2. **校验** —— 每个仓库检查 `package.json` 是否声明 `dsh.bundle.patch`(或 `manifest.dsh.bundle.patch`),并确认补丁文件存在。
3. **锁定** —— 经校验的仓库以 `github:owner/repo#<commit-sha>` 形式精确锁定安装源。
4. **审核** —— 管理员逐条批准后进入可安装白名单。

## 手动安装(无远程连接)

在插件详情页复制安装命令,到本机终端执行:

```bash
dsh plugin --profile web add "github:owner/repo#sha"
```

## 远程安装(需要 dsh-link-plugin)

详见 [远程连接文档](/docs/link)。无论在浏览器还是本机,安装的 spec 都会与商店白名单比对。

## 提交你的插件

1. 把仓库打上 `dsh-plugin` topic,推到 GitHub。
   ```bash
   gh repo edit owner/repo --add-topic dsh-plugin
   ```
2. 确认 `package.json` 有:
   ```json
   {
     "dsh": {
       "bundle": {
         "patch": "cordis.patch.yml"
       }
     }
   }
   ```
3. 在 [提交插件](/submit) 填仓库地址,提交审核。

## 文件通过规则

| 规则 | 值 |
|------|----|
| 必须 | package.json 中有 dsh.bundle.patch |
| 必须 | patch 文件可达 |
| spec | github:owner/repo#锁定commit |
| 状态流转 | pending → approved / rejected |