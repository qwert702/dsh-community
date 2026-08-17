#!/bin/bash
# 通过密码登录的 SSH 单命令执行(Windows 无 sshpass,用 SSH_ASKPASS)
# 用法: ./scripts/ssh-run.sh '远程命令'
# 密码从环境变量读: DSH_SERVER_PASS(不写死在仓库里)
SERVER="root@47.98.207.149"
PASS="${DSH_SERVER_PASS:?需要先 export DSH_SERVER_PASS=<服务器密码>}"

askpass_file="/tmp/dsh-askpass.sh"
cat > "$askpass_file" <<EOF
#!/bin/bash
echo '$PASS'
EOF
chmod +x "$askpass_file"

export SSH_ASKPASS="$askpass_file"
export SSH_ASKPASS_REQUIRE=force
export DISPLAY=":0"

ssh -o PreferredAuthentications=password \
    -o PubkeyAuthentication=no \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=20 \
    "$SERVER" "$1" 2>&1
rm -f "$askpass_file"