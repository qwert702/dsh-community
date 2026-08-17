# 快速上手

dsh (DeepSeek Harness) 是围绕 DeepSeek 模型构建的开源 AI 应用开发环境。带上 dsh-link-plugin,你的 harness 可以与 dsh 社区网站建立安全连接,远程安装插件。

## 三步上手

1. **启动你的 dsh**

   ```bash
   dsh start
   # 或使用自定义 profile
   dsh start --profile web
   ```

2. **浏览插件商店**

   访问 [插件商店](/plugins),浏览来自 GitHub 的 dsh 插件,复制安装命令。

3. **远程连接(可选,进阶)**

   安装 [dsh-link-plugin](/docs/link) 后,你能从浏览器远程安装插件到本机。

## 基本概念

| 概念 | 说明 |
|------|------|
| **profile** | dsh 的配置单元,不同 profile 有独立的依赖与 bundle |
| **bundle** | 一组插件,声明于 profile 的 package.json |
| **插件** | 以 Cordis 模块形式提供能力的扩展包 |

## 下一个

继续阅读 [安装 dsh](/docs/installation) 或 [远程连接](/docs/link)。