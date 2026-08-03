/**
 * POST /api/auth/switch-clinic — REQ-CORE-09
 *
 * Troca a clínica ativa do usuário atomicamente.
 * Verifica acesso via userClinicAccess, emite novo token JWT
 * com a nova clinicId, invalida dados scoped anteriores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getToken, encode } from 'next-auth/jwt';
import { getDb } from '@/lib/db/client';
import { userClinicAccess } from '@/modules/core/schema/rbac';
import { and, eq } from 'drizzle-orm';
import { apiSuccess, apiFailure, generateRequestId } from '@/lib/api/response';

const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function getCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
}

const switchSchema = z.object({
  clinicId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return apiFailure('INTERNAL_ERROR', 'Server configuration error', requestId, 500);
    }

    // Auth: must have a valid session
    const token = await getToken({ req: request, secret });
    if (!token?.id) {
      return apiFailure('UNAUTHORIZED', 'Authentication required', requestId, 401);
    }

    // Parse target clinic
    const parsed = switchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiFailure('BAD_REQUEST', 'Invalid clinic ID', requestId, 400);
    }
    const { clinicId } = parsed.data;

    // Verify user has access to target clinic
    const db = getDb();
    const [access] = await db
      .select({ roleId: userClinicAccess.roleId })
      .from(userClinicAccess)
      .where(
        and(
          eq(userClinicAccess.userId, token.id as string),
          eq(userClinicAccess.clinicId, clinicId),
        ),
      )
      .limit(1);

    if (!access) {
      return apiFailure('FORBIDDEN', 'No access to this clinic', requestId, 403);
    }

    // Issue new JWT with updated clinicId (atomic context switch)
    const newToken = await encode({
      token: {
        ...token,
        clinicId, // updated clinic
      },
      secret,
      maxAge: MAX_AGE,
    });

    const response = NextResponse.json(
      apiSuccess({ clinicId, switchedAt: new Date().toISOString() }).body,
      { status: 200 },
    );

    // Set new session cookie (invalidates previous clinic context)
    response.cookies.set(getCookieName(), newToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error('Switch clinic error:', error);
    return apiFailure('INTERNAL_ERROR', 'Failed to switch clinic', requestId, 500);
  }
}
