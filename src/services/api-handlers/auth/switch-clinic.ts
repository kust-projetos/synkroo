/**
 * POST /api/auth/switch-clinic — REQ-CORE-09
 *
 * Validates a clinic switch against the active Auth.js session and the
 * user's explicit clinic access. Session state is updated by the client via
 * NextAuth's `session.update`; this route never emits a parallel cookie.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActiveProfile } from '@/lib/auth/session';
import { findUserProfileById } from '@/repositories/auth';
import { apiSuccess, apiFailure, generateRequestId } from '@/lib/api/response';

const switchSchema = z.object({
  clinicId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const profile = await requireActiveProfile();

    const parsed = switchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiFailure('BAD_REQUEST', 'Invalid clinic ID', requestId, 400);
    }
    const { clinicId } = parsed.data;

    const targetProfile = await findUserProfileById(profile.id, clinicId);
    if (!targetProfile) {
      return apiFailure('FORBIDDEN', 'No access to this clinic', requestId, 403);
    }

    return apiSuccess({
      clinicId: targetProfile.clinicId,
      role: targetProfile.role,
      roleId: targetProfile.roleId,
      switchedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return apiFailure('UNAUTHORIZED', 'Authentication required', requestId, 401);
    }
    console.error('Switch clinic error:', error);
    return apiFailure('INTERNAL_ERROR', 'Failed to switch clinic', requestId, 500);
  }
}
