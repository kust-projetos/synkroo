/**
 * GET /api/patients/[id]/observations — deprecated (410 Gone)
 * POST /api/patients/[id]/observations — deprecated (410 Gone)
 *
 * Patient observations port deferred to future wave.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';

const OPERACIONAL_MODULE = 'operacional';

const DEPRECATED = NextResponse.json(
  { error: 'deprecated', message: 'Patient observations are not available in this API version.' },
  { status: 410 },
);

async function handle(): Promise<NextResponse> { return DEPRECATED; }
const wrapped = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handle);
export { wrapped as GET, wrapped as POST };
