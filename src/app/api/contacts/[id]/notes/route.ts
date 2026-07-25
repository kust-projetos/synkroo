/**
 * /api/contacts/[id]/notes — Task 5: gated + action-driven.
 * GET → crm.listarNotasContato (type obrigatório, 400 se ausente/inválido).
 * POST → crm.adicionarNotaContato (body: { type, content }).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runCrmAction } from '@/modules/crm/ui/route-adapter';
import {
  listarNotasContato,
  adicionarNotaContato,
} from '@/modules/crm/actions';

const addNoteSchema = z.object({
  type: z.enum(['patient', 'lead']),
  content: z.string().min(1),
});

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { searchParams } = new URL(request.url);
  const typeRaw = searchParams.get('type');
  if (typeRaw !== 'patient' && typeRaw !== 'lead') {
    return NextResponse.json(
      { error: 'type query parameter required (patient|lead)' },
      { status: 400 },
    );
  }
  const { id } = await params;
  return runCrmAction(listarNotasContato, { type: typeRaw, id });
}

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = addNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors },
      { status: 400 },
    );
  }
  const { id } = await params;
  return runCrmAction(adicionarNotaContato, {
    type: parsed.data.type,
    id,
    content: parsed.data.content,
  });
}

export const GET = withModuleRoute('crm', moduleManifest)(handleGET);
export const POST = withModuleRoute('crm', moduleManifest)(handlePOST);