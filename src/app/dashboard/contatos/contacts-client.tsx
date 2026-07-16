/**
 * contacts-client.tsx (Task 6)
 *
 * Client component para o dashboard /contatos.
 *
 * Envolve o split-view com a fila de duplicidades. Toda a busca passa
 * pelos hooks do CRM (useContacts / useContactNotes / useContactTimeline
 * / useDuplicateSuggestions / useAddContactNote / useUpdateContactTags) —
 * sem arrays literais como estado inicial.
 */
'use client';

import { ContactSplitView } from '@/components/contacts/contact-split-view';
import { DuplicateQueuePanel } from '@/components/contacts/duplicate-queue-panel';

export function ContactsClient() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold mb-4">Contatos</h1>
      </div>
      <div className="flex-1 grid grid-rows-[auto_1fr] gap-4 px-6 pb-6 min-h-0">
        <DuplicateQueuePanel />
        <div className="min-h-0">
          <ContactSplitView />
        </div>
      </div>
    </div>
  );
}