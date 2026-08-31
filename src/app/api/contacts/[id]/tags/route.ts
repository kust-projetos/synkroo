/**
 * /api/contacts/[id]/tags — Task 5: gated + action-driven.
 * PUT → crm.atualizarTagsContato (body: { type, tags }).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runCrmAction } from '@/modules/crm/ui/route-adapter';
import { atualizarTagsContato } from '@/modules/crm/actions';

const updateTagsSchema = z.object({
  type: z.enum(['patient', 'lead']),
  tags: z.array(z.string()).default([]),
});

async function handlePUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = updateTagsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors },
      { status: 400 },
    );
  }
  const { id } = await params;
  return runCrmAction(atualizarTagsContato, {
    type: parsed.data.type,
    id,
    tags: parsed.data.tags,
  });
}

export const PUT = withModuleRoute('crm')(handlePUT);