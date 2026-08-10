import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

async function handleGET() {
  return NextResponse.json({
    error: 'Widget messaging endpoint retired',
    code: 'WIDGET_MESSAGING_RETIRED',
  }, { status: 410 });
}

async function handlePOST(_request: NextRequest) {
  return NextResponse.json({
    error: 'Widget messaging endpoint retired',
    code: 'WIDGET_MESSAGING_RETIRED',
  }, { status: 410 });
}

export const GET = withModuleRoute('atendimento', moduleManifest)(handleGET);
export const POST = withModuleRoute('atendimento', moduleManifest)(handlePOST);
