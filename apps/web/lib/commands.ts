import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { commands, devices, plugins, type Command } from './schema'
import { gwSend } from './ws-gateway-client'

export type CommandResult =
  | { ok: true; commandId: string }
  | { ok: false; error: string }

/**
 * 下发安装/卸载/列表指令到设备。
 * - install 的 spec 必须命中白名单(approved/manual 行)
 * - 先落库 queued,再尝试网关投递;离线则置 failed
 */
export async function dispatchCommand(
  userId: string,
  deviceId: string,
  input: { action: 'install' | 'uninstall' | 'list'; spec?: string },
): Promise<CommandResult> {
  const device = await db.select().from(devices).where(eq(devices.id, deviceId)).get()
  if (!device || device.userId !== userId) {
    return { ok: false, error: '设备不存在或不属于你' }
  }

  let approvedSpec: string | null = null
  if (input.action === 'install') {
    const spec = input.spec?.trim()
    if (!spec) return { ok: false, error: '缺少安装源 spec' }
    const pluginRow = await db
      .select()
      .from(plugins)
      .where(eq(plugins.spec, spec))
      .get()
    const row = spec.startsWith('github:') ? pluginRow : null
    const ok =
      (row?.status === 'approved' || row?.status === 'manual') && row.spec === spec
    if (!ok) return { ok: false, error: '该安装源不在白名单中,未批准' }
    approvedSpec = spec
  } else if (input.action === 'uninstall') {
    approvedSpec = input.spec?.trim() ?? null
  }

  const commandId = randomUUID()
  await db.insert(commands).values({
    id: commandId,
    deviceId,
    userId,
    action: input.action,
    spec: approvedSpec ?? '',
    status: 'queued',
    createdAt: new Date(),
  })

  // 尝试投递
  const rpc = await gwSend({
    method: 'send',
    params: {
      deviceId,
      payload: {
        jsonrpc: '2.0',
        id: commandId,
        method: 'command',
        params: { commandId, action: input.action, spec: approvedSpec },
      },
    },
  })

  if (!rpc.delivered) {
    await db
      .update(commands)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(commands.id, commandId))
    return { ok: false, error: `设备离线或网关不可用: ${rpc.reason ?? '未知'}` }
  }

  await db
    .update(commands)
    .set({ status: 'sent', updatedAt: new Date() })
    .where(eq(commands.id, commandId))

  return { ok: true, commandId }
}

/** 网关上报 command.result 时回写状态。 */
export async function reportCommandResult(
  commandId: string,
  result: { ok: boolean; exitCode?: number; output?: string },
): Promise<void> {
  const current = await db.select().from(commands).where(eq(commands.id, commandId)).get()
  if (!current) return
  await db
    .update(commands)
    .set({
      status: result.ok ? 'done' : 'failed',
      updatedAt: new Date(),
      detailJson: {
        exitCode: result.exitCode ?? null,
        output: result.output ?? '',
      },
    })
    .where(eq(commands.id, commandId))
}

export type { Command }