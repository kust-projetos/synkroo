/**
 * /api/contacts/[id]/appointments — Task 5: CRM-gated, patient-only.
 *
 *  - CRM disabled → 404 (via withModuleRoute).
 *  - Apenas type=patient é suportado. type=lead/operacional/outros → 404
 *    (sem leak — não diferencia "lead não tem appointments" de "lead não
 *    pertence à clínica").
 *  - Patient → action operacional.listarConsultas com page:1, limit:50
 *    enforced server-side (não aceita valores do cliente).
 *  - Sem imports legados de drizzle/validateApiAuth/services.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runCrmAction } from '@/modules/crm/ui/route-adapter';
import { listarConsultas } from '@/modules/operacional/actions/listar-consultas';

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { searchParams } = new URL(request.url);
  const typeRaw = searchParams.get('type');
  // Aceita patient | lead | operacional como tipos "conhecidos" para
  // distinguir unknown (→ 400) de known-but-not-supported (→ 404, sem leak).
  if (
    typeRaw !== 'patient' &&
    typeRaw !== 'lead' &&
    typeRaw !== 'operacional'
  ) {
    return NextResponse.json(
      { error: 'type query parameter required (patient|lead)' },
      { status: 400 },
    );
  }
  if (typeRaw !== 'patient') {
    // lead / operacional → 404 sem leak.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const { id } = await params;
  return runCrmAction(listarConsultas, {
    patientId: id,
    page: 1,
    limit: 50,
  });
}

export const GET = withModuleRoute('crm')(handleGET);