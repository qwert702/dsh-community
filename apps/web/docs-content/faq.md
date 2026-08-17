# 常见问题

## dsh 是什么?

dsh (DeepSeek Harness) 是围绕 DeepSeek 模型的开源 AI 应用开发环境,提供 Web UI、插件体系和可扩展的 profile 管理。

## 启动报 "cannot resolve profile bundle xxx"

某个 bundle 的依赖未安装。运行:

```bash
dsh plugin --profile <profile名> install
```

如果仍是 "Already up to date" 但 bundle 缺失,说明 `dependencies` 被清空,需要重新加回依赖:

```bash
dsh plugin --profile web add "<spec>"
```

## 两个视觉插件冲突(DUPLICATE_ADAPTER)

多个插件注册同一个 provider 会崩溃。只保留一个:

```bash
dsh plugin --profile web remove <多余插件>
```

## 远程安装安全吗?

安装命令只接受商店白名单 spec,本地二次校验,拒绝危险路径与特殊字符。详见[远程连接文档](/docs/link)。

## 为什么我的插件显示"审核中"?

新同步的 GitHub 仓库默认 `pending`。管理员批准后才可远程安装。你可以先手动复制安装命令。

## 提交后多久上架?

管理员审核,通常很快。你可以通过在 [社区](/community) 里发帖催一催。