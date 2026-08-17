#!/bin/bash
# 托管实例入口(安全加固版):
# - 容器以 root 启动(仅用于 chown volume),随后降权到 node 用户运行 dsh
# - bridge 网络:宿主机 docker-proxy 送流量进容器 eth0:PORT
# - 容器内 socat 把 eth0:PORT 转发到 127.0.0.1:PORT(dsh 只绑本机回环,拒绝 0.0.0.0)
# - DSH_HOME=/home/node/.dsh(volume 挂载,chown 后 node 可写)
# DSH_TRUSTED_HOST:浏览器信任围栏额外接受的 authority,逗号分隔可多个
set -e

PORT="${DSH_PORT:-3080}"
TRUSTED="${DSH_TRUSTED_HOST:-}"

# 容器以 root 启动:修复 volume 属主(node 官方镜像 node 用户 UID 1000)
if [ "$(id -u)" = "0" ]; then
  mkdir -p /home/node/.dsh
  chown -R node:node /home/node/.dsh 2>/dev/null || true
fi

# 容器内 socat:监听容器 eth0 上的 PORT(不是 0.0.0.0,避免占用 127.0.0.1 与 dsh 冲突),
# 转发到本机回环 127.0.0.1:PORT(dsh 绑这里)
if command -v socat >/dev/null 2>&1; then
  ETH0_IP="$(hostname -i 2>/dev/null | awk '{print $1}')"
  if [ -n "$ETH0_IP" ]; then
    socat TCP-LISTEN:"$PORT",fork,reuseaddr,bind="$ETH0_IP" TCP:127.0.0.1:"$PORT" &
    echo "[entrypoint] socat ${ETH0_IP}:${PORT} -> 127.0.0.1:${PORT} started"
  else
    echo "[entrypoint] WARN: cannot resolve eth0 IP, socat skipped"
  fi
fi

ARGS=(--host 127.0.0.1 --port "$PORT")
if [ -n "$TRUSTED" ]; then
  IFS=',' read -ra HOSTS <<< "$TRUSTED"
  for h in "${HOSTS[@]}"; do
    ARGS+=(--trusted-host "$h")
  done
fi

# 降权到 node 用户运行 dsh(cordis-plugin-hmr 需要 --expose-internals,只能作为 node 参数)
DSH_BIN="$(command -v dsh)"
if [ "$(id -u)" = "0" ]; then
  exec su -s /bin/bash node -c "exec node --expose-internals '$DSH_BIN' web ${ARGS[*]}"
fi
exec node --expose-internals "$DSH_BIN" web "${ARGS[@]}"
