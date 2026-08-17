import { NextRequest, NextResponse } from 'next/server'

// 允许从托管实例页(u1/u2/u3.dsh.cbnac.com)跨子域调用本站 API
// 同站跨子域 fetch: SameSite=Lax cookie 会携带,但响应需 CORS 头 + 处理 OPTIONS preflight
const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?dsh\.cbnac\.com$/

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    }
  }
  return {}
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers })
  }

  const res = NextResponse.next()
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
  return res
}

export const config = {
  matcher: ['/api/instances/:path*'],
}
