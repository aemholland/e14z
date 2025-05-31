import { NextRequest, NextResponse } from 'next/server'
import { searchMCPs } from '@/lib/search/engine'
import { supabase } from '@/lib/supabase/client'
import type { SearchOptions } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  try {
    // Parse search parameters
    const query = searchParams.get('q') || ''
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
        // Core Identity
        id: result.mcp.id,
        slug: result.mcp.slug,
        name: result.mcp.name,
        description: result.mcp.description,
        category: result.mcp.category,
        tags: result.mcp.tags,
        verified: result.mcp.verified,
        
        // Installation & Setup (Critical for agents)
        installation: {
          primary_method: result.mcp.installation_methods?.[0] || {
            type: result.mcp.install_type,
            command: result.mcp.endpoint,
            priority: 1
          },
          alternative_methods: result.mcp.installation_methods?.slice(1) || [],
          prerequisites: result.mcp.installation_methods?.[0]?.requirements || [],
          configuration_required: result.mcp.auth_method !== 'none',
          auth_method: result.mcp.auth_method,
          setup_complexity: result.mcp.installation_methods?.length > 1 ? 'moderate' : 'simple'
        },
        
        // Tools & Capabilities (Essential for agents)
        tools: {
          count: result.mcp.tools?.length || 0,
          list: result.mcp.tools?.map(tool => ({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            input_schema: tool.parameters || {},
            complexity: tool.parameters?.length > 3 ? 'complex' : 'simple'
          })) || [],
          categories: [...new Set(result.mcp.tools?.map(t => t.category).filter(Boolean) || [])],
          primary_functions: result.mcp.tools?.slice(0, 3).map(t => t.name) || []
        },
        
        // Quality & Trust Signals
        quality: {
          verified: result.mcp.verified,
          health_status: result.mcp.health_status,
          last_health_check: result.mcp.last_health_check,
          relevance_score: Math.round(result.relevanceScore),
          quality_score: Math.round(result.qualityScore),
          total_score: Math.round(result.totalScore),
          maintenance_status: result.mcp.updated_at > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() ? 'active' : 'stale'
        },
        
        // Performance (placeholder for future pulse data)
        performance: {
          avg_response_time_ms: null, // From pulse
          success_rate: null, // From pulse
          uptime_percentage: null, // From pulse
          last_performance_check: null
        },
        
        // Reviews & Community (placeholder for future review data)
        community: {
          review_count: 0, // From reviews table
          average_rating: null, // From reviews table
          recent_feedback: [], // Last 3 reviews
          usage_count: null // From analytics
        },
        
        // Documentation & Support
        resources: {
          github_url: result.mcp.github_url,
          documentation_url: result.mcp.documentation_url,
          website_url: result.mcp.website_url,
          has_examples: Boolean(result.mcp.use_cases?.length),
          support_available: Boolean(result.mcp.github_url),
          quick_start_available: Boolean(result.mcp.documentation_url)
        },
        
        // Business Information
        provider: {
          author: result.mcp.author,
          company: result.mcp.company,
          license: result.mcp.license,
          commercial: result.mcp.pricing_model !== 'free'
        },
        
        // Usage Guidance
        use_cases: result.mcp.use_cases || [],
        recommended_for: result.mcp.tags?.filter(tag => 
          ['beginner', 'advanced', 'enterprise', 'development', 'production'].includes(tag)
        ) || [],
        
        // Technical Details
        technical: {
          protocol_version: result.mcp.protocol_version,
          connection_type: result.mcp.connection_type,
          pricing_model: result.mcp.pricing_model,
          last_updated: result.mcp.updated_at,
          created_at: result.mcp.created_at
        }
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