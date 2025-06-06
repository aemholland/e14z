import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkForDuplicates, generateSlug } from '@/lib/utils/public-deduplication'
// import { withAPM } from '@/lib/observability/apm-middleware-simple' // Commented out to fix build

async function submitHandler(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const {
      name,
      description,
      endpoint,
      connection_type = 'stdio',
      category,
      tags = [],
      github_url,
      documentation_url,
      website_url,
      auth_method = 'none',
      pricing_model = 'free',
      pricing_details = {},
      author,
      company,
      license,
      protocol_version = '2024-11-05',
      capabilities
    } = body

    // Validate required fields
    if (!name || !description || !endpoint || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, description, endpoint, category' },
        { status: 400 }
      )
    }

    // Validate connection type
    if (!['stdio', 'http', 'websocket'].includes(connection_type)) {
      return NextResponse.json(
        { error: 'connection_type must be one of: stdio, http, websocket' },
        { status: 400 }
      )
    }

    // Generate slug from name, author, and verified status
    const slug = generateSlug(name, author, false) // Submissions are unverified by default

    // Comprehensive duplicate check
    const duplicateCheck = await checkForDuplicates({
      name,
      endpoint,
      github_url,
      slug
    })

    if (duplicateCheck.isDuplicate) {
      return NextResponse.json(
        { 
          error: duplicateCheck.reason,
          duplicate_type: duplicateCheck.duplicateType,
          existing_mcp: duplicateCheck.existingMCP
        },
        { status: 409 }
      )
    }

    const userAgent = request.headers.get('user-agent') || ''
    const submittedBy = extractAgentType(userAgent)

    // Insert new MCP (unverified by default)
    const { data: mcp, error: insertError } = await supabase
      .from('mcps')
      .insert({
        slug,
        name,
        description,
        endpoint,
        connection_type,
        auth_method,
        protocol_version,
        category,
        tags,
        verified: false, // All submissions start unverified
        github_url,
        documentation_url,
        website_url,
        pricing_model,
        pricing_details,
        author,
        company,
        license,
        discovery_source: 'submission',
        auto_discovered: false
      })
      .select()
      .single()

    if (insertError) {
      console.error('MCP insertion error:', insertError)
      return NextResponse.json(
        { error: 'Failed to submit MCP', details: insertError.message },
        { status: 500 }
      )
    }

    // Log the submission for analytics
    try {
      await supabase.from('api_calls').insert({
        endpoint: '/api/submit',
        method: 'POST',
        query: name,
        filters: { category, connection_type },
        results_count: 1,
        results_mcp_ids: [mcp.id],
        user_agent: userAgent,
        agent_type: submittedBy,
        session_id: crypto.randomUUID()
      })
    } catch (logError) {
      console.error('Failed to log submission:', logError)
      // Don't fail the submission if logging fails
    }

    return NextResponse.json({
      message: 'MCP submitted successfully',
      mcp: {
        id: mcp.id,
        slug: mcp.slug,
        name: mcp.name,
        verified: false,
        url: `https://e14z.com/mcp/${mcp.slug}`
      },
      next_steps: [
        'Your MCP has been submitted for review',
        'It will appear in search results once verified',
        'Verification typically takes 1-2 business days',
        'You can track status at the URL above'
      ]
    })

  } catch (err) {
    console.error('Submit API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function extractAgentType(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  
  if (ua.includes('claude')) return 'claude'
  if (ua.includes('gpt') || ua.includes('openai')) return 'openai'
  if (ua.includes('gemini')) return 'gemini'
  if (ua.includes('anthropic')) return 'anthropic'
  if (ua.includes('python')) return 'python-script'
  if (ua.includes('curl')) return 'curl'
  if (ua.includes('postman')) return 'postman'
  if (ua.includes('bot')) return 'bot'
  
  return 'unknown'
}

// Export the handler directly (APM middleware disabled)
export const POST = submitHandler;