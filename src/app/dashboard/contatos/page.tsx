/**
 * /dashboard/contatos — Task 6.
 *
 * Server component: checa o módulo CRM via moduleManifest; se desabilitado,
 * chama notFound() (Gate 1 de @/core/modules/gates). Quando habilitado,
 * renderiza <ContactsClient/> que coordena split-view + duplicate queue.
 *
 * Importante: este arquivo NÃO toca DB nem actions. Toda a mutação acontece
 * via /api/contacts/* que já é gated pelo withModuleRoute (Task 5).
 */
import { notFound } from 'next/navigation';
import { moduleManifest } from '@/core/modules/manifest';
import { ContactsClient } from './contacts-client';

export default async function ContatosPage() {
  const enabled = await moduleManifest.isEnabled('crm');
  if (!enabled) {
    notFound();
  }
  return <ContactsClient />;
}