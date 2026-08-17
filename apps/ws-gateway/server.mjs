import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { sha256, randomHex, getScalar, getRow, exec, nowSeconds, toDate } from './lib/db.mjs'

/* ============================================================
 * dsh WS 网关
 * - wss:// 经 nginx -> 127.0.0.1:3001 /ws/harness
 * - 内部 HTTP POST /rpc 由 dsh-web 下发指令(x-gw-key)
 * ============================================================ */

const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || '127.0.0.1'
const GW_KEY = process.env.WS_GATEWAY_KEY || ''
const DB_FILE = process.env.DATABASE_PATH || ''

// 在线注册表:deviceId -> { ws, userId, profile, authed, helloAt, lastSeen }
const registry = new Map()
const wsToDevice = new Map()

const server = http.createServer(async (req, res) => {
  const url = req.url || ''

  // 内部 RPC:POST /rpc { jsonrpc, method:'send', params:{ deviceId, payload } }
  if (req.method === 'POST' && url === '/rpc') {
    const key = req.headers['x-gw-key']
    if (GW_KEY && key !== GW_KEY) {
      res.writeHead(403)
      return res.end(JSON.stringify({ error: 'bad gw key' }))
    }
    let body = ''
    for await (const chunk of req) body += chunk
    let msg
    try {
      msg = JSON.parse(body)
    } catch {
      res.writeHead(400)
      return res.end(JSON.stringify({ error: 'bad json' }))
    }

    if (msg.method === 'send') {
      const { deviceId, payload } = msg.params || {}
      const entry = registry.get(deviceId)
      console.log('[/rpc send] msg=', JSON.stringify(msg).slice(0, 220))
      if (entry && entry.authed && entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(JSON.stringify(payload))
        res.writeHead(200)
        return res.end(JSON.stringify({ ok: true, delivered: true }))
      }
      res.writeHead(200)
      return res.end(JSON.stringify({ ok: true, delivered: false }))
    }

    res.writeHead(400)
    return res.end(JSON.stringify({ error: 'unknown method' }))
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true, name: 'dsh-ws-gateway', online: registry.size }))
})

const wss = new WebSocketServer({ server, path: '/ws/harness', maxPayload: 1024 * 1024 })

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress || ''
  console.log(`[ws] connection from ${remoteIp}`)

  let isAlive = true
  ws.on('pong', () => {
    isAlive = true
  })

  ws.on('message', async (buf) => {
    let msg
    try {
      msg = JSON.parse(buf.toString())
    } catch {
      return ws.send(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'parse error' } }))
    }
    const method = msg.method
    const params = msg.params || {}

    try {
      if (method === 'hello') {
        await handleHello(ws, params)
      } else if (method === 'state') {
        const deviceId = wsToDevice.get(ws)
        if (deviceId) await handleState(deviceId, params)
      } else if (method === 'command.result') {
        const deviceId = wsToDevice.get(ws)
        if (deviceId) await handleCommandResult(deviceId, params)
      } else if (method === 'command.progress') {
        const deviceId = wsToDevice.get(ws)
        if (deviceId) await handleProgress(deviceId, params)
      } else {
        ws.send(JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: `unknown method ${method}` } }))
      }
    } catch (e) {
      console.error('[ws] handler error', e)
      ws.send(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: String(e?.message || e) } }))
    }
  })

  ws.on('close', () => {
    const deviceId = wsToDevice.get(ws)
    if (deviceId) {
      registry.delete(deviceId)
      wsToDevice.delete(ws)
      markDeviceOffline(deviceId, ws)
      console.log(`[ws] closed device=${deviceId}`)
    }
  })

  ws.on('error', (e) => console.error('[ws] error', e.message))
})

/* ---------------- 消息处理 ---------------- */

