'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useContactDuplicateSuggestion, type DuplicateTabSuggestion } from '@/lib/hooks/use-queries';

export type { DuplicateTabSuggestion };

interface DuplicateTabProps {
  contactId: string;
  contactType: 'patient' | 'lead';
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMerge?: (id: string) => void;
  isExecuting?: boolean;
}

function hasDocumentConflict(s: DuplicateTabSuggestion): boolean {
  const leftDoc = s.leftSnapshot?.document;
  const rightDoc = s.rightSnapshot?.document;
  return Boolean(leftDoc && rightDoc && leftDoc !== rightDoc);
}

function DuplicateComparison({
  suggestion,
  onApprove,
  onDismiss,
  onMerge,
  isExecuting,
}: {
  suggestion: DuplicateTabSuggestion;
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMerge?: (id: string) => void;
  isExecuting?: boolean;
}) {
  const blockedByDoc = hasDocumentConflict(suggestion);
  const canApprove = suggestion.status === 'pending' || suggestion.status === 'failed';
  const canMerge = suggestion.status === 'approved' && !blockedByDoc && !isExecuting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparação de duplicidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded border p-3">
            <p className="font-semibold">{suggestion.leftSnapshot.name ?? 'Registro A'}</p>
            <p className="text-sm text-muted-foreground">ID: {suggestion.leftSnapshot.id}</p>
          </div>
          <div className="rounded border p-3">
            <p className="font-semibold">{suggestion.rightSnapshot.name ?? 'Registro B'}</p>
            <p className="text-sm text-muted-foreground">ID: {suggestion.rightSnapshot.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={suggestion.confidence === 'high' ? 'default' : 'secondary'}>
            Score: {suggestion.duplicateScore}
          </Badge>
          <Badge variant="outline">{suggestion.confidence}</Badge>
          <Badge variant="outline">{suggestion.status}</Badge>
        </div>

        {blockedByDoc && (
          <p className="text-sm text-destructive" role="alert">
            Bloqueado: documentos divergentes entre os registros.
          </p>
        )}

        <div className="flex gap-2">
          {canApprove && (
            <Button size="sm" onClick={() => onApprove?.(suggestion.id)} disabled={isExecuting}>
              Aprovar
            </Button>
          )}
          {canMerge && (
            <Button size="sm" onClick={() => onMerge?.(suggestion.id)} disabled={isExecuting}>
              {isExecuting ? 'Executando...' : 'Mesclar'}
            </Button>
          )}
          {(suggestion.status === 'pending' || suggestion.status === 'approved' || suggestion.status === 'failed') && (
            <Button size="sm" variant="outline" onClick={() => onDismiss?.(suggestion.id)} disabled={isExecuting}>
              Dispensar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DuplicateTab({
  contactId,
  contactType,
  onApprove,
  onDismiss,
  onMerge,
  isExecuting,
}: DuplicateTabProps) {
  const { selected, isLoading, error } = useContactDuplicateSuggestion(contactId, contactType);

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Erro ao carregar duplicidades.
      </p>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!selected) {
    return (
      <EmptyState
        title="Sem duplicidades"
        description="Nenhuma duplicidade encontrada para este contato."
      />
    );
  }

  return (
    <DuplicateComparison
      suggestion={selected}
      onApprove={onApprove}
      onDismiss={onDismiss}
      onMerge={onMerge}
      isExecuting={isExecuting}
    />
  );
}
