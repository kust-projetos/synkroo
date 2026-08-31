/**
 * /dashboard/financeiro — Task 7.
 *
 * Server component: checa o módulo financeiro via createManifest();
 * se desabilitado, chama notFound(). Quando habilitado, renderiza
 * <FinanceiroDashboardClient/> que puxa dados reais via hooks CRM.
 */
import { notFound } from 'next/navigation';
import { createManifest } from '@/core/modules/manifest';
import { FinanceiroDashboardClient } from './financeiro-client';

export const dynamic = 'force-dynamic';

export default async function FinanceiroDashboardPage() {
  const enabled = await createManifest().isEnabled('financeiro');
  if (!enabled) {
    notFound();
  }
  return <FinanceiroDashboardClient />;
}