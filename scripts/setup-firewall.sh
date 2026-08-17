#!/bin/bash
# 服务器:容器安全防火墙规则(防容器访问宿主机内部端口)
# 用法: 服务器上执行 bash setup-firewall.sh(重启后需重跑;可加 crontab @reboot)
# 规则:
#   INPUT  : 阻断 docker0 网桥流量访问宿主机 3000/3001/3002(内部服务)
#   FORWARD: DOCKER-USER 链阻断容器访问宿主机内部端口(兜底)
set -e

echo "[firewall] 配置容器→宿主机隔离规则 …"

# INPUT 链:docker0 进入的流量禁止访问内部端口
iptables -C INPUT -i docker0 -p tcp --dport 3000 -j DROP 2>/dev/null || iptables -I INPUT 1 -i docker0 -p tcp --dport 3000 -j DROP
iptables -C INPUT -i docker0 -p tcp --dport 3001 -j DROP 2>/dev/null || iptables -I INPUT 1 -i docker0 -p tcp --dport 3001 -j DROP
iptables -C INPUT -i docker0 -p tcp --dport 3002 -j DROP 2>/dev/null || iptables -I INPUT 1 -i docker0 -p tcp --dport 3002 -j DROP

# FORWARD(DOCKER-USER):容器访问宿主机网关 172.17.0.1 内部端口
iptables -C DOCKER-USER -d 172.17.0.1 -p tcp --dport 3000 -j DROP 2>/dev/null || iptables -I DOCKER-USER 1 -d 172.17.0.1 -p tcp --dport 3000 -j DROP
iptables -C DOCKER-USER -d 172.17.0.1 -p tcp --dport 3001 -j DROP 2>/dev/null || iptables -I DOCKER-USER 1 -d 172.17.0.1 -p tcp --dport 3001 -j DROP
iptables -C DOCKER-USER -d 172.17.0.1 -p tcp --dport 3002 -j DROP 2>/dev/null || iptables -I DOCKER-USER 1 -d 172.17.0.1 -p tcp --dport 3002 -j DROP

# 持久化
iptables-save > /etc/iptables.rules 2>/dev/null || true
echo "[firewall] 完成。验证:"
iptables -L INPUT -n | grep "dpt:3002" | head -1
iptables -L DOCKER-USER -n | grep "dpt:3002" | head -1
