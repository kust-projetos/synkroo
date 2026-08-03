import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { encode } from 'next-auth/jwt';
import { loginSchema } from '@/lib/validations';
import { findUserProfileById } from '@/repositories/auth';
import { getDb } from '@/lib/db/client';
import { users, userCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
  createRateLimitHeaders,
} from '@/lib/rate-limit';

const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function getCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
}

/**
 * POST /api/auth/login
 * Sign in with email and password.
 * Creates an Auth.js JWT session cookie and returns user/profile.
 *
 * Response shape (same as before):
 *   { user: { id, email }, profile: { id, email, name, role, ... } }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.auth,
      keyPrefix: 'auth-login',
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
            ...createRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime, rateLimitPresets.auth.maxRequests),
          },
        },
      );
    }

    const rawBody = await request.json();
    const { email, password } = loginSchema.parse(rawBody);

    // Verify credentials directly against DB
    const { verifyPassword } = await import('@/lib/auth/password');

    const db = getDb();
    const rows = await db
      .select({
        user: users,
        passwordHash: userCredentials.passwordHash,
      })
      .from(users)
      .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const { user, passwordHash } = rows[0];
    const valid = verifyPassword(password, passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.isActive === false) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Create Auth.js JWT session token
    const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
    const token = {
      id: user.id,
      email: user.email,
      name: user.name,
      clinicId: user.clinicId,
      role: user.role,
      isActive: user.isActive,
      sessionVersion: user.sessionVersion,
    };

    const sessionToken = await encode({ token, secret, maxAge: MAX_AGE });

    // Fetch full profile for response
    const profile = await findUserProfileById(user.id);

    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role,
            phone: profile.phone,
            avatar_url: profile.avatarUrl,
            is_active: profile.isActive,
            clinic_id: profile.clinicId,
            clinics: profile.clinics,
          }
        : null,
    });

    // Set session cookie
    response.cookies.set(getCookieName(), sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
