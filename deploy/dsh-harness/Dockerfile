# dsh-harness —— 托管 dsh 实例镜像(安全加固版)
# 安全设计:
# - bridge 网络(容器间/到宿主隔离,不见宿主机 127.0.0.1 与 tailnet 内网)
# - 非 root(node 用户)运行 + cap-drop ALL + no-new-privileges + 只读根文件系统
# - 移除 git / 编译工具链:阻断"容器内装任意 github 插件跑任意 prepare 脚本"
# - 容器内 socat 转发 eth0:PORT → 127.0.0.1:PORT(dsh 只绑回环)
# 注意:dsh rc.6 会话持久化需要 zstd(Node >= 22),用 node:24
FROM node:24-slim

# 只装运行时必需:ca-certificates(HTTPS)+ socat(端口转发);不装 git/编译工具
# 国内服务器 apt 用阿里云镜像源(deb.debian.org 国内极慢)
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null || true \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates socat \
    && rm -rf /var/lib/apt/lists/*

# 国内服务器用镜像源;docker build 在服务器上执行
ENV npm_config_registry=https://registry.npmmirror.com
# pnpm@9:默认允许 build 脚本(不受 pnpm10+ 的 ignored-builds 门控影响)
RUN npm install -g pnpm@9

RUN npm install -g @deepseek-ai/dsh@0.1.0-rc.6

# node 用户(node:24-slim 官方镜像已自带 node 用户,确认存在即可)
RUN id node >/dev/null 2>&1 || useradd --create-home --shell /bin/bash node

# 预置 web profile(基础 bundle = base + web-app)到 node 用户 DSH_HOME
COPY profile/package.json profile/pnpm-workspace.yaml /home/node/.dsh/profiles/web/
RUN mkdir -p /home/node/.dsh/profiles/web \
    && printf 'ignore-workspace-root-check=true\nstore-dir=/home/node/.dsh/.pnpm-store\n' > /home/node/.dsh/profiles/web/.npmrc \
    && chown -R node:node /home/node/.dsh \
    && cd /home/node/.dsh/profiles/web && pnpm install \
    && chown -R node:node /home/node/.dsh

COPY entrypoint.sh /entrypoint.sh
COPY add-bundle.js /usr/local/bin/dsh-add-bundle.js
RUN chmod +x /entrypoint.sh
# pnpm store / 缓存写到 volume(/home/node/.dsh)内,避免只读根文件系统 EROFS
ENV PNPM_STORE_DIR=/home/node/.dsh/.pnpm-store \
    XDG_CACHE_HOME=/home/node/.dsh/.cache \
    XDG_DATA_HOME=/home/node/.dsh/.data \
    XDG_CONFIG_HOME=/home/node/.dsh/.config
EXPOSE 3080
ENTRYPOINT ["/entrypoint.sh"]
