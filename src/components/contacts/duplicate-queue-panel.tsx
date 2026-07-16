'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useDuplicateSuggestions } from '@/lib/hooks/use-queries';

export interface SuggestionSummary {
  id: string;
  ownerType: string;
  duplicateScore: number;
  confidence: string;
  status: string;
  leftSnapshot: { id: string; name?: string };
  rightSnapshot: { id: string; name?: string };
  detectedAt: Date | string;
}

interface DuplicateQueuePanelProps {
  onSelect?: (id: string) => void;
}

/**
 * Task 6: usa useDuplicateSuggestions (não array literal) para puxar a
 * fila real de sugestões pendentes. Mantém compatibilidade de props
 * opcional `onSelect` para o consumidor selecione uma sugestão.
 */
export function DuplicateQueuePanel({ onSelect }: DuplicateQueuePanelProps = {}) {
  const { data, isLoading } = useDuplicateSuggestions({ status: 'pending' });

  const rows: SuggestionSummary[] = Array.isArray(data)
    ? (data as SuggestionSummary[])
    : (((data as any)?.data as SuggestionSummary[]) ?? []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Possíveis duplicidades</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!rows.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Possíveis duplicidades</CardTitle></CardHeader>
        <CardContent>
          <EmptyState title="Sem sugestões de duplicidade pendentes." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Possíveis duplicidades</CardTitle></CardHeader>
      <CardContent>
        <ul className="divide-y" role="list" aria-label="Lista de duplicidades">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 py-3 cursor-pointer hover:bg-muted/50 px-2 rounded"
              onClick={() => onSelect?.(s.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect?.(s.id)}
              tabIndex={0}
              role="button"
              aria-label={`Sugestão entre ${s.leftSnapshot.name ?? s.leftSnapshot.id} e ${s.rightSnapshot.name ?? s.rightSnapshot.id}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">{s.leftSnapshot.name ?? s.leftSnapshot.id}</span>
                <span className="text-muted-foreground">&harr;</span>
                <span className="font-medium">{s.rightSnapshot.name ?? s.rightSnapshot.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={s.confidence === 'high' ? 'default' : 'secondary'}>
                  {s.duplicateScore}
                </Badge>
                <Badge variant="outline">{s.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}