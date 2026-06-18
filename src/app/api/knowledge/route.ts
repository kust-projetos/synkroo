import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'

/**
 * GET /api/knowledge
 * List knowledge base entries.
 * Legacy RAG service removed — returns empty list.
 * TODO(W5.3): reconnect to new agent/RAG.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })

    return NextResponse.json({
      data: [],
      reason: 'legacy_rag_removed',
      todo: 'TODO(W5.3): reconnect to new agent/RAG',
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * POST /api/knowledge
 * Create knowledge entry.
 * Legacy RAG service removed — returns 503.
 * TODO(W5.3): reconnect to new agent/RAG.
 */
export async function POST(request: NextRequest) {
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
