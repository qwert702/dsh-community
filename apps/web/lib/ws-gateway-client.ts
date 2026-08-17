import { WS_GATEWAY_URL, WS_GATEWAY_KEY } from './env'

/**
 * 向 WS 网关的内部 HTTP /rpc 端点投递消息。
 * 网关维护在线设备 Map;返回 { delivered: boolean, reason? }
 */
export async function gwSend(params: {
  method: string
  params: Record<string, unknown>
}): Promise<{ delivered: boolean; reason?: string }> {
  if (!WS_GATEWAY_URL) return { delivered: false, reason: 'WS_GATEWAY_URL 未配置' }
  try {
    const res = await fetch(`${WS_GATEWAY_URL}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gw-key': WS_GATEWAY_KEY,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: params.method,
        params: params.params,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { delivered: false, reason: `网关 HTTP ${res.status}` }
    const data = await res.json().catch(() => null)
    if (data?.error) return { delivered: false, reason: String(data.error.message ?? '') }
    return { delivered: true }
  } catch (e: any) {
    return { delivered: false, reason: String(e?.message ?? e) }
  }
}