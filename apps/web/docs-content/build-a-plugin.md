# 构建你的第一个插件

dsh 插件本质是一个 npm 包 + 一份 Cordis bundle 补丁。下面以最简插件为例。

## 目录结构

```
my-plugin/
├─ package.json
├─ cordis.patch.yml
└─ lib/
   └─ index.js
```

## package.json

```json
{
  "name": "my-dsh-plugin",
  "version": "0.1.0",
  "main": "./lib/index.js",
  "dsh": {
    "bundle": {
      "patch": "cordis.patch.yml"
    }
  },
  "dependencies": {}
}
```

`dsh.bundle.patch` 指向你的 bundle 声明文件。

## cordis.patch.yml

声明一个名为 `my-plugin` 的插件入口,并把它 insert 进默认 bundle:

```yaml
bundle:
  - base:
version: 0.1.0
insert:
  - id: my-plugin
    name: my-plugin
```

## lib/index.js

```js
module.exports = {
  name: 'my-dsh-plugin',
  inject: ['base'],
  async apply(ctx) {
    ctx.on('ready', () => {
      ctx.logger.info('Hello from my-dsh-plugin!')
    })
  },
}
```

## 本地测试

```bash
# 在插件目录内
npm pack            # 生成 tarball
cd ~/.dsh/profiles/web
pnpm add <path-to-tarball>
```

## 发布到商店

1. `git init && git add . && git commit` 推到 GitHub。
2. 打上 topic:
   ```bash
   gh repo edit owner/my-plugin --add-topic dsh-plugin
   ```
3. 回到本站 [提交插件](/submit) 填写仓库地址。

## 深入

- 参考 dsh 官方仓库的既有插件(dsh-vision-router、dsh-multimodal 等)。
- 建议阅读 Cordis 文档了解生命周期事件与 API。