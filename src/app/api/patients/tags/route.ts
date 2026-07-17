/**
 * GET /api/patients/tags — deprecated (410 Gone)
 * POST /api/patients/tags — deprecated (410 Gone)
 *
 * Patient tags management deferred to future wave.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

const OPERACIONAL_MODULE = 'operacional';

const DEPRECATED = NextResponse.json(
  { error: 'deprecated', message: 'Patient tags are not available in this API version.' },
  { status: 410 },
);

async function handle(): Promise<NextResponse> { return DEPRECATED; }
const wrapped = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handle);
export { wrapped as GET, wrapped as POST };
