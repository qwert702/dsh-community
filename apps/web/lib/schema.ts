import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('users_username_idx').on(t.username)],
)

export const plugins = sqliteTable(
  'plugins',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    author: text('author').notNull(),
    authorId: text('author_id').references(() => users.id),
    category: text('category').notNull().default('tool'),
    desc: text('desc').notNull().default(''),
    longDesc: text('long_desc'),
    spec: text('spec').notNull(),
    installCommand: text('install_command').notNull(),
    repo: text('repo'),
    repoUrl: text('repo_url'),
    homepage: text('homepage'),
    source: text('source', { enum: ['github', 'user', 'manual'] }).notNull().default('github'),
    status: text('status', {
      enum: ['pending', 'approved', 'rejected', 'removed', 'manual'],
    })
      .notNull()
      .default('pending'),
    heat: integer('heat').notNull().default(0),
    downloads: integer('downloads').notNull().default(0),
    stars: integer('stars').notNull().default(0),
    githubData: text('github_data', { mode: 'json' }),
    manifestValid: integer('manifest_valid', { mode: 'boolean' }).notNull().default(false),
    patchPath: text('patch_path'),
    version: text('version'),
    lastValidatedAt: integer('last_validated_at', { mode: 'timestamp' }),
    lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('plugins_status_category_idx').on(t.status, t.category), index('plugins_slug_idx').on(t.slug)],
)

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    pluginId: text('plugin_id')
      .notNull()
      .references(() => plugins.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    parentId: text('parent_id'),
    body: text('body').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('comments_plugin_idx').on(t.pluginId), index('comments_user_idx').on(t.userId)],
)

export const devices = sqliteTable(
  'devices',
  {
    id: text('id').primaryKey(), // deviceId
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(), // os.hostname()
    profileName: text('profile_name').notNull().default('web'),
    platform: text('platform'),
    dshVersion: text('dsh_version'),
    status: text('status', { enum: ['online', 'offline'] }).notNull().default('offline'),
    tokenHash: text('token_hash'),
    installedJson: text('installed_json', { mode: 'json' }),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('devices_user_idx').on(t.userId)],
)

export const pairingCodes = sqliteTable('pairing_codes', {
  codeHash: text('code_hash').primaryKey(), // sha256(code)
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  deviceId: text('device_id'),
})

export const commands = sqliteTable(
  'commands',
  {
    id: text('id').primaryKey(),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    action: text('action', { enum: ['install', 'uninstall', 'list'] }).notNull(),
    spec: text('spec'),
    status: text('status', {
      enum: ['queued', 'sent', 'running', 'done', 'failed', 'timeout'],
    })
      .notNull()
      .default('queued'),
    detailJson: text('detail_json', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('commands_device_idx').on(t.deviceId)],
)

export const instances = sqliteTable(
  'instances',
  {
    id: text('id').primaryKey(),
    slot: text('slot').notNull().unique(), // u1/u2/u3
    subdomain: text('subdomain').notNull().unique(), // u1.dsh.cbnac.com(内部槽位域名)
    randSubdomain: text('rand_subdomain'), // 领取时分配的随机域名(如 rga7i.dsh.cbnac.com),释放后清空
    hostPort: integer('host_port').notNull(), // 3101…
    containerName: text('container_name').notNull(), // dsh-u1
    host: text('host', { enum: ['local', 'nas'] }).notNull().default('local'), // local=本服务器, nas=内网 NAS
    userId: text('user_id').references(() => users.id), // 空 = 空闲
    status: text('status', { enum: ['available', 'claimed', 'expired'] })
      .notNull()
      .default('available'),
    claimedAt: integer('claimed_at', { mode: 'timestamp' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    availableAt: integer('available_at', { mode: 'timestamp' }), // 释放冷却:此时间后才可被领取(null=立即)
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('instances_user_idx').on(t.userId), index('instances_status_idx').on(t.status)],
)

/** 联系解决工单:用户对某台托管实例提交问题,管理员在后台处理。 */
export const tickets = sqliteTable(
  'tickets',
  {
    id: text('id').primaryKey(),
    instanceId: text('instance_id')
      .notNull()
      .references(() => instances.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    message: text('message').notNull(),
    status: text('status', { enum: ['open', 'resolved'] }).notNull().default('open'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
    resolvedBy: text('resolved_by').references(() => users.id),
  },
  (t) => [
    index('tickets_status_idx').on(t.status),
    index('tickets_instance_idx').on(t.instanceId),
    index('tickets_user_idx').on(t.userId),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Plugin = typeof plugins.$inferSelect
export type NewPlugin = typeof plugins.$inferInsert
export type Device = typeof devices.$inferSelect
export type NewDevice = typeof devices.$inferInsert
export type Command = typeof commands.$inferSelect
export type NewCommand = typeof commands.$inferInsert
export type Instance = typeof instances.$inferSelect
export type NewInstance = typeof instances.$inferInsert
export type Ticket = typeof tickets.$inferSelect
export type NewTicket = typeof tickets.$inferInsert
