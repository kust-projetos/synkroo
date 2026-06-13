import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { handleApiError, DatabaseError } from '@/lib/errors'

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
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('knowledge_base')
      .select('category')
      .eq('clinic_id', clinicId)
      .eq('is_active', true) as { data: Array<{ category: string }> | null; error: any }

    if (error) {
      return handleApiError(new DatabaseError('Failed to fetch categories', error as any))
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
    return handleApiError(error)
  }
}