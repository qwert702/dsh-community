#!/bin/bash
# 构建 dsh-harness 镜像并启动一个托管实例容器。
# 用法: ./run-instance.sh <slot> <hostPort>
#   slot: u1/u2/u3   hostPort: 3101/3102/3103
set -e
SLOT="${1:?slot required (u1/u2/u3)}"
PORT="${2:?host port required}"
IMAGE="dsh-harness:latest"
CNAME="dsh-$SLOT"
VOL="$CNAME-data"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[1/2] 构建镜像 $IMAGE …"
docker build -t "$IMAGE" "$SCRIPT_DIR"

echo "[2/2] 启动容器 $CNAME → host 127.0.0.1:$PORT"
docker run -d \
  --name "$CNAME" \
  --network host \
  --memory=350m \
  --restart=unless-stopped \
  -e "DSH_PORT=$PORT" \
  -v "$VOL:/root/.dsh" \
  "$IMAGE"

echo "已启动:$CNAME  →  https://$SLOT.dsh.cbnac.com"
