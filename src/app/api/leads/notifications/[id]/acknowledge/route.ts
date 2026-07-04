import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { reconhecerNotificacao } from '@/modules/comercial/actions/reconhecer-notificacao';

/**
 * PUT /api/leads/notifications/[id]/acknowledge — Mark notification as acknowledged.
 */
const handlePut = async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return runComercialAction(reconhecerNotificacao, { notificationId: id });
};

export const PUT = withModuleRoute('comercial', moduleManifest)(handlePut);