async function handleHello(ws, params) {
  const deviceId = String(params.deviceId || '').trim()
  const pairingCode = String(params.pairingCode || '').trim().toUpperCase()
  const token = String(params.token || '').trim()
  const profile = String(params.profile || 'web')
  const name = String(params.name || deviceId || 'dsh-device').slice(0, 60)
  const platform = params.platform ? String(params.platform) : null

  if (!deviceId) {
    return ws.send(err(-32602, 'deviceId required'))
  }

  let userId = null
  let newToken = null

  if (token) {
    // 重连:校验 tokenHash
    const row = await getRow(
      'SELECT id, user_id, token_hash FROM devices WHERE id = ?',
      [deviceId],
    )
    if (!row || row.token_hash !== sha256(token)) {
      return ws.send(err(-32001, 'token invalid'))
    }
    userId = row.user_id
  } else if (pairingCode) {
    // 首次配对:消费配对码
    const codeHash = sha256(pairingCode)
    const codeRow = await getRow(
      'SELECT user_id, used_at, expires_at FROM pairing_codes WHERE code_hash = ?',
      [codeHash],
    )
    if (!codeRow) return ws.send(err(-32002, 'invalid pairing code'))
    if (codeRow.used_at) return ws.send(err(-32003, 'pairing code already used'))
    const expiresAt = codeRow.expires_at
    if (expiresAt && toDate(expiresAt).getTime() < Date.now()) {
      return ws.send(err(-32004, 'pairing code expired'))
    }
    userId = codeRow.user_id
    await exec('UPDATE pairing_codes SET used_at = ? WHERE code_hash = ?', [
      nowSeconds(),
      codeHash,
    ])

    // 创建/更新设备行并签发 token
    const existing = await getRow('SELECT id FROM devices WHERE id = ?', [deviceId])
    newToken = randomHex()
    const now = nowSeconds()
    if (existing) {
      await exec(
        'UPDATE devices SET user_id = ?, token_hash = ?, name = ?, profile_name = ?, platform = ?, status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?',
        [userId, sha256(newToken), name, profile, platform, 'online', now, now, deviceId],
      )
    } else {
      await exec(
        `INSERT INTO devices (id, user_id, name, profile_name, platform, status, token_hash, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [deviceId, userId, name, profile, platform, 'online', sha256(newToken), now, now, now],
      )
    }
  } else {
    return ws.send(err(-32005, 'either pairingCode or token required'))
  }

  // 注册在线映射
  if (registry.get(deviceId)?.ws !== ws) {
    const oldWs = registry.get(deviceId)?.ws
    if (oldWs && oldWs !== ws) {
      wsToDevice.delete(oldWs)
      oldWs.close()
    }
  }
  registry.set(deviceId, {
    ws,
    userId,
    profile,
    authed: true,
    helloAt: Date.now(),
    lastSeen: Date.now(),
  })
  wsToDevice.set(ws, deviceId)
  await exec('UPDATE devices SET status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?', [
    'online',
    nowSeconds(),
    nowSeconds(),
    deviceId,
  ])

  ws.send(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'hello.result',
      params: {
        bound: true,
        deviceId,
        token: newToken || 'resumed',
        serverTime: nowSeconds(),
      },
    }),
  )
  console.log(`[hello] device=${deviceId} user=${userId} ${newToken ? '(paired)' : '(resumed)'}`)
}

async function handleState(deviceId, params) {
  const installed = params.installed ?? []
  const dshVersion = params.dshVersion ? String(params.dshVersion) : null
  const platform = params.platform ? String(params.platform) : null
  const now = nowSeconds()
  await exec(
    `UPDATE devices SET installed_json = ?, dsh_version = ?, platform = COALESCE(?, platform), status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(installed), dshVersion, platform, 'online', now, now, deviceId],
  )
  const entry = registry.get(deviceId)
  if (entry) entry.lastSeen = Date.now()
}

async function handleCommandResult(deviceId, params) {
  const commandId = String(params.commandId || '')
  const ok = Boolean(params.ok)
  const output = params.output ? String(params.output).slice(0, 20000) : ''
  const exitCode = params.exitCode == null ? null : Number(params.exitCode)
  const now = nowSeconds()
  if (commandId) {
    await exec(
      'UPDATE commands SET status = ?, detail_json = ?, updated_at = ? WHERE id = ?',
      [ok ? 'done' : 'failed', JSON.stringify({ exitCode, output }), now, commandId],
    )
  }
  const entry = registry.get(deviceId)
  if (entry) entry.lastSeen = Date.now()
}

async function handleProgress(deviceId, params) {
  const commandId = String(params.commandId || '')
  if (commandId) {
    await exec('UPDATE commands SET status = ?, updated_at = ? WHERE id = ?', [
      'running',
      nowSeconds(),
      commandId,
    ])
  }
}

function markDeviceOffline(deviceId, ws) {
  const entry = registry.get(deviceId)
  if (entry && entry.ws !== ws) return
  exec('UPDATE devices SET status = ? WHERE id = ?', ['offline', deviceId]).catch(() => {})
}

/* ---------------- 心跳 ---------------- */
setInterval(() => {
  for (const [deviceId, entry] of registry) {
    if (entry.ws.readyState === WebSocket.OPEN) {
      entry.ws.ping()
      entry.lastSeen = Date.now()
    }
  }
}, 30000)

/* ---------------- 周期性离线回收(120s 无任何消息) ---------------- */
setInterval(() => {
  const now = Date.now()
  for (const [deviceId, entry] of registry) {
    if (now - entry.lastSeen > 120000) {
      entry.ws.close()
      registry.delete(deviceId)
      exec('UPDATE devices SET status = ? WHERE id = ?', ['offline', deviceId]).catch(() => {})
      console.log(`[ttl] device=${deviceId} evicted`)
    }
  }
}, 60000)

function err(code, message) {
  return JSON.stringify({ jsonrpc: '2.0', error: { code, message } })
}

server.listen(PORT, HOST, () => {
  console.log(`[dsh-ws-gateway] listening on http://${HOST}:${PORT} path=/ws/harness`)
  console.log(`  DB_FILE=${DB_FILE || '(apps/web/data/dsh.db via relative)'}`)
  console.log(`[dsh-ws-gateway] online=${registry.size}`)
})

process.on('uncaughtException', (e) => console.error('[dsh-ws-gateway] uncaught', e))
process.on('unhandledRejection', (e) => console.error('[dsh-ws-gateway] unhandled', e))