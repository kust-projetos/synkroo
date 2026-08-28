import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getConsentsForContact, grantConsent, revokeConsent } from '@/services/contacts/consents.service'
import type { ConsentPurpose, ConsentChannel } from '@/services/contacts/consents.service'
import { z } from 'zod'

const consentPurposeSchema = z.enum(['data_collection', 'marketing', 'whatsapp_communication'])
const consentChannelSchema = z.enum(['web', 'whatsapp', 'manual'])

const grantConsentSchema = z.object({
  contact_id: z.string().uuid(),
  contact_type: z.enum(['patient', 'lead']),
  purpose: consentPurposeSchema,
  channel: consentChannelSchema.optional(),
  notes: z.string().optional(),
})

const revokeConsentSchema = z.object({
  contact_id: z.string().uuid(),
  contact_type: z.enum(['patient', 'lead']),
  purpose: consentPurposeSchema,
  channel: consentChannelSchema.optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { buildUserContext } = await import('@/core/actions/context');
  const { runAction } = await import('@/core/actions/run');
  const { listarConsentimentos } = await import('@/modules/crm/actions/listar-consentimentos');
  try {
    const ctx = await buildUserContext();
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');
    const contactType = searchParams.get('contact_type') as 'patient' | 'lead' | null;
    if (!contactId || !contactType) {
      return NextResponse.json({ error: 'contact_id and contact_type query parameters are required' }, { status: 400 });
    }
    const result = await runAction(listarConsentimentos, contactType === 'patient' ? { patientId: contactId } : { leadId: contactId } as any, ctx);
    if (!result.ok) {
      const status = result.error.code === 'not_found' ? 404 : result.error.code === 'forbidden' ? 403 : 400;
      return NextResponse.json({ error: result.error.message }, { status });
    }
    return NextResponse.json({ data: (result.data as any).data ?? result.data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch consents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { buildUserContext } = await import('@/core/actions/context');
  const { runAction } = await import('@/core/actions/run');
  const { concederConsentimento } = await import('@/modules/crm/actions/conceder-consentimento');
  try {
    const ctx = await buildUserContext();
    const body = await request.json();
    const validated = grantConsentSchema.parse(body);
    const result = await runAction(concederConsentimento, {
      patientId: validated.contact_type === 'patient' ? validated.contact_id : undefined,
      leadId: validated.contact_type === 'lead' ? validated.contact_id : undefined,
      purpose: validated.purpose,
    } as any, ctx);
    if (!result.ok) {
      const status = result.error.code === 'not_found' ? 404 : result.error.code === 'forbidden' ? 403 : 400;
      return NextResponse.json({ error: result.error.message }, { status });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to grant consent' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { buildUserContext } = await import('@/core/actions/context');
  const { runAction } = await import('@/core/actions/run');
  const { revogarConsentimento } = await import('@/modules/crm/actions/revogar-consentimento');
  try {
    const ctx = await buildUserContext();
    const body = await request.json();
    const validated = revokeConsentSchema.parse(body);
    // revogarConsentimento expects consentId, but legacy uses contact_id+purpose — lookup first via listar
    const { getDb } = await import('@/lib/db/client');
    const { consents } = await import('@/lib/db/schema/infra');
    const { eq, and } = await import('drizzle-orm');
    const db = getDb();
    const [existing] = await db.select().from(consents).where(and(eq(consents.contactId, validated.contact_id), eq(consents.contactType, validated.contact_type), eq(consents.purpose, validated.purpose))).limit(1);
    if (!existing) return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    const result = await runAction(revogarConsentimento, { consentId: existing.id }, ctx);
    if (!result.ok) {
      const status = result.error.code === 'not_found' ? 404 : 403;
      return NextResponse.json({ error: result.error.message }, { status });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to revoke consent' }, { status: 500 });
  }
}