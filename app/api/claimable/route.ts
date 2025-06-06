import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get MCPs that are not claimed and have GitHub URLs
    const { data, error } = await supabase
      .from('mcps')
      .select('id, name, slug, description, github_url, npm_url, category, tools, health_status')
      .is('claimed_by', null)
      .not('github_url', 'is', null)
      .neq('source', 'published') // Exclude user-published MCPs
      .order('name')
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Also get total count for pagination
    const { count } = await supabase
      .from('mcps')
      .select('*', { count: 'exact', head: true })
      .is('claimed_by', null)
      .not('github_url', 'is', null)
      .neq('source', 'published')

    return NextResponse.json({
      mcps: data,
      total: count,
      limit,
      offset
    })

  } catch (error) {
    console.error('Error fetching claimable MCPs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claimable MCPs' },
      { status: 500 }
    )
  }
}