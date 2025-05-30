import { NextRequest, NextResponse } from 'next/server'
import { searchMCPs } from '@/lib/search/engine'
import { supabase } from '@/lib/supabase/client'
import type { SearchOptions } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  try {
    // Parse search parameters
    const query = searchParams.get('q') || ''
    const category = searchParams.get('category')
    const pricing = searchParams.get('pricing') as 'free' | 'paid' | null
    const verified = searchParams.get('verified') === 'true' ? true : undefined
    const healthStatus = searchParams.get('health') as 'healthy' | 'degraded' | 'down' | null
    const minRating = searchParams.get('minRating') ? parseInt(searchParams.get('minRating')!) : undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100) // Max 100 results
    const offset = parseInt(searchParams.get('offset') || '0')

    // Generate session ID for tracking
    const sessionId = crypto.randomUUID()

    // Build search options
    const searchOptions: SearchOptions = {
      query,
      filters: {
        ...(category && { category }),
        ...(pricing && { pricing }),
        ...(verified !== undefined && { verified }),
        ...(healthStatus && { healthStatus }),
        ...(minRating && { minRating })
      },
      limit,
      offset
    }

    // Perform search
    const { results, total, error } = await searchMCPs(searchOptions)

    if (error) {
      return NextResponse.json(
        { error: 'Search failed', details: error },
        { status: 500 }
      )
    }

    // Log API call for analytics
    const userAgent = request.headers.get('user-agent') || ''
    const agentType = extractAgentType(userAgent)
    
    try {
      await supabase.from('api_calls').insert({
        endpoint: '/api/discover',
        method: 'GET',
        query,
        filters: searchOptions.filters,
        results_count: results.length,
        results_mcp_ids: results.map(r => r.mcp.id),
        user_agent: userAgent,
        agent_type: agentType,
        session_id: sessionId,
        response_time_ms: null // Will be calculated on the client side if needed
      })
    } catch (logError) {
      console.error('Failed to log API call:', logError)
      // Don't fail the request if logging fails
    }

    // Format response
    const response = {
      query,
      results: results.map(result => ({
        id: result.mcp.id,
        slug: result.mcp.slug,
        name: result.mcp.name,
        description: result.mcp.description,
        endpoint: result.mcp.endpoint,
        category: result.mcp.category,
        tags: result.mcp.tags,
        
        connection: {
          type: result.mcp.connection_type,
          auth_method: result.mcp.auth_method,
          protocol_version: result.mcp.protocol_version
        },
        
        tools: result.mcp.tools?.map(tool => ({
          name: tool.name,
          description: tool.description,
          category: tool.category,
          parameters: tool.parameters || []
        })) || [],
        tool_count: result.mcp.tools?.length || 0,
        
        pricing: {
          model: result.mcp.pricing_model,
          details: result.mcp.pricing_details
        },
        
        health: {
          status: result.mcp.health_status,
          last_check: result.mcp.last_health_check
        },
        
        stats: {
          relevance_score: result.relevanceScore,
          quality_score: result.qualityScore,
          health_score: result.healthScore,
          total_score: result.totalScore
        },
        
        verified: result.mcp.verified,
        github_url: result.mcp.github_url,
        documentation_url: result.mcp.documentation_url,
        website_url: result.mcp.website_url,
        use_cases: result.mcp.use_cases,
        
        metadata: {
          author: result.mcp.author,
          company: result.mcp.company,
          license: result.mcp.license,
          created_at: result.mcp.created_at,
          updated_at: result.mcp.updated_at
        },
        
        installation_methods: result.mcp.installation_methods,
        install_type: result.mcp.install_type,
        last_active: result.mcp.updated_at
      })),
      total_results: total,
      filters_applied: searchOptions.filters,
      session_id: sessionId,
      pagination: {
        limit,
        offset,
        has_more: offset + results.length < total
      },
      post_usage_action: {
        instruction: "After using any MCP, submit a review to help improve discovery",
        endpoint: "POST https://e14z.com/api/review",
        required_data: {
          session_id: sessionId,
          mcp_id: "[id of MCP used]",
          rating: "[1-10 based on experience]",
          success: "[true/false]",
          latency_ms: "[observed latency]",
          error_count: "[number of errors]"
        }
      }
    }

    return NextResponse.json(response)

  } catch (err) {
    console.error('API error:', err)
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