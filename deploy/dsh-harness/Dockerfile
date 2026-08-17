# dsh-harness —— 托管 dsh 实例镜像
# 每实例一个容器:独立 /root/.dsh volume,内存上限;host 网络 + DSH_PORT 绑定 127.0.0.1
# 注意:dsh rc.6 的会话持久化需要 node:zlib 的 zstd(Node >= 22),用 node:24
FROM node:24-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates build-essential python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# 国内服务器用镜像源;docker build 在服务器上执行
ENV npm_config_registry=https://registry.npmmirror.com
# pnpm@9:默认允许 build 脚本(不受 pnpm10+ 的 ignored-builds 门控影响)
RUN npm install -g pnpm@9

RUN npm install -g @deepseek-ai/dsh@0.1.0-rc.6

# 预置 web profile(基础 bundle = base + web-app,与用户本机一致的最小集)
COPY profile/package.json profile/pnpm-workspace.yaml /root/.dsh/profiles/web/
RUN cd /root/.dsh/profiles/web && pnpm install

# dsh 出于安全只允许绑 127.0.0.1;用 host 网络 + DSH_PORT 指定端口
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3080
ENTRYPOINT ["/entrypoint.sh"]