#!/bin/bash
# 托管实例入口:DSH_PORT 环境变量指定端口(host 网络下绑定宿主 127.0.0.1)
# DSH_TRUSTED_HOST:浏览器信任围栏额外接受的 authority(如 u1.dsh.cbnac.com),逗号分隔可多个
PORT="${DSH_PORT:-3080}"
TRUSTED="${DSH_TRUSTED_HOST:-}"

ARGS=(--host 127.0.0.1 --port "$PORT")
if [ -n "$TRUSTED" ]; then
  IFS=',' read -ra HOSTS <<< "$TRUSTED"
  for h in "${HOSTS[@]}"; do
    ARGS+=(--trusted-host "$h")
  done
fi
exec dsh web "${ARGS[@]}"
