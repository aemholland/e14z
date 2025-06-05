/**
 * Enhanced E14Z API Discovery Endpoint
 * Same structure as MCP endpoint - comprehensive data for agents
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { QualityScoreCalculator } from '@/lib/scoring/quality-algorithm'
import { ReviewScoreCalculator } from '@/lib/scoring/review-algorithm'
import { withAPM } from '@/lib/observability/apm-middleware'
import { withLogging } from '@/lib/logging/middleware'

const qualityCalculator = new QualityScoreCalculator()
const reviewCalculator = new ReviewScoreCalculator()

async function enhancedDiscoverHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // Parse enhanced search parameters
  const query = searchParams.get('q') || ''
  const category = searchParams.get('category')
  const healthStatus = searchParams.get('health_status')
  const minQualityScore = searchParams.get('min_quality_score') ? parseInt(searchParams.get('min_quality_score')!) : undefined
  const minReviewScore = searchParams.get('min_review_score') ? parseInt(searchParams.get('min_review_score')!) : undefined
  const authRequired = searchParams.get('auth_required') === 'true' ? true : 
                      searchParams.get('auth_required') === 'false' ? false : undefined
  const verifiedOnly = searchParams.get('verified_only') === 'true'
  const includePerformance = searchParams.get('include_performance') !== 'false'
  const includeTools = searchParams.get('include_tools') !== 'false'
  const includeReviews = searchParams.get('include_reviews') !== 'false'
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
  const offset = parseInt(searchParams.get('offset') || '0')

  // Generate session ID for tracking
  const sessionId = crypto.randomUUID()

  try {
    // Build comprehensive query
    let dbQuery = supabase
      .from('mcps')
      .select(`
        *,
        ${includeReviews ? 'reviews(rating, success, created_at, review_text)' : ''}
      `)

    // Apply filters
    if (query.trim()) {
      const formattedQuery = query.trim().split(/\s+/).join(' & ')
      dbQuery = dbQuery.textSearch('search_vector', formattedQuery)
    }

    if (category) dbQuery = dbQuery.eq('category', category)
    if (healthStatus) dbQuery = dbQuery.eq('health_status', healthStatus)
    if (verifiedOnly) dbQuery = dbQuery.eq('verified', true)
    if (authRequired !== undefined) {
      dbQuery = authRequired 
        ? dbQuery.neq('auth_method', 'none')
        : dbQuery.eq('auth_method', 'none')
    }

    // Execute query with pagination
    const { data: mcps, error, count } = await dbQuery
      .range(offset, offset + limit - 1)
      .order('overall_score', { ascending: false, nullsLast: true })

    if (error) {
      return NextResponse.json(
        { error: 'Enhanced search failed', details: error.message },
        { status: 500 }
      )
    }

    if (!mcps) {
      return NextResponse.json({
        query,
        results: [],
        total_results: 0,
        pagination: { limit, offset, has_more: false }
      })
    }

    // Process results with enhanced data
    const enhancedResults = await Promise.all(
      mcps.map(async (mcp) => await enhanceMCPData(mcp, includePerformance, includeTools, includeReviews))
    )

    // Filter by scores if specified
    const filteredResults = enhancedResults.filter(mcp => {
      if (minQualityScore && (mcp.scoring.quality_score || 0) < minQualityScore) return false
      if (minReviewScore && (mcp.scoring.review_score || 0) < minReviewScore) return false
      return true
    })

    // Log API call
    await logEnhancedAPICall(request, query, category, filteredResults.length, sessionId)

    // Build enhanced response
    const response = {
      query,
      results: filteredResults.map(mcp => ({
        // === CORE IDENTITY ===
        id: mcp.id,
        slug: mcp.slug,
        name: mcp.name,
        description: mcp.description,

        // === CATEGORIZATION ===
        category: mcp.category,
        tags: mcp.tags,
        use_cases: mcp.use_cases,

        // === CONNECTION & SETUP ===
        connection: mcp.connection,
        installation: {
          command: mcp.connection.command, // Now shows: e14z run {slug}
          original_command: mcp.connection.original_command,
          auth_method: mcp.connection.auth_method,
          auth_required: mcp.connection.auth_required,
          setup_complexity: mcp.connection.setup_complexity,
          instructions: mcp.metadata.documentation_url,
          proxy_benefits: mcp.connection.proxy_info?.benefits
        },

        // === HEALTH & RELIABILITY ===
        health: mcp.health,
        
        // === QUALITY & SCORING ===
        scoring: mcp.scoring,
        quality_summary: mcp.scoring.quality_score ? 
          qualityCalculator.generateQualitySummary({
            total_score: mcp.scoring.quality_score,
            breakdown: {}
          }) : null,

        // === TOOLS & CAPABILITIES ===
        ...(includeTools && {
          tools: {
            count: mcp.tools?.length || 0,
            working_count: mcp.tools?.filter(t => t.working === true).length || 0,
            list: mcp.tools || [],
            server_capabilities: mcp.server_capabilities,
            available_resources: mcp.available_resources,
            prompt_templates: mcp.prompt_templates
          }
        }),

        // === PERFORMANCE ===
        ...(includePerformance && {
          performance: mcp.performance
        }),

        // === USER FEEDBACK ===
        ...(includeReviews && {
          user_feedback: mcp.user_feedback
        }),

        // === METADATA ===
        metadata: mcp.metadata,

        // === AGENT GUIDANCE ===
        agent_guidance: {
          recommended: (mcp.scoring.quality_score || 0) >= 70 && mcp.health.status === 'healthy',
          confidence: calculateOverallConfidence(mcp),
          usage_tips: generateUsageTips(mcp),
          alternatives_suggested: (mcp.scoring.quality_score || 0) < 60
        }
      })),

      // === RESPONSE METADATA ===
      total_results: count || filteredResults.length,
      filters_applied: {
        query,
        category,
        health_status: healthStatus,
        min_quality_score: minQualityScore,
        min_review_score: minReviewScore,
        auth_required: authRequired,
        verified_only: verifiedOnly
      },
      
      // === PAGINATION ===
      pagination: {
        limit,
        offset,
        has_more: offset + filteredResults.length < (count || filteredResults.length)
      },

      // === DATA COMPLETENESS ===
      data_included: {
        performance_metrics: includePerformance,
        tool_schemas: includeTools,
        user_reviews: includeReviews,
        quality_scoring: true,
        real_time_health: true
      },

      // === AGENT INSTRUCTIONS ===
      usage_guidance: {
        session_id: sessionId,
        connection_method: 'Use e14z run {slug} - E14Z acts as a proxy runner for all MCPs',
        recommendation: 'Use quality_score and health.status for filtering. E14Z handles installation and authentication automatically.',
        workflow: [
          '1. Filter MCPs by quality_score and health.status',
          '2. Connect via: e14z run {slug}',
          '3. E14Z handles installation and authentication',
          '4. Use MCP tools through E14Z session management',
          '5. Submit review for other agents'
        ],
        review_after_use: {
          endpoint: 'POST /api/review',
          required_fields: ['mcp_id', 'rating', 'success'],
          helps: 'Submitting reviews improves discovery for all agents'
        }
      },

      // === METADATA ===
      timestamp: new Date().toISOString(),
      api_version: '2.0.0',
      response_time_ms: null // Will be filled by middleware
    }

    return NextResponse.json(response)

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    
    console.error('Enhanced discover API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Enhanced discovery failed',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

async function enhanceMCPData(mcp: any, includePerformance = true, includeTools = true, includeReviews = true) {
  // Calculate quality score if pulse data available
  let qualityScore = null
  if (mcp.mcp_protocol_data && Object.keys(mcp.mcp_protocol_data).length > 0) {
    qualityScore = qualityCalculator.calculateQualityScore(mcp, mcp.mcp_protocol_data)
  }

  // Calculate review score if reviews available
  let reviewScore = null
  if (includeReviews && mcp.reviews) {
    reviewScore = await reviewCalculator.calculateReviewScore(mcp.id, mcp.reviews)
  }

  // Build enhanced MCP object (same structure as MCP endpoint)
  return {
    id: mcp.id,
    slug: mcp.slug,
    name: mcp.name,
    description: mcp.description,
    category: mcp.category,
    tags: mcp.tags || [],
    use_cases: mcp.use_cases || [],

    connection: {
      type: 'e14z-proxy',
      command: `e14z run ${mcp.slug}`,
      original_command: mcp.auto_install_command || mcp.install_command,
      protocol_version: mcp.protocol_version || '2024-11-05',
      auth_method: mcp.auth_method || 'none',
      auth_required: mcp.auth_required || false,
      setup_complexity: 'simple', // E14Z proxy simplifies setup
      proxy_info: {
        description: 'E14Z acts as a proxy runner - agents use e14z run {slug} instead of direct MCP connections',
        benefits: ['Unified interface', 'Automatic installation', 'Authentication handling', 'Session management']
      }
    },

    health: {
      status: mcp.health_status || 'unknown',
      last_check: mcp.last_pulse_check,
      verified: mcp.verified || false,
      uptime_percentage: mcp.mcp_protocol_data?.health?.uptime_percentage || null
    },

    scoring: {
      quality_score: qualityScore?.total_score || mcp.pulse_quality_score || null,
      review_score: reviewScore?.total_score || mcp.review_score || null,
      overall_score: mcp.overall_score || null,
      quality_tier: qualityScore ? qualityCalculator.getQualityTier(qualityScore.total_score) : null,
      review_tier: reviewScore ? reviewCalculator.getReviewTier(reviewScore.total_score) : null
    },

    ...(includeTools && {
      tools: (mcp.mcp_protocol_data?.tools || mcp.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema || tool.input_schema,
        category: tool.category,
        working: mcp.working_tools?.includes(tool.name) || null,
        avg_response_time: mcp.mcp_protocol_data?.performance?.tool_response_times?.[tool.name] || null
      })),
      
      server_capabilities: mcp.mcp_protocol_data?.server_capabilities || {},
      available_resources: mcp.mcp_protocol_data?.resources || mcp.available_resources || [],
      prompt_templates: mcp.mcp_protocol_data?.prompts || mcp.prompt_templates || []
    }),

    ...(includePerformance && {
      performance: {
        avg_response_time_ms: mcp.mcp_protocol_data?.performance?.avg_response_time_ms || null,
        connection_success_rate: mcp.mcp_protocol_data?.performance?.connection_success_rate || null,
        error_rate: mcp.mcp_protocol_data?.performance?.error_rate || null,
        last_measured: mcp.mcp_protocol_data?.performance?.last_measured || null
      }
    }),

    ...(includeReviews && reviewScore && {
      user_feedback: {
        review_count: reviewScore.review_count,
        avg_rating: reviewCalculator.calculateAverageRating(mcp.reviews || []),
        success_rate: reviewCalculator.calculateOverallSuccessRate(mcp.reviews || []),
        confidence: reviewScore.confidence,
        latest_reviews: (mcp.reviews || [])
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3)
          .map((review: any) => ({
            rating: review.rating,
            success: review.success,
            summary: review.review_text?.substring(0, 100) + (review.review_text?.length > 100 ? '...' : ''),
            date: review.created_at
          }))
      }
    }),

    metadata: {
      author: mcp.author,
      company: mcp.company,
      license: mcp.license,
      github_url: mcp.github_url,
      documentation_url: mcp.documentation_url,
      website_url: mcp.website_url,
      created_at: mcp.created_at,
      updated_at: mcp.updated_at,
      discovery_source: mcp.discovery_source
    }
  }
}

function calculateOverallConfidence(mcp: any): string {
  let score = 0
  
  if (mcp.health.verified) score += 30
  if (mcp.health.status === 'healthy') score += 25
  if (mcp.scoring.quality_score && mcp.scoring.quality_score >= 80) score += 20
  if (mcp.user_feedback?.review_count >= 5) score += 15
  if (mcp.tools?.length >= 3) score += 10
  
  if (score >= 80) return 'very-high'
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  if (score >= 20) return 'low'
  return 'very-low'
}

function generateUsageTips(mcp: any): string[] {
  const tips = []
  
  // E14Z proxy simplifies connection
  tips.push(`Use: e14z run ${mcp.slug}`)
  
  if (mcp.connection.auth_required) {
    tips.push(`E14Z handles ${mcp.connection.auth_method} authentication automatically`)
  } else {
    tips.push('No authentication needed - ready to use immediately')
  }
  
  if (mcp.performance?.avg_response_time_ms) {
    if (mcp.performance.avg_response_time_ms < 200) {
      tips.push('Very fast response times')
    } else if (mcp.performance.avg_response_time_ms > 1000) {
      tips.push('Slower response times - allow extra time')
    }
  }
  
  if (mcp.tools?.length > 0) {
    const workingTools = mcp.tools.filter((t: any) => t.working === true)
    if (workingTools.length > 0) {
      tips.push(`${workingTools.length} tools verified working`)
    }
  }
  
  tips.push('E14Z provides session management and error handling')
  
  return tips
}

async function logEnhancedAPICall(request: NextRequest, query: string, category: string | undefined, resultCount: number, sessionId: string) {
  try {
    await supabase.from('api_calls').insert({
      endpoint: '/api/discover/enhanced',
      method: 'GET',
      query,
      filters: { category, enhanced: true },
      results_count: resultCount,
      user_agent: request.headers.get('user-agent') || '',
      agent_type: extractAgentType(request.headers.get('user-agent') || ''),
      session_id: sessionId
    })
  } catch (error) {
    console.error('Failed to log enhanced API call:', error)
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
  return 'unknown'
}

// Export the handler wrapped with APM and logging middleware
export const GET = withAPM(withLogging(enhancedDiscoverHandler), {
  trackQueries: true,
  trackCache: true,
  sampleRate: 1.0
})