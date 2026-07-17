/**
 * GET /api/patients/[id]/history — deprecated (410 Gone)
 *
 * Patient history is available via operational.consultarDisponibilidade
 * and appointments listing. Full history port in a future wave.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

const OPERACIONAL_MODULE = 'operacional';

const DEPRECATED = NextResponse.json(
  { error: 'deprecated', message: 'Patient history is not available in this API version.' },
  { status: 410 },
);

async function handle(): Promise<NextResponse> { return DEPRECATED; }
const wrapped = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handle);
export { wrapped as GET };
