import type { NextAuthOptions, Session, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import { getDb } from '@/lib/db/client';
import { findUserProfileById, revokeUserSession } from '@/repositories/auth';
import { normalizeEmail } from '@/lib/validations/common';
import { users, userCredentials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Auth.js (next-auth v4) configuration.
 * Exported as authOptions for use in route handler and session helpers.
 */
export const authOptions: NextAuthOptions = {
  // Staging/prod secret sync: o middleware verifica o JWT com o mesmo valor.
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = normalizeEmail(credentials.email as string);
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

          // The default clinic is only the initial candidate. Authorization
          // still requires an active membership and resolves the effective
          // role from user_clinic_access.
          const profile = await findUserProfileById(user.id, user.clinicId);
          if (!profile) return null;

          return {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            clinicId: profile.clinicId,
            role: profile.role,
            roleId: profile.roleId,
            isActive: profile.isActive,
            sessionVersion: profile.sessionVersion,
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
  events: {
    async signOut({ token }) {
      if (token?.id) await revokeUserSession(token.id);
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }: { token: JWT; user?: User; trigger?: string; session?: Session }) {
      if (user) {
        token.id = user.id;
        token.clinicId = user.clinicId;
        token.role = user.role;
        token.roleId = user.roleId;
        token.isActive = user.isActive;
        token.sessionVersion = user.sessionVersion;
      }
      if (trigger === 'update') {
        try {
          const requestedClinicId = session?.user?.clinicId;
          const targetClinicId = requestedClinicId || token.clinicId;
          if (token.id && targetClinicId) {
            const freshProfile = await findUserProfileById(token.id, targetClinicId);
            if (freshProfile) {
              token.clinicId = freshProfile.clinicId;
              token.role = freshProfile.role;
              token.roleId = freshProfile.roleId;
              token.isActive = freshProfile.isActive;
              token.sessionVersion = freshProfile.sessionVersion;
            }
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
        session.user.roleId = token.roleId || '';
        session.user.isActive = token.isActive ?? true;
        session.user.sessionVersion = token.sessionVersion ?? 0;
      }
      return session;
    },
  },
};
