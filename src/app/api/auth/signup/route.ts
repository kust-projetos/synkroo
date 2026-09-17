import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { signupSchema } from '@/lib/validations';
import { createUserWithClinic, findUserByEmail } from '@/repositories/auth';
import { apiRateLimited, generateRequestId } from '@/lib/api/response';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
} from '@/lib/rate-limit';

/**
 * POST /api/auth/signup
 * Register a new user and create their clinic.
 *
 * Response shape (same as before):
 *   { success: true, user: { id, email }, profile }
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  // Auth preset (SPEC §41): signup is a sensitive account-creation endpoint
  // even though it only exists outside production.
  const rateLimit = checkRateLimit(
    getClientIdentifier(request),
    rateLimitPresets.auth,
  );
  if (!rateLimit.allowed) {
    return apiRateLimited(
      generateRequestId(),
      rateLimit.retryAfter ?? 0,
      'Too many signup attempts.',
    );
  }

  try {
    const rawBody = await request.json();
    const { email, password, name, clinicName } = signupSchema.parse(rawBody);

    // Check for existing user
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    // Create clinic + user + credentials in a transaction
    const profile = await createUserWithClinic({
      email,
      password,
      name,
      clinicName,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
      },
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        phone: profile.phone,
        avatar_url: profile.avatarUrl,
        is_active: profile.isActive,
        clinic_id: profile.clinicId,
        clinics: profile.clinics,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
