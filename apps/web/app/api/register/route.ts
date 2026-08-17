import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'

const USERNAME_RE = /^[a-zA-Z0-9_一-龥]{2,30}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: '无效的请求体' }, { status: 400 })

  const username = String(body.username ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: '用户名需 2-30 位字母数字或中文,不含特殊字符' },
      { status: 400 },
    )
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: '密码至少 8 位' }, { status: 400 })
  }

  const dupName = await db.select().from(users).where(eq(users.username, username)).get()
  if (dupName) {
    return NextResponse.json({ error: '用户名已被占用' }, { status: 409 })
  }
  const dupEmail = await db.select().from(users).where(eq(users.email, email)).get()
  if (dupEmail) {
    return NextResponse.json({ error: '邮箱已被注册' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await db.insert(users).values({
    id: randomUUID(),
    username,
    email,
    passwordHash,
    role: 'user',
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}