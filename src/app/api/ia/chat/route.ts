import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { handleChatRequest } from '@/modules/ia/ui/route-adapter';
import { getUserProfile } from '@/lib/auth/session';

const IA_MODULE = 'ia';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  // Extract user profile from session
  const profile = await getUserProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  let body: { message?: string; clinicId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message, clinicId } = body;

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const targetClinicId = clinicId ?? profile.clinic_id;
  if (!targetClinicId) {
    return NextResponse.json({ error: 'Clinic not found' }, { status: 400 });
  }

  return handleChatRequest(profile.id, targetClinicId, message);
}

const wrappedPOST = withModuleRoute(IA_MODULE, moduleManifest)(handlePOST);
export { wrappedPOST as POST };
