'use client'

import { useState, useMemo } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/lib/hooks/use-queries'
import { useLeads } from '@/lib/hooks/use-queries'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluida',
  cancelled: 'Cancelada',
}

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

const statusBadgeTypes: Record<TaskStatus, 'info' | 'teal' | 'success' | 'zinc'> = {
  pending: 'info',
  in_progress: 'teal',
  completed: 'success',
  cancelled: 'zinc',
}

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

export default function TarefasPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as TaskPriority,
    lead_id: '',
  })

  const { data: tasksData, isLoading } = useTasks({
    status: statusFilter,
    priority: priorityFilter,
  })
  const { data: leadsData } = useLeads()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const tasks = tasksData?.tasks || []
  const leads = leadsData?.leads || []

  const filteredTasks = useMemo(() => {
    return tasks
  }, [tasks])

  const stats = useMemo(() => {
    const total = tasks.length
    const pending = tasks.filter((t: any) => t.status === 'pending').length
    const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length
    const completed = tasks.filter((t: any) => t.status === 'completed').length
    const overdue = tasks.filter(
      (t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed' && t.status !== 'cancelled'
    ).length
    return { total, pending, inProgress, completed, overdue }
  }, [tasks])

  const handleSubmit = async () => {
    if (!formData.title) {
      setError('Titulo e obrigatorio')
      return
    }
    try {
      setSubmitting(true)
      setError(null)

      await createTask.mutateAsync({
        title: formData.title,
        description: formData.description || undefined,
        due_date: formData.due_date || undefined,
        priority: formData.priority,
        lead_id: formData.lead_id || undefined,
      })

      setDialogOpen(false)
      setFormData({ title: '', description: '', due_date: '', priority: 'medium', lead_id: '' })
    } catch {
      setError('Erro ao criar tarefa')
    } finally {
      setSubmitting(false)
    }
  }

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateTask.mutateAsync({ id: taskId, status: newStatus })
    } catch (err) {
      console.error('Error updating task:', err)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return
    try {
      await deleteTask.mutateAsync(taskId)
    } catch (err) {
      console.error('Error deleting task:', err)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR')
  }

  const isOverdue = (task: any) => {
    if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') return false
    return new Date(task.due_date) < new Date()
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Tarefas"
        description="Gerencie suas tarefas e follow-ups"
        action={
          <Button onClick={() => setDialogOpen(true)} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600">
            <PlusIcon className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
          <div className="text-sm text-muted-foreground">Pendentes</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-teal-600">{stats.inProgress}</div>
          <div className="text-sm text-muted-foreground">Em Andamento</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-muted-foreground">Concluidas</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-muted-foreground">Atrasadas</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Status</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as TaskStatus | 'all')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Prioridade</label>
            <Select
              value={priorityFilter}
              onValueChange={(v) => setPriorityFilter(v as TaskPriority | 'all')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tasks Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : tasks.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={<CheckCircleIcon className="h-8 w-8 text-teal-600" />}
            title="Nenhuma tarefa encontrada"
            description={statusFilter !== 'all' || priorityFilter !== 'all'
              ? "Nenhuma tarefa corresponde aos filtros selecionados."
              : "Crie sua primeira tarefa para comecar a gerenciar seu trabalho."}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Tarefa</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Lead</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Prioridade</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map((task: any) => (
                  <tr
                    key={task.id}
                    className={`hover:bg-muted/50 ${isOverdue(task) ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">{task.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.lead_name ? (
                        <span className="text-sm text-foreground">{task.lead_name}</span>
                      ) : task.lead_id ? (
                        <span className="text-sm text-muted-foreground">#{task.lead_id.slice(0, 8)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {formatDate(task.due_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${priorityColors[task.priority as TaskPriority]}`} />
                        <span className="text-sm text-muted-foreground">{priorityLabels[task.priority as TaskPriority]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                        className="text-xs border-0 bg-transparent cursor-pointer"
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-xs text-red-600 hover:text-red-700 hover:underline"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Titulo *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Digite o titulo da tarefa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descricao</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalhes da tarefa..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data de vencimento</label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prioridade</label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v as TaskPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vincular Lead</label>
              <Select
                value={formData.lead_id}
                onValueChange={(v) => setFormData({ ...formData, lead_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um lead (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {leads.map((lead: any) => (
                    <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {submitting ? 'Salvando...' : 'Salvar Tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}