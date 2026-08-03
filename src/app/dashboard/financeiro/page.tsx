/**
 * /dashboard/financeiro — Task 7.
 *
 * Server component: checa o módulo financeiro via moduleManifest;
 * se desabilitado, chama notFound(). Quando habilitado, renderiza
 * <FinanceiroDashboardClient/> que puxa dados reais via hooks CRM.
 */
import { notFound } from 'next/navigation';
import { moduleManifest } from '@/core/modules/manifest';
import { FinanceiroDashboardClient } from './financeiro-client';

export const dynamic = 'force-dynamic';

export default async function FinanceiroDashboardPage() {
  const enabled = await moduleManifest.isEnabled('financeiro');
  if (!enabled) {
    notFound();
  }
  return <FinanceiroDashboardClient />;
}