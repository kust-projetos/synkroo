import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { findUserProfileById } from '@/repositories/auth';

/**
 * GET /api/auth/session
 * Get current session and user profile.
 *
 * Response shape (same as before):
 *   { authenticated, user: { id, email, created_at }, profile }
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        profile: null,
      });
    }

    const profile = await findUserProfileById(session.user.id);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        created_at: undefined,
      },
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
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
