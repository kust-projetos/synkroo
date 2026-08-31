/**
 * /dashboard/contatos — Task 6.
 *
 * Server component: checa o módulo CRM via createManifest(); se desabilitado,
 * chama notFound() (Gate 1 de @/core/modules/gates). Quando habilitado,
 * renderiza <ContactsClient/> que coordena split-view + duplicate queue.
 *
 * Importante: este arquivo NÃO toca DB nem actions. Toda a mutação acontece
 * via /api/contacts/* que já é gated pelo withModuleRoute (Task 5).
 */
import { notFound } from 'next/navigation';
import { createManifest } from '@/core/modules/manifest';
import { ContactsClient } from './contacts-client';

export const dynamic = 'force-dynamic';

export default async function ContatosPage() {
  const enabled = await createManifest().isEnabled('crm');
  if (!enabled) {
    notFound();
  }
  return <ContactsClient />;
}