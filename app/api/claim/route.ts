import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mcpId, githubUrl, verificationMethod } = body

    // Validate required fields
    if (!mcpId || !githubUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: mcpId, githubUrl' },
        { status: 400 }
      )
    }

    // Get MCP details
    const { data: mcp, error: mcpError } = await supabase
      .from('mcps')
      .select('*')
      .eq('id', mcpId)
      .single()

    if (mcpError || !mcp) {
      return NextResponse.json(
        { error: 'MCP not found' },
        { status: 404 }
      )
    }

    // Check if MCP is already claimed
    if (mcp.claimed_by) {
      return NextResponse.json(
        { error: 'MCP is already claimed' },
        { status: 409 }
      )
    }

    // Create claim request
    const { data: claim, error: claimError } = await supabase
      .from('mcp_claims')
      .insert([
        {
          mcp_id: mcpId,
          github_url: githubUrl,
          verification_method: verificationMethod || 'repository_access',
          status: 'pending',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (claimError) {
      console.error('Database error:', claimError)
      return NextResponse.json(
        { error: 'Failed to create claim request' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      claim,
      message: 'Claim request submitted. Please follow the verification instructions sent to your email.'
    })

  } catch (error) {
    console.error('Claim error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    // Get claim requests
    const { data, error } = await supabase
      .from('mcp_claims')
      .select(`
        *,
        mcps!inner(name, slug, description)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ claims: data })
  } catch (error) {
    console.error('Error fetching claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claims' },
      { status: 500 }
    )
  }
}