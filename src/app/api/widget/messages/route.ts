import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/widget/messages
 * Chat widget messages — legacy agent removed.
 * TODO(W5.3): reconnect to new agent.
 */
export async function GET() {
  return NextResponse.json({
    conversation_id: null,
    messages: [],
    disabled: true,
    reason: 'legacy_agent_removed',
    todo: 'TODO(W5.3): reconnect to new agent',
  })
}

/**
 * POST /api/widget/messages
 * Chat widget send — legacy agent removed.
 * TODO(W5.3): reconnect to new agent.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    disabled: true,
    reason: 'legacy_agent_removed',
    todo: 'TODO(W5.3): reconnect to new agent',
  }, { status: 200 })
}
