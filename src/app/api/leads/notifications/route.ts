import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

/**
 * GET /api/leads/notifications — List unacknowledged hot lead alerts.
 *
 * TODO: Task 5 — implement notification system in comercial module.
 * Currently returns empty list placeholder.
 */
const handleGet = async (_request: NextRequest) => {
  return NextResponse.json({ notifications: [], count: 0 });
};

/**
 * POST /api/leads/notifications — Manually trigger hot lead check.
 *
 * TODO: Task 5 — implement notification system in comercial module.
 */
const handlePost = async (_request: NextRequest) => {
  return NextResponse.json({
    success: true,
    message: 'Hot lead check completed (placeholder — Task 5)',
    notifications: [],
    count: 0,
  });
};

export const GET = withModuleRoute('comercial', moduleManifest)(handleGet);
export const POST = withModuleRoute('comercial', moduleManifest)(handlePost);
