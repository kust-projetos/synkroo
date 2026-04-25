import { getUserProfile } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/pipeline/kanban-board'

export default async function PipelinePage() {
  const profile = await getUserProfile()
  const clinicId = profile?.clinic_id ?? ''

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold">Pipeline de Vendas</h1>
        <p className="text-sm text-muted-foreground">Gerencie seus leads e acompanhe o progresso</p>
      </div>
      <div className="flex-1 overflow-hidden p-6">
        <KanbanBoard clinicId={clinicId} />
      </div>
    </div>
  )
}