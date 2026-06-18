import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'

/**
 * GET /api/knowledge/[id]
 * Legacy RAG service removed — returns 404.
 * TODO(W5.3): reconnect to new agent/RAG.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })

    return NextResponse.json({
      error: 'Knowledge base disabled — legacy RAG service removed',
      reason: 'legacy_rag_removed',
      todo: 'TODO(W5.3): reconnect to new agent/RAG',
    }, { status: 404 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * PUT /api/knowledge/[id]
 * Legacy RAG service removed — returns 503.
 * TODO(W5.3): reconnect to new agent/RAG.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })

    return NextResponse.json({
      error: 'Knowledge base disabled — legacy RAG service removed',
      reason: 'legacy_rag_removed',
      todo: 'TODO(W5.3): reconnect to new agent/RAG',
    }, { status: 503 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * DELETE /api/knowledge/[id]
 * Legacy RAG service removed — returns 503.
 * TODO(W5.3): reconnect to new agent/RAG.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })

    return NextResponse.json({
      error: 'Knowledge base disabled — legacy RAG service removed',
      reason: 'legacy_rag_removed',
      todo: 'TODO(W5.3): reconnect to new agent/RAG',
    }, { status: 503 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
