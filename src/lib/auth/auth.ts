import type { NextAuthOptions, Session, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import { getDb } from '@/lib/db/client';
import { users, userCredentials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Auth.js (next-auth v4) configuration.
 * Exported as authOptions for use in route handler and session helpers.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const plainPassword = credentials.password as string;

        try {
          const db = getDb();

          const rows = await db
            .select({
              user: users,
              passwordHash: userCredentials.passwordHash,
            })
            .from(users)
            .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
            .where(and(eq(users.email, email), eq(users.isActive, true)))
            .limit(1);

          if (rows.length === 0) return null;

          const { user, passwordHash } = rows[0];

          // Dynamic import — avoids bundling node:crypto into Edge runtime
          const { verifyPassword } = await import('@/lib/auth/password');
          if (!verifyPassword(plainPassword, passwordHash)) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            clinicId: user.clinicId,
            role: user.role,
            isActive: user.isActive,
            sessionVersion: user.sessionVersion,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, trigger }: { token: JWT; user?: User; trigger?: string }) {
      if (user) {
        token.id = user.id;
        token.clinicId = user.clinicId;
        token.role = user.role;
        token.isActive = user.isActive;
        token.sessionVersion = user.sessionVersion;
      }
      if (trigger === 'update') {
        try {
          const db = getDb();
          const [freshUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, token.id!))
            .limit(1);
          if (freshUser) {
            token.clinicId = freshUser.clinicId ?? undefined;
            token.role = freshUser.role ?? undefined;
            token.isActive = freshUser.isActive ?? undefined;
            token.sessionVersion = freshUser.sessionVersion ?? undefined;
          }
        } catch {
          // Swallow
        }
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id || '';
        session.user.clinicId = token.clinicId || '';
        session.user.role = token.role || '';
        session.user.isActive = token.isActive ?? true;
        session.user.sessionVersion = token.sessionVersion ?? 0;
      }
      return session;
    },
  },
};
