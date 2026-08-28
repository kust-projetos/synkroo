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
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id

  try {
    const body = await request.json()
    const validated = grantConsentSchema.parse(body)

    const consent = await grantConsent(clinicId, {
      contact_id: validated.contact_id,
      contact_type: validated.contact_type,
      purpose: validated.purpose,
      channel: validated.channel as ConsentChannel | undefined,
      notes: validated.notes,
    })

    return NextResponse.json(consent)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to grant consent' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id

  try {
    const body = await request.json()
    const validated = revokeConsentSchema.parse(body)

    const consent = await revokeConsent(
      clinicId,
      validated.contact_id,
      validated.contact_type,
      validated.purpose,
      validated.channel as ConsentChannel | undefined,
      validated.notes
    )

    return NextResponse.json(consent)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to revoke consent' }, { status: 500 })
  }
}