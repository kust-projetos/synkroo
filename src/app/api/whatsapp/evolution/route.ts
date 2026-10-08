/**
 * GET|POST /api/whatsapp/evolution — retired (410 Gone).
 *
 * WAHA-only (owner decision, commit 3863c4f, ratified 2026-10-08): the legacy
 * Evolution inbound webhook is retired. Senders must migrate to the WAHA
 * inbound webhook at `/api/whatsapp/waha`.
 *
 * The file stays as a Gone stub (not deleted) so existing senders get a
 * machine-readable retirement signal under the canonical error envelope
 * instead of an opaque 404. Physical removal is a follow-up after confirmed
 * zero traffic. The outbound Evolution adapter + registry id stay untouched
 * in this wave (deprecated legacy fallback).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { apiFailure, generateRequestId } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const RETIRED_MESSAGE =
  'Evolution inbound webhook retired (410 Gone). Migrate to the WAHA inbound webhook at /api/whatsapp/waha.';

async function handleRetired(_request: NextRequest): Promise<NextResponse> {
  return apiFailure('EVOLUTION_RETIRED', RETIRED_MESSAGE, generateRequestId(), 410);
}

const gatedRetired = withModuleRoute('atendimento')(handleRetired);

export const POST = gatedRetired;
export const GET = gatedRetired;
