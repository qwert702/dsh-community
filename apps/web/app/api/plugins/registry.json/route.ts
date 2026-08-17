import { NextResponse } from 'next/server'
import { buildRegistry } from '@/lib/registry'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function GET() {
  const registry = await buildRegistry()
  const payload = { ...registry, sig: registry.sig }
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}