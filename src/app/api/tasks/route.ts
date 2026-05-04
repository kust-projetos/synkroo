import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const leadId = searchParams.get('lead_id')

  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select('*, leads(id, name)')
    .order('due_date', { ascending: true, nullsFirst: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (priority && priority !== 'all') {
    query = query.eq('priority', priority)
  }
  if (leadId) {
    query = query.eq('lead_id', leadId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tasks: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  const { data: userData } = await supabase.auth.getUser()
  const clinicId = userData.user?.id

  if (!clinicId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, description, due_date, priority, lead_id } = body

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      clinic_id: clinicId,
      title,
      description,
      due_date,
      priority: priority || 'medium',
      lead_id,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task: data }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  const { id, status, priority, title, description, due_date, lead_id } = body

  if (!id) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (status !== undefined) updateData.status = status
  if (priority !== undefined) updateData.priority = priority
  if (title !== undefined) updateData.title = title
  if (description !== undefined) updateData.description = description
  if (due_date !== undefined) updateData.due_date = due_date
  if (lead_id !== undefined) updateData.lead_id = lead_id

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task: data })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}