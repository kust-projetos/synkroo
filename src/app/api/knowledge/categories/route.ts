import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

/**
 * GET /api/knowledge/categories
 * List all categories used in knowledge base
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const supabase = await createTypedClient()

    const { data, error } = await supabase
      .from('knowledge_base')
      .select('category')
      .eq('clinic_id', clinicId)
      .eq('is_active', true) as { data: Array<{ category: string }> | null; error: any }

    if (error) {
      dbLogger.error('Error fetching categories', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    // Get unique categories with counts
    const categoryMap = new Map<string, number>()
    for (const item of data || []) {
      const count = categoryMap.get(item.category) || 0
      categoryMap.set(item.category, count + 1)
    }

    const categories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ categories })
  } catch (error) {
    dbLogger.error('Categories fetch error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}