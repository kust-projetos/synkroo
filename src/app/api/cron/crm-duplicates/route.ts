/**
 * POST /api/cron/crm-duplicates — reprocess duplicate suggestions (cron)
 * GET  /api/cron/crm-duplicates — health check
 *
 * Security: CRON_SECRET Bearer token verification.
 * Calls the crm.reprocessarSugestoesDuplicidade system action.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';
import {
  listPendingSuggestionsAllClinics,
  findDuplicateSource,
  transitionSuggestionStatus,
} from '@/modules/crm/repositories/duplicate-suggestions-repository';
import { scoreDuplicatePair, classifyDuplicateScore } from '@/modules/crm/services/duplicate-scoring-service';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const rateLimit = checkRateLimit('cron', rateLimitPresets.cron);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  const auth = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (
    !process.env.CRON_SECRET ||
    auth.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let evaluated = 0;
  let dismissed = 0;
  const clinics = new Set<string>();

  const allSuggestions = await listPendingSuggestionsAllClinics();
  for (const s of allSuggestions) {
    clinics.add(s.clinicId);
    evaluated += 1;
    const left = await findDuplicateSource({
      clinicId: s.clinicId,
      ownerType: s.ownerType as 'patient' | 'lead',
      ownerId: s.leftId,
    });
    const right = await findDuplicateSource({
      clinicId: s.clinicId,
      ownerType: s.ownerType as 'patient' | 'lead',
      ownerId: s.rightId,
    });

    if (!left || !right) {
      await transitionSuggestionStatus(s.id, ['pending'], 'dismissed', {
        dismissReason: 'stale_after_merge',
      });
      dismissed += 1;
      continue;
    }

    const score = scoreDuplicatePair(left, right);
    const confidence = classifyDuplicateScore(score.score);
    if (!confidence) {
      await transitionSuggestionStatus(s.id, ['pending'], 'dismissed', {
        dismissReason: 'stale_after_merge',
      });
      dismissed += 1;
    }
  }

  return NextResponse.json({
    success: true,
    evaluated,
    dismissed,
    clinicsAffected: clinics.size,
    timestamp: new Date().toISOString(),
  });
}

async function handleGET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'CRM duplicates cron endpoint is active',
    timestamp: new Date().toISOString(),
  });
}

export const POST = handlePOST;
export const GET = handleGET;
