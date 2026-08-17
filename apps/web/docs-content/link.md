# 远程连接(dsh-link-plugin)

dsh-link-plugin 是 dsh 社区的官方远程连接插件。安装它之后,你的本机 harness 会通过 WebSocket 连接到 dsh 社区网站,让你从浏览器远程安装插件。

> **适用场景** —— 想从网页远程管理本机 dsh 的开发者。
> **机制** —— 本机插件**主动连出**到 `wss://dsh.cbnac.com/ws/harness`(WebRTC/TCP 隧道均不需要)。安装由本机自己执行 `dsh plugin add`,安全可控。

## 安装插件

将 dsh-link-plugin 加入你的 profile:

```bash
dsh plugin --profile web add "github:qwert702/dsh-link-plugin#main"
```

然后在 dsh Web UI 的设置页找到 **dsh-link** 卡片。

## 配对设备

### 第 1 步:生成配对码

1. 在 dsh 社区网站[登录](/login),打开[远程控制台](/console)。
2. 点击 **生成配对码**。
3. 得到 8 位配对码(15 分钟内有效,一次性)。

### 第 2 步:在本机填入

在 dsh-link 设置卡片中填写:

```
serverUrl:  wss://dsh.cbnac.com/ws/harness
配对码:    XXXXXXXX
profile:   web
```

点击保存,插件会自动连接并完成配对。

### 第 3 步:验证

回到[远程控制台](/console),你的设备会显示 **在线**,并列出本机已安装的插件。

## 远程安装插件

1. 进入[插件商店](/plugins),选择已批准的插件。
2. 点击**远程安装**,选择你的在线设备。
3. 插件在本机执行 `dsh plugin add`,控制台显示实时进度。

## 安全模型

- 安装命令的 `spec` **必须是商店注册表中已批准的行**(白名单),本地会二次校验。
- 拒绝任何本地路径(`./` `../`)、`file:`、`link:` 及含 `&&` `;` `|` 等特殊字符的指令。
- 设备 token 只存 sha256 哈希。
- 端口仅本机可访问(下游 127.0.0.1),TLS 由 nginx 终结。
- **安装插件即运行其构建脚本**,只安装你信任的来源。

## 离线模式

dsh-link-plugin 连上时会缓存一份商店注册表。即使断网,你也能在 dsh Web UI 看到可安装条目。

## 常见问题

- **连接失败** —— 检查 serverUrl 是否为 `wss://`、配对码是否过期。
- **设备显示离线** —— 确认本机 dsh 正在运行,检查日志。
- **远程安装被拒绝** —— 该插件的 `spec` 不在白名单;先让管理员批准它。