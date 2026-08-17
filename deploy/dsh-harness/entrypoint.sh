#!/bin/bash
# 托管实例入口:DSH_PORT 环境变量指定端口;DSH_BIND_HOST 指定绑定地址
#  - 服务器本地实例:默认 127.0.0.1(安全,nginx 同机转发)
#  - NAS 实例:传 0.0.0.0(经 tailnet 由服务器 nginx 反代)
# DSH_TRUSTED_HOST:浏览器信任围栏额外接受的 authority(如 u1.dsh.cbnac.com),逗号分隔可多个
PORT="${DSH_PORT:-3080}"
BIND="${DSH_BIND_HOST:-127.0.0.1}"
TRUSTED="${DSH_TRUSTED_HOST:-}"

ARGS=(--host "$BIND" --port "$PORT")
if [ -n "$TRUSTED" ]; then
  IFS=',' read -ra HOSTS <<< "$TRUSTED"
  for h in "${HOSTS[@]}"; do
    ARGS+=(--trusted-host "$h")
  done
fi
exec dsh web "${ARGS[@]}"
