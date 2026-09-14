import { NextRequest } from 'next/server'
import { eq, and, asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { tasks, leads } from '@/lib/db/schema'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiCreated, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const leadId = searchParams.get('lead_id')

  const auth = await validateApiAuth()
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const db = getDb()
  const conditions: any[] = [eq(tasks.clinicId, auth.profile!.clinic_id)]

  if (status && status !== 'all') conditions.push(eq(tasks.status, status))
  if (priority && priority !== 'all') conditions.push(eq(tasks.priority, priority))
  if (leadId) conditions.push(eq(tasks.leadId, leadId))

  const data = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      dueDate: tasks.dueDate,
      status: tasks.status,
      priority: tasks.priority,
      leadId: tasks.leadId,
      leadName: leads.name,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(leads, eq(leads.id, tasks.leadId))
    .where(and(...conditions))
    .orderBy(asc(tasks.dueDate))

  const mapped = data.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    due_date: t.dueDate,
    status: t.status,
    priority: t.priority,
    lead_id: t.leadId,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    leads: t.leadName ? { id: t.leadId, name: t.leadName } : null,
  }))

  return apiSuccess({ tasks: mapped })
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth()
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const body = await request.json()
  const { title, description, due_date, priority, lead_id } = body

  if (!title) {
    return apiFailure('INVALID_INPUT', 'Title is required', requestId, 400)
  }

  const db = getDb()
  const [task] = await db
    .insert(tasks)
    .values({
      clinicId: auth.profile!.clinic_id,
      title,
      description: description || null,
      dueDate: due_date ? new Date(due_date) : null,
      priority: priority || 'medium',
      leadId: lead_id || null,
      status: 'pending',
    } as any)
    .returning()

  return apiCreated({
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      due_date: task.dueDate,
      status: task.status,
      priority: task.priority,
      lead_id: task.leadId,
      created_at: task.createdAt,
    },
  })
}

export async function PUT(request: NextRequest) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth()
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const body = await request.json()
  const { id, status, priority, title, description, due_date, lead_id } = body

  if (!id) {
    return apiFailure('INVALID_INPUT', 'Task ID is required', requestId, 400)
  }

  const db = getDb()
  const updateData: Record<string, unknown> = {}
  if (status !== undefined) updateData.status = status
  if (priority !== undefined) updateData.priority = priority
  if (title !== undefined) updateData.title = title
  if (description !== undefined) updateData.description = description
  if (due_date !== undefined) updateData.dueDate = new Date(due_date)
  if (lead_id !== undefined) updateData.leadId = lead_id

  const [task] = await db
    .update(tasks)
    .set(updateData as any)
    .where(and(eq(tasks.id, id), eq(tasks.clinicId, auth.profile!.clinic_id)))
    .returning()

  if (!task) {
    return apiFailure('NOT_FOUND', 'Task not found', requestId, 404)
  }

  return apiSuccess({ task })
}

export async function DELETE(request: NextRequest) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth()
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return apiFailure('INVALID_INPUT', 'Task ID is required', requestId, 400)
  }

  const db = getDb()
  const [task] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.clinicId, auth.profile!.clinic_id)))
    .returning()

  if (!task) {
    return apiFailure('NOT_FOUND', 'Task not found', requestId, 404)
  }

  return apiSuccess({ success: true })
}
