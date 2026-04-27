'use client'

import { useState } from 'react'
import { useContactNotes } from '@/lib/hooks/use-queries'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

interface ContactNotesTabProps {
  contactId: string
  contactType: 'patient' | 'lead'
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} dias`
  return date.toLocaleDateString('pt-BR')
}

export function ContactNotesTab({ contactId, contactType }: ContactNotesTabProps) {
  const queryClient = useQueryClient()
  const [noteContent, setNoteContent] = useState('')

  const { data, isLoading } = useContactNotes(contactId, contactType)

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/contacts/${contactId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: contactType, content }),
      })
      if (!res.ok) throw new Error('Failed to add note')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', contactId, 'notes', contactType] })
      setNoteContent('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return
    addNoteMutation.mutate(noteContent.trim())
  }

  const notes = data?.data ?? []

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={handleSubmit} className="p-3 border-b border-border space-y-2">
        <Textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Adicionar uma nota..."
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!noteContent.trim() || addNoteMutation.isPending}
          >
            {addNoteMutation.isPending ? 'Salvando...' : 'Adicionar nota'}
          </Button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : notes.length === 0 ? (
          <EmptyState
            title="Nenhuma nota adicionada"
            description="Adicione notas sobre este contato"
          />
        ) : (
          [...notes]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((note) => (
              <div key={note.id} className="p-3 rounded-lg border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {note.contact_type === 'patient' ? 'Paciente' : 'Lead'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(note.created_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                {note.created_by && (
                  <p className="text-xs text-muted-foreground">Por: {note.created_by}</p>
                )}
              </div>
            ))
        )}
      </div>
    </div>
  )
}
