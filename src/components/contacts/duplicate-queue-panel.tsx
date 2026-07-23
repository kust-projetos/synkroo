'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

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
  suggestions: SuggestionSummary[];
  onSelect?: (id: string) => void;
  isLoading?: boolean;
}

export function DuplicateQueuePanel({ suggestions, onSelect, isLoading }: DuplicateQueuePanelProps) {
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

  if (!suggestions.length) {
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
          {suggestions.map((s) => (
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
