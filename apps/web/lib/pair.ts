import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { devices, pairingCodes, type Device } from './schema'

// 8 位 base32 风格配对码(大写字母 + 数字,去掉易混淆字符)
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generatePairingCode(): string {
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    const idx = bytes[i] % CHARSET.length
    code += CHARSET[idx]
  }
  return code
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

/** 为当前用户生成一次性配对码并落库(hash 存储,15 分钟过期)。 */
export async function issuePairingCode(userId: string): Promise<{ code: string; expiresAt: number }> {
  const code = generatePairingCode()
  const expiresAt = Date.now() + 15 * 60 * 1000
  await db.insert(pairingCodes).values({
    codeHash: hashCode(code),
    userId,
    expiresAt: new Date(expiresAt),
  })
  return { code, expiresAt }
}

/**
 * 校验配对码(不区分大小写)。成功返回并一次性使用。
 * 返回 { ok, userId?, error? }
 */
export async function consumePairingCode(
  codeInput: string,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const code = codeInput.trim().toUpperCase()
  if (!code) return { ok: false, error: '配对码为空' }
  const codeHash = hashCode(code)
  const row = await db
    .select()
    .from(pairingCodes)
    .where(eq(pairingCodes.codeHash, codeHash))
    .get()

  if (!row) return { ok: false, error: '配对码无效' }
  if (row.usedAt) return { ok: false, error: '配对码已使用' }
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: '配对码已过期' }
  }

  // 一次性消费
  await db
    .update(pairingCodes)
    .set({ usedAt: new Date() })
    .where(eq(pairingCodes.codeHash, codeHash))

  return { ok: true, userId: row.userId }
}

/** 为 deviceId 生成 token 并落库 sha256。返回原始 token(仅此一次可见)。 */
export async function issueDeviceToken(deviceId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await db
    .update(devices)
    .set({ tokenHash: hashCode(token), updatedAt: new Date() })
    .where(eq(devices.id, deviceId))
  return token
}

/** 校验设备 token。 */
export async function verifyDeviceToken(
  deviceId: string,
  token: string,
): Promise<Device | null> {
  if (!token) return null
  const device = await db.select().from(devices).where(eq(devices.id, deviceId)).get()
  if (!device?.tokenHash) return null
  const ok = device.tokenHash === hashCode(token)
  return ok ? device : null
}