import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, endpoint, category, githubUrl, authRequired } = body

    // Validate required fields
    if (!name || !description || !endpoint || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, description, endpoint, category' },
        { status: 400 }
      )
    }

    // Create slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')

    // Check if MCP already exists
    const { data: existing } = await supabase
      .from('mcps')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'MCP with this name already exists' },
        { status: 409 }
      )
    }

    // Insert new MCP
    const { data, error } = await supabase
      .from('mcps')
      .insert([
        {
          name,
          slug,
          description,
          endpoint,
          category,
          github_url: githubUrl,
          auth_required: authRequired || false,
          source: 'published',
          verified: false,
          published_at: new Date().toISOString(),
          health_status: 'unknown'
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to publish MCP' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      mcp: data,
      message: 'MCP published successfully. It will be reviewed and validated shortly.'
    })

  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get recently published MCPs
    const { data, error } = await supabase
      .from('mcps')
      .select('id, name, slug, description, category, published_at, verified')
      .eq('source', 'published')
      .order('published_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return NextResponse.json({ mcps: data })
  } catch (error) {
    console.error('Error fetching published MCPs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch published MCPs' },
      { status: 500 }
    )
  }
}