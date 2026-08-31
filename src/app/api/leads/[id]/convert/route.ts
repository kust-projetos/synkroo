import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { converterLead } from '@/modules/comercial/actions/converter-lead';

const handlePost = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await request.json();
  return runComercialAction(converterLead, { leadId: id, patientId: body.patient_id });
};

export const POST = withModuleRoute('comercial')(handlePost);
