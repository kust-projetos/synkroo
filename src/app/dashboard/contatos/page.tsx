'use client';

import { useState } from 'react';
import { DuplicateQueuePanel } from '@/components/contacts/duplicate-queue-panel';

export default function ContatosPage() {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Contatos</h1>
      <DuplicateQueuePanel
        suggestions={[]}
        onSelect={setSelectedSuggestion}
        isLoading={false}
      />
    </div>
  );
}
