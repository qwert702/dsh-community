// 模拟 dsh-link-plugin 的 WS 客户端:用于端到端联调。
// 用法: node test/harness-client.mjs <wsUrl> <pairingCode|token> <deviceId>
import WebSocket from 'ws'

const [, , wsUrl = 'ws://127.0.0.1:3001/ws/harness', cred = '', deviceId = `dev-test-${Date.now()}`] =
  process.argv

const ws = new WebSocket(wsUrl)
let token = ''
let resolvedDeviceId = deviceId

ws.on('open', () => {
  console.log('[client] open, sending hello')
  ws.send(
    JSON.stringify({
      method: 'hello',
      params: {
        deviceId: resolvedDeviceId,
        ...(cred.startsWith('pair:')
          ? { pairingCode: cred.slice(5) }
          : { token: cred }),
        profile: 'web',
        name: 'harness-test',
        platform: process.platform,
      },
    }),
  )
})

ws.on('message', (buf) => {
  const msg = JSON.parse(buf.toString())
  console.log('[client] <-', JSON.stringify(msg).slice(0, 300))
  switch (msg.method) {
    case 'hello.result': {
      token = msg.params?.token || token
      resolvedDeviceId = msg.params?.deviceId || resolvedDeviceId
      console.log(`[client] bound device=${resolvedDeviceId}${token ? ' (new token)' : ''}`)
      ws.send(
        JSON.stringify({
          method: 'state',
          params: { installed: ['@deepseek-ai/dsh-base', 'dsh-multimodal'], dshVersion: '0.1.0-rc.6' },
        }),
      )
      break
    }
    case 'command': {
      const { commandId, action, spec } = msg.params || {}
      console.log(`[client] executing ${action} ${spec || ''} (${commandId})`)
      // 模拟执行
      setTimeout(() => {
        ws.send(
          JSON.stringify({
            method: 'command.result',
            params: {
              commandId,
              ok: true,
              exitCode: 0,
              output: `dsh plugin ${action} ${spec || ''}: ok (simulated)`,
            },
          }),
        )
      }, 400)
      break
    }
    default:
      break
  }
})

ws.on('close', () => console.log('[client] closed'))
ws.on('error', (e) => console.log('[client] error', e.message))

setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) ws.ping()
}, 30000)

// 10 分钟后自动退出
setTimeout(() => process.exit(0), 10 * 60 * 1000)