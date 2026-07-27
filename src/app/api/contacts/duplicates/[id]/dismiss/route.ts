/**
 * /api/contacts/duplicates/[id]/dismiss — Task 5: gated + action-driven.
 */
import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runCrmAction } from '@/modules/crm/ui/route-adapter';
import { dispensarSugestaoDuplicidade } from '@/modules/crm/actions';

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let dismissReason: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && 'dismiss_reason' in body) {
      dismissReason = String((body as Record<string, unknown>).dismiss_reason);
    }
  } catch {
    // sem body é aceitável
  }
  return runCrmAction(dispensarSugestaoDuplicidade, { id, dismissReason });
}

export const POST = withModuleRoute('crm', moduleManifest)(handlePOST);