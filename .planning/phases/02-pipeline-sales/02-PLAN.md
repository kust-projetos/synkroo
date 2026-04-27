---
wave: 1
depends_on: []
requirements:
  - PIPE-01
  - PIPE-02
  - PIPE-03
  - PIPE-04
  - PIPE-05
  - PIPE-06
  - PIPE-07
  - PIPE-08
files_modified: []
autonomous: false
---

# Phase 2 Plan: Pipeline & Sales

## Goal

Users can manage their sales pipeline visually with a customizable Kanban board, tracking leads from first contact to conversion with scoring and stage management.

## Background

Phase 1 built the unified contacts foundation. Phase 2 adds the sales pipeline Kanban board on top.

**Already exists:**
- `pipeline_stages` table seeded with odontologia defaults: new, contacted, qualified, proposal, negotiation, converted, lost (migration 20260424000002)
- `leads` table has `stage_id` FK pointing to `pipeline_stages`
- `leads.service.ts` has `calculateLeadScore`, `qualifyLead`, `convertLeadToPatient` fully implemented
- `contacts.service.ts` already joins leads to `pipeline_stages`

**NOT yet built:**
- `@hello-pangea/dnd` not installed
- No Kanban UI components
- No `stages.service.ts`
- No pipeline API routes (`/api/pipeline/stages`, `/api/leads/[id]/stage`)
- No `useKanban` hook
- PIPE-05 (WhatsApp lead capture) is stub-only (real impl deferred to Phase 3)

## Waves

| Wave | Tasks | Rationale |
|------|-------|-----------|
| Wave 1 | Install dnd lib, Kanban UI, useKanban hook | Kanban UI is the primary deliverable |
| Wave 2 | Stage CRUD API + service | Required for stage management |
| Wave 3 | Lead stage DnD endpoint, lead creation stub, WhatsApp stub | Wire everything together |

---

## Wave 1 — Kanban Board UI

### Task W1-T1: Install @hello-pangea/dnd

<read_first>
- D:/projetos/synkroo/package.json
</read_first>

<action>
Install `@hello-pangea/dnd` v18.0.1:

```bash
npm install @hello-pangea/dnd@18.0.1
```
</action>

<acceptance_criteria>
- package.json contains `"@hello-pangea/dnd": "^18.0.1"`
- `node_modules/@hello-pangea/dnd` directory exists
</acceptance_criteria>

---

### Task W1-T2: Create useKanban hook

<read_first>
- D:/projetos/synkroo/src/services/leads/leads.service.ts
- D:/projetos/synkroo/src/lib/hooks/use-queries.ts
</read_first>

<action>
Create `src/hooks/use-kanban.ts` with the following exact signature:

```typescript
'use client'
import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { DropResult } from '@hello-pangea/dnd'

interface UseKanbanBoardOptions {
  onError?: (error: Error) => void
}

export function useKanbanBoard(options: UseKanbanBoardOptions = {}) {
  const queryClient = useQueryClient()

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result
      if (!destination) return
      if (destination.droppableId === source.droppableId && destination.index === source.index) return

      const newStageId = destination.droppableId
      const leadId = draggableId

      // Optimistic update
      queryClient.setQueriesData({ queryKey: ['kanban-leads'] }, (old: any) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            leads: page.leads.map((lead: any) =>
              lead.id === leadId ? { ...lead, stage_id: newStageId } : lead
            ),
          })),
        }
      })

      // Server update via PATCH /api/leads/[id]/stage
      try {
        const res = await fetch(`/api/leads/${leadId}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage_id: newStageId }),
        })
        if (!res.ok) throw new Error('Failed to update lead stage')
        queryClient.invalidateQueries({ queryKey: ['kanban-leads'] })
      } catch (error) {
        queryClient.invalidateQueries({ queryKey: ['kanban-leads'] })
        options.onError?.(error as Error)
      }
    },
    [queryClient, options]
  )

  return { onDragEnd }
}
```

Also add to `src/lib/hooks/use-queries.ts`:

```typescript
// Kanban leads query
export async function fetchKanbanLeads(clinicId: string) {
  const supabase = await createTypedClient()
  const { data, error } = await supabase
    .from('leads')
    .select(`
      id, name, phone, email, source, temperature, score,
      stage_id, interest, last_contact_at, created_at,
      pipeline_stages (id, name, color, sort_order)
    `)
    .eq('clinic_id', clinicId)
    .order('score', { ascending: false })

  if (error) throw error
  return data ?? []
}

export function useKanbanLeads(clinicId: string) {
  return useQuery({
    queryKey: ['kanban-leads', clinicId],
    queryFn: () => fetchKanbanLeads(clinicId),
    enabled: !!clinicId,
  })
}

export function usePipelineStages(clinicId: string) {
  return useQuery({
    queryKey: ['pipeline-stages', clinicId],
    queryFn: async () => {
      const supabase = await createTypedClient()
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!clinicId,
  })
}
```
</action>

<acceptance_criteria>
- `src/hooks/use-kanban.ts` exists with `useKanbanBoard` function exporting `onDragEnd`
- `src/lib/hooks/use-queries.ts` exports `useKanbanLeads` and `usePipelineStages`
- `onDragEnd` calls `PATCH /api/leads/${leadId}/stage` with `{ stage_id }`
- Optimistic update is applied before server call
</acceptance_criteria>

---

### Task W1-T3: Build KanbanBoard component

<read_first>
- D:/projetos/synkroo/src/components/ui/badge.tsx
- D:/projetos/synkroo/tailwind.config.ts (for color tokens)
</read_first>

<action>
Create `src/components/pipeline/kanban-board.tsx`:

```typescript
'use client'
import { DragDropContext } from '@hello-pangea/dnd'
import { useKanbanBoard } from '@/hooks/use-kanban'
import { usePipelineStages, useKanbanLeads } from '@/lib/hooks/use-queries'
import { StageColumn } from './stage-column'

interface KanbanBoardProps {
  clinicId: string
}

export function KanbanBoard({ clinicId }: KanbanBoardProps) {
  const { onDragEnd } = useKanbanBoard()
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages(clinicId)
  const { data: leads = [], isLoading: leadsLoading } = useKanbanLeads(clinicId)

  if (stagesLoading || leadsLoading) {
    return <div className="flex gap-4 overflow-x-auto pb-4"><KanbanSkeleton /></div>
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            leads={leads.filter((l: any) => l.stage_id === stage.id)}
          />
        ))}
      </div>
    </DragDropContext>
  )
}

function KanbanSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-72 flex-shrink-0 bg-muted rounded-lg animate-pulse h-96" />
      ))}
    </>
  )
}
```
</action>

<acceptance_criteria>
- `src/components/pipeline/kanban-board.tsx` exists
- Renders `DragDropContext` with horizontal scrolling columns
- One `StageColumn` per pipeline stage
- Shows loading skeleton when data is loading
</acceptance_criteria>

---

### Task W1-T4: Build StageColumn component

<read_first>
- D:/projetos/synkroo/src/components/ui/badge.tsx
</read_first>

<action>
Create `src/components/pipeline/stage-column.tsx`:

```typescript
'use client'
import { Droppable } from '@hello-pangea/dnd'
import { LeadCard } from './lead-card'

interface StageColumnProps {
  stage: {
    id: string
    name: string
    color: string
    sort_order: number
  }
  leads: any[]
}

export function StageColumn({ stage, leads }: StageColumnProps) {
  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-muted/40 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium text-sm">{stage.name}</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 min-h-[200px] transition-colors ${
              snapshot.isDraggingOver ? 'bg-muted/80' : ''
            }`}
          >
            {leads.map((lead, index) => (
              <LeadCard key={lead.id} lead={lead} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}
```
</action>

<acceptance_criteria>
- `src/components/pipeline/stage-column.tsx` exists
- `Droppable` component with `droppableId={stage.id}`
- Shows stage name, color dot, and lead count in header
- Highlight background when dragging over
</acceptance_criteria>

---

### Task W1-T5: Build LeadCard component

<read_first>
- D:/projetos/synkroo/src/components/ui/badge.tsx
</read_first>

<action>
Create `src/components/pipeline/lead-card.tsx`:

```typescript
'use client'
import { Draggable } from '@hello-pangea/dnd'
import { Badge } from '@/components/ui/badge'

interface LeadCardProps {
  lead: {
    id: string
    name: string
    phone: string
    email?: string | null
    source: string
    temperature: 'cold' | 'warm' | 'hot'
    score: number
    interest?: string | null
    last_contact_at?: string | null
  }
  index: number
}

const temperatureColors = {
  cold: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  warm: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  hot: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const sourceLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  web: 'Web',
  referral: 'Indicação',
  campaign: 'Campanha',
  other: 'Outro',
}

export function LeadCard({ lead, index }: LeadCardProps) {
  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-card border border-border rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing transition-shadow ${
            snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : 'hover:shadow-sm'
          }`}
        >
          {/* Name and temperature */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="font-medium text-sm truncate">{lead.name}</span>
            <Badge
              className={`text-xs px-1.5 py-0.5 ${temperatureColors[lead.temperature]}`}
            >
              {lead.score}
            </Badge>
          </div>

          {/* Contact info */}
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>{lead.phone}</div>
            {lead.email && <div className="truncate">{lead.email}</div>}
          </div>

          {/* Interest */}
          {lead.interest && (
            <div className="mt-2 text-xs text-muted-foreground bg-muted rounded px-2 py-1 truncate">
              {lead.interest}
            </div>
          )}

          {/* Source */}
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">
              {sourceLabels[lead.source] ?? lead.source}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  )
}
```
</action>

<acceptance_criteria>
- `src/components/pipeline/lead-card.tsx` exists
- `Draggable` with `draggableId={lead.id}` and `index`
- Shows lead name, phone, email, source, temperature badge, score
- `Draggable` wrapper with `innerRef`, `draggableProps`, `dragHandleProps`
- Visual feedback when dragging (shadow + ring)
</acceptance_criteria>

---

## Wave 2 — Stage CRUD API

### Task W2-T1: Create stages.service.ts

<read_first>
- D:/projetos/synkroo/src/services/leads/leads.service.ts (for service pattern)
</read_first>

<action>
Create `src/services/pipeline/stages.service.ts`:

```typescript
import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export interface PipelineStage {
  id: string
  clinic_id: string
  name: string
  color: string
  sort_order: number
  is_default: boolean
  created_at: string
}

/**
 * Get all pipeline stages for a clinic ordered by sort_order
 */
export async function getPipelineStages(clinicId: string): Promise<PipelineStage[]> {
  const supabase = await createTypedClient()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('sort_order', { ascending: true })

  if (error) {
    dbLogger.error('Error fetching pipeline stages', error)
    throw error
  }
  return data as PipelineStage[]
}

/**
 * Create a new pipeline stage
 */
export async function createPipelineStage(params: {
  clinicId: string
  name: string
  color: string
  sortOrder?: number
}): Promise<PipelineStage> {
  const supabase = await createTypedClient()

  // Get max sort_order if not provided
  let sortOrder = params.sortOrder
  if (sortOrder === undefined) {
    const { data: existing } = await supabase
      .from('pipeline_stages')
      .select('sort_order')
      .eq('clinic_id', params.clinicId)
      .order('sort_order', { ascending: false })
      .limit(1)
    sortOrder = (existing?.[0]?.sort_order ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      clinic_id: params.clinicId,
      name: params.name,
      color: params.color,
      sort_order: sortOrder,
      is_default: false,
    })
    .select()
    .single()

  if (error) {
    dbLogger.error('Error creating pipeline stage', error)
    throw error
  }

  dbLogger.info('Pipeline stage created', { stageId: data.id, name: params.name })
  return data as PipelineStage
}

/**
 * Update a pipeline stage
 */
export async function updatePipelineStage(
  stageId: string,
  params: { name?: string; color?: string; sort_order?: number }
): Promise<PipelineStage> {
  const supabase = await createTypedClient()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq('id', stageId)
    .select()
    .single()

  if (error) {
    dbLogger.error('Error updating pipeline stage', error)
    throw error
  }
  return data as PipelineStage
}

/**
 * Delete a pipeline stage (only if no leads are assigned)
 */
export async function deletePipelineStage(stageId: string): Promise<void> {
  const supabase = await createTypedClient()

  // Check for leads in this stage
  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('stage_id', stageId)

  if (count && count > 0) {
    throw new Error(`Cannot delete stage with ${count} leads assigned. Reassign them first.`)
  }

  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', stageId)

  if (error) {
    dbLogger.error('Error deleting pipeline stage', error)
    throw error
  }

  dbLogger.info('Pipeline stage deleted', { stageId })
}

/**
 * Reorder stages: update sort_order for multiple stages in one transaction
 */
export async function reorderPipelineStages(
  stageOrders: { id: string; sort_order: number }[]
): Promise<void> {
  const supabase = await createTypedClient()

  // Update each stage's sort_order
  const updates = stageOrders.map(({ id, sort_order }) =>
    supabase
      .from('pipeline_stages')
      .update({ sort_order, updated_at: new Date().toISOString() })
      .eq('id', id)
  )

  const results = await Promise.all(updates)
  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    dbLogger.error('Error reordering stages', errors)
    throw new Error('Failed to reorder stages')
  }
}

/**
 * Seed default odontologia pipeline for a new clinic
 */
export async function seedDefaultPipelineStages(clinicId: string): Promise<void> {
  const supabase = await createTypedClient()

  const defaults = [
    { name: 'Novo', color: '#3B82F6', sort_order: 1 },    // blue
    { name: 'Contatado', color: '#8B5CF6', sort_order: 2 }, // purple
    { name: 'Qualificado', color: '#F59E0B', sort_order: 3 }, // amber
    { name: 'Proposta', color: '#10B981', sort_order: 4 },  // emerald
    { name: 'Negociação', color: '#F97316', sort_order: 5 }, // orange
    { name: 'Convertido', color: '#22C55E', sort_order: 6 }, // green
    { name: 'Perdido', color: '#EF4444', sort_order: 7 },   // red
  ]

  const inserts = defaults.map((stage) =>
    supabase.from('pipeline_stages').insert({
      clinic_id: clinicId,
      name: stage.name,
      color: stage.color,
      sort_order: stage.sort_order,
      is_default: true,
    })
  )

  await Promise.all(inserts)
  dbLogger.info('Default odontologia pipeline stages seeded', { clinicId })
}
```
</action>

<acceptance_criteria>
- `src/services/pipeline/stages.service.ts` exists with all 6 exported functions
- `getPipelineStages(clinicId)` returns ordered stages
- `deletePipelineStage` checks for leads before deleting and throws with message
- `seedDefaultPipelineStages` inserts 7 default stages with correct colors
</acceptance_criteria>

---

### Task W2-T2: Create pipeline stages API routes

<read_first>
- D:/projetos/synkroo/src/app/api/leads/route.ts (for route pattern)
</read_first>

<action>
Create `src/app/api/pipeline/stages/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getPipelineStages, createPipelineStage } from '@/services/pipeline/stages.service'

// GET /api/pipeline/stages -- list all stages for clinic
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const clinicId = user.clinic_id
    if (!clinicId) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

    const stages = await getPipelineStages(clinicId)
    return NextResponse.json({ data: stages })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/pipeline/stages -- create new stage
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, color, sort_order } = body

    if (!name || !color) {
      return NextResponse.json({ error: 'name and color are required' }, { status: 400 })
    }

    const stage = await createPipelineStage({
      clinicId: user.clinic_id,
      name,
      color,
      sortOrder: sort_order,
    })

    return NextResponse.json({ data: stage }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

Create `src/app/api/pipeline/stages/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { updatePipelineStage, deletePipelineStage } from '@/services/pipeline/stages.service'

// PUT /api/pipeline/stages/[id] -- update stage
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { name, color, sort_order } = body

    const stage = await updatePipelineStage(id, { name, color, sort_order })
    return NextResponse.json({ data: stage })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/pipeline/stages/[id] -- delete stage
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await deletePipelineStage(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    const status = error.message.includes('Cannot delete') ? 400 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
```

Create `src/app/api/pipeline/stages-order/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { reorderPipelineStages } from '@/services/pipeline/stages.service'

// PATCH /api/pipeline/stages-order -- bulk reorder stages
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { stages } = body // Array of { id, sort_order }

    if (!Array.isArray(stages)) {
      return NextResponse.json({ error: 'stages array required' }, { status: 400 })
    }

    await reorderPipelineStages(stages)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```
</action>

<acceptance_criteria>
- `src/app/api/pipeline/stages/route.ts` has GET and POST handlers
- `src/app/api/pipeline/stages/[id]/route.ts` has PUT and DELETE handlers
- `src/app/api/pipeline/stages-order/route.ts` has PATCH handler for bulk reorder
- All routes use `getAuthUser()` and return 401 if unauthorized
- DELETE returns 400 if leads are assigned to the stage
</acceptance_criteria>

---

## Wave 3 — DnD Endpoint, Lead Creation, WhatsApp Stub

### Task W3-T1: Lead stage update endpoint (DnD wiring)

<read_first>
- D:/projetos/synkroo/src/services/leads/leads.service.ts (updateLeadStatus function)
</read_first>

<action>
Create `src/app/api/leads/[id]/stage/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createTypedClient } from '@/lib/supabase/typed'

// PATCH /api/leads/[id]/stage -- update lead's stage_id (DnD endpoint)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { stage_id } = body

    if (!stage_id) {
      return NextResponse.json({ error: 'stage_id is required' }, { status: 400 })
    }

    // Verify the stage belongs to the user's clinic
    const supabase = await createTypedClient()
    const { data: stage, error: stageError } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('id', stage_id)
      .eq('clinic_id', user.clinic_id)
      .single()

    if (stageError || !stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Update lead's stage
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .update({ stage_id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('clinic_id', user.clinic_id) // Ensure lead belongs to clinic
      .select()
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ data: lead })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```
</action>

<acceptance_criteria>
- `src/app/api/leads/[id]/stage/route.ts` exists with PATCH handler
- Validates stage belongs to user's clinic before updating
- Uses `eq('clinic_id', user.clinic_id)` on both stage verification and lead update
- Returns 400 if stage_id missing, 404 if stage or lead not found
</acceptance_criteria>

---

### Task W3-T2: Lead convert endpoint (PIPE-08)

<read_first>
- D:/projetos/synkroo/src/services/leads/leads.service.ts (convertLeadToPatient)
</read_first>

<action>
Create `src/app/api/leads/[id]/convert/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { convertLeadToPatient } from '@/services/leads/leads.service'

// POST /api/leads/[id]/convert -- convert lead to patient
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { patient_id } = body

    if (!patient_id) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 })
    }

    const success = await convertLeadToPatient(id, patient_id)

    if (!success) {
      return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { lead_id: id, patient_id } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```
</action>

<acceptance_criteria>
- `src/app/api/leads/[id]/convert/route.ts` exists with POST handler
- Requires `patient_id` in body, returns 400 if missing
- Calls `convertLeadToPatient(id, patient_id)` from leads.service.ts
</acceptance_criteria>

---

### Task W3-T3: WhatsApp lead capture stub (PIPE-05)

<read_first>
- D:/projetos/synkroo/src/app/api/whatsapp/webhook/route.ts (for webhook pattern)
</read_first>

<action>
Create `src/app/api/whatsapp/lead-capture/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createLead } from '@/services/leads/leads.service'

/**
 * WhatsApp lead capture endpoint (stub for Phase 3)
 *
 * Phase 3 will implement the real WhatsApp message parsing and lead creation.
 * This stub queues leads for manual review or skips with a 202 response.
 *
 * POST body: { phone, name?, message, clinic_id }
 */
export async function POST(req: NextRequest) {
  try {
    // Accept both authenticated and webhook (unauthenticated) calls
    let user = await getAuthUser().catch(() => null)

    const body = await req.json()
    const { phone, name, message, clinic_id } = body

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 })
    }

    // Use provided clinic_id or fall back to authenticated user's clinic
    const targetClinicId = clinic_id || user?.clinic_id

    if (!targetClinicId) {
      return NextResponse.json({ error: 'clinic_id required' }, { status: 400 })
    }

    // Stub: Log and return 202 Accepted
    // Real implementation in Phase 3: parse message, extract intent, create lead
    console.info('[PIPE-05 STUB] WhatsApp lead capture', {
      phone,
      name: name ?? 'Unknown',
      clinicId: targetClinicId,
    })

    return NextResponse.json(
      {
        accepted: true,
        stub: true,
        message: 'Lead capture from WhatsApp will be implemented in Phase 3',
      },
      { status: 202 }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```
</action>

<acceptance_criteria>
- `src/app/api/whatsapp/lead-capture/route.ts` exists with POST handler
- Returns 202 Accepted with `{ stub: true, message: '...' }`
- Logs lead capture attempt with phone and clinic_id
</acceptance_criteria>

---

## Integration Checklist

After all waves complete, verify:

- [ ] `@hello-pangea/dnd` installed and importable
- [ ] `useKanbanBoard` hook works (optimistic update + fetch to PATCH endpoint)
- [ ] `KanbanBoard` renders all stages with their leads
- [ ] Drag a lead card to another column calls `PATCH /api/leads/[id]/stage`
- [ ] `GET /api/pipeline/stages` returns stages ordered by sort_order
- [ ] `POST /api/pipeline/stages` creates a new stage
- [ ] `PUT /api/pipeline/stages/[id]` updates a stage
- [ ] `DELETE /api/pipeline/stages/[id]` deletes a stage (fails if leads exist)
- [ ] `PATCH /api/pipeline/stages-order` reorders stages
- [ ] `POST /api/leads/[id]/convert` calls `convertLeadToPatient`
- [ ] `POST /api/whatsapp/lead-capture` returns 202 stub
- [ ] PIPE-01: Kanban board renders with stages and leads
- [ ] PIPE-02: Drag-and-drop updates lead stage
- [ ] PIPE-03: Stage CRUD operations work
- [ ] PIPE-04: Default stages seeded for new clinics (via seedDefaultPipelineStages)
- [ ] PIPE-05: WhatsApp stub endpoint exists (202 response)
- [ ] PIPE-06: Lead creation via contacts.service.ts (already implemented)
- [ ] PIPE-07: Lead scoring via leads.service.ts calculateLeadScore (already implemented)
- [ ] PIPE-08: Lead-to-patient conversion via /api/leads/[id]/convert

## must_haves

These MUST be true to consider Phase 2 complete:

1. Kanban board renders all pipeline stages with their leads
2. Drag-and-drop moves a lead from one stage to another and persists to database
3. Stage CRUD API routes exist and are protected by auth
4. Lead stage DnD endpoint validates clinic ownership of both stage and lead
5. Lead-to-patient conversion endpoint exists and calls convertLeadToPatient
6. WhatsApp lead capture stub returns 202 Accepted
