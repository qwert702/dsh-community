import NextAuth, { type DefaultSession } from 'next-auth'
import type {} from 'next-auth/jwt'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { users } from './schema'
import { AUTH_SECRET } from './env'

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: AUTH_SECRET,
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: '用户名' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const username = String(credentials.username)
        const password = String(credentials.password)

        const row = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .get()

        if (!row) return null
        const ok = await bcrypt.compare(password, row.passwordHash)
        if (!ok) return null

        return {
          id: row.id,
          name: row.username,
          email: row.email,
          role: row.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as 'user' | 'admin'
      }
      return session
    },
  },
})

// 类型扩展:让 session.user 带 id/role
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'user' | 'admin'
    } & DefaultSession['user']
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: 'user' | 'admin'
  }
}