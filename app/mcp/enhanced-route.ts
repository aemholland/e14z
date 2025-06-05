import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { QualityScoreCalculator } from '@/lib/scoring/quality-algorithm'
import { ReviewScoreCalculator } from '@/lib/scoring/review-algorithm'

/**
 * Enhanced E14Z MCP Protocol Server
 * Priority interface for AI agents discovering MCPs
 * Provides comprehensive, structured data for intelligent MCP selection
 */

const qualityCalculator = new QualityScoreCalculator()
const reviewCalculator = new ReviewScoreCalculator()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jsonrpc, method, params, id } = body

    // Validate JSON-RPC format
    if (jsonrpc !== '2.0' || !method) {
      return createErrorResponse(-32600, 'Invalid Request', id)
    }

    switch (method) {
      case 'initialize':
        return handleInitialize(params, id)
      
      case 'tools/list':
        return handleToolsList(id)
      
      case 'tools/call':
        return handleToolsCall(params, id, request)
      
      case 'resources/list':
        return handleResourcesList(id)
      
      case 'resources/read':
        return handleResourcesRead(params, id)
      
      default:
        return createErrorResponse(-32601, 'Method not found', id)
    }

  } catch (err) {
    console.error('E14Z MCP Protocol error:', err)
    return createErrorResponse(-32603, 'Internal error', null)
  }
}

function handleInitialize(params: any, id: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false }
      },
      serverInfo: {
        name: 'E14Z Enhanced MCP Discovery Server',
        version: '2.0.0',
        description: 'Comprehensive MCP discovery with quality scoring and real-time health data',
        features: [
          'Real-time MCP health monitoring',
          'Quality scoring based on performance data',
          'User review aggregation',
          'Structured tool schemas for validation',
          'Performance optimization recommendations'
        ]
      }
    },
    id
  })
}

function handleToolsList(id: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      tools: [
        {
          name: 'discover_mcps',
          description: 'Discover MCPs with comprehensive quality data and real-time health status',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for MCP discovery'
              },
              category: {
                type: 'string',
                enum: ['payments', 'databases', 'content-creation', 'ai-tools', 'development-tools', 'cloud-storage', 'communication', 'infrastructure', 'productivity', 'project-management', 'security', 'social-media', 'web-apis', 'finance', 'research', 'iot', 'other'],
                description: 'Filter by MCP category'
              },
              health_status: {
                type: 'string',
                enum: ['healthy', 'degraded', 'down', 'unknown'],
                description: 'Filter by real-time health status'
              },
              min_quality_score: {
                type: 'number',
                minimum: 0,
                maximum: 100,
                description: 'Minimum quality score (0-100)'
              },
              min_review_score: {
                type: 'number',
                minimum: 0,
                maximum: 100,
                description: 'Minimum user review score (0-100)'
              },
              auth_required: {
                type: 'boolean',
                description: 'Filter by authentication requirement'
              },
              verified_only: {
                type: 'boolean',
                description: 'Only show verified MCPs'
              },
              limit: {
                type: 'number',
                minimum: 1,
                maximum: 50,
                default: 10,
                description: 'Maximum number of results'
              },
              include_performance: {
                type: 'boolean',
                default: true,
                description: 'Include real-time performance metrics'
              }
            }
          }
        },
        {
          name: 'get_mcp_details',
          description: 'Get comprehensive details for a specific MCP including all available data',
          inputSchema: {
            type: 'object',
            properties: {
              slug: {
                type: 'string',
                description: 'MCP slug identifier'
              },
              include_tools: {
                type: 'boolean',
                default: true,
                description: 'Include complete tool schemas'
              },
              include_performance: {
                type: 'boolean',
                default: true,
                description: 'Include performance metrics'
              },
              include_reviews: {
                type: 'boolean',
                default: true,
                description: 'Include review summary'
              }
            },
            required: ['slug']
          }
        },
        {
          name: 'submit_mcp_review',
          description: 'Submit comprehensive review after using an MCP',
          inputSchema: {
            type: 'object',
            properties: {
              mcp_id: {
                type: 'string',
                description: 'UUID of the MCP being reviewed'
              },
              rating: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                description: 'Overall rating from 1-10'
              },
              success: {
                type: 'boolean',
                description: 'Whether the MCP worked successfully'
              },
              performance_rating: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                description: 'Performance rating (speed, reliability)'
              },
              ease_of_use: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                description: 'How easy was it to use'
              },
              documentation_quality: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                description: 'Quality of documentation'
              },
              latency_ms: {
                type: 'number',
                description: 'Observed average latency in milliseconds'
              },
              tasks_completed: {
                type: 'number',
                description: 'Number of tasks completed successfully'
              },
              tasks_failed: {
                type: 'number',
                description: 'Number of tasks that failed'
              },
              error_count: {
                type: 'number',
                description: 'Total number of errors encountered'
              },
              use_case: {
                type: 'string',
                description: 'What you used the MCP for'
              },
              review_text: {
                type: 'string',
                description: 'Optional detailed review text'
              }
            },
            required: ['mcp_id', 'rating', 'success']
          }
        },
        {
          name: 'get_mcp_recommendations',
          description: 'Get MCP recommendations based on use case and requirements',
          inputSchema: {
            type: 'object',
            properties: {
              use_case: {
                type: 'string',
                description: 'Describe what you want to accomplish'
              },
              preferred_auth: {
                type: 'string',
                enum: ['none', 'api_key', 'oauth', 'any'],
                default: 'any',
                description: 'Preferred authentication method'
              },
              max_latency_ms: {
                type: 'number',
                description: 'Maximum acceptable latency in milliseconds'
              },
              min_reliability: {
                type: 'number',
                minimum: 0,
                maximum: 100,
                description: 'Minimum reliability score needed'
              },
              limit: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                default: 5,
                description: 'Number of recommendations'
              }
            },
            required: ['use_case']
          }
        }
      ]
    },
    id
  })
}

async function handleToolsCall(params: any, id: any, request: NextRequest) {
  const { name, arguments: args } = params

  try {
    switch (name) {
      case 'discover_mcps':
        return await handleDiscoverMCPs(args, id, request)
      
      case 'get_mcp_details':
        return await handleGetMCPDetails(args, id)
      
      case 'submit_mcp_review':
        return await handleSubmitMCPReview(args, id, request)
      
      case 'get_mcp_recommendations':
        return await handleGetMCPRecommendations(args, id)
      
      default:
        return createErrorResponse(-32601, `Unknown tool: ${name}`, id)
    }
  } catch (err) {
    console.error(`E14Z tool call error for ${name}:`, err)
    return createErrorResponse(-32603, `Tool execution failed: ${err}`, id)
  }
}

async function handleDiscoverMCPs(args: any, id: any, request: NextRequest) {
  const {
    query = '',
    category,
    health_status,
    min_quality_score,
    min_review_score,
    auth_required,
    verified_only,
    limit = 10,
    include_performance = true
  } = args

  // Build query
  let dbQuery = supabase
    .from('mcps')
    .select(`
      *,
      reviews(rating, success, created_at)
    `)

  // Apply filters
  if (query.trim()) {
    const formattedQuery = query.trim().split(/\s+/).join(' & ')
    dbQuery = dbQuery.textSearch('search_vector', formattedQuery)
  }

  if (category) dbQuery = dbQuery.eq('category', category)
  if (health_status) dbQuery = dbQuery.eq('health_status', health_status)
  if (verified_only) dbQuery = dbQuery.eq('verified', true)
  if (auth_required !== undefined) {
    dbQuery = auth_required 
      ? dbQuery.neq('auth_method', 'none')
      : dbQuery.eq('auth_method', 'none')
  }

  // Execute query
  const { data: mcps, error } = await dbQuery
    .limit(Math.min(limit, 50))
    .order('overall_score', { ascending: false, nullsLast: true })

  if (error) {
    return createErrorResponse(-32603, `Search failed: ${error.message}`, id)
  }

  // Process results with enhanced data
  const enhancedResults = await Promise.all(
    mcps.map(async (mcp) => await enhanceMCPData(mcp, include_performance))
  )

  // Filter by scores if specified
  const filteredResults = enhancedResults.filter(mcp => {
    if (min_quality_score && (mcp.quality_score?.total_score || 0) < min_quality_score) return false
    if (min_review_score && (mcp.review_score?.total_score || 0) < min_review_score) return false
    return true
  })

  // Log discovery
  await logDiscoveryCall(request, query, category, filteredResults.length)

  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      mcps: filteredResults,
      total_results: filteredResults.length,
      filters_applied: {
        query,
        category,
        health_status,
        min_quality_score,
        min_review_score,
        auth_required,
        verified_only
      },
      performance_data_included: include_performance,
      timestamp: new Date().toISOString()
    },
    id
  })
}

async function handleGetMCPDetails(args: any, id: any) {
  const { slug, include_tools = true, include_performance = true, include_reviews = true } = args

  const { data: mcp, error } = await supabase
    .from('mcps')
    .select(`
      *,
      ${include_reviews ? 'reviews(*)' : ''}
    `)
    .eq('slug', slug)
    .single()

  if (error || !mcp) {
    return createErrorResponse(-32602, `MCP not found: ${slug}`, id)
  }

  const enhancedMCP = await enhanceMCPData(mcp, include_performance, include_tools, include_reviews)

  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      mcp: enhancedMCP,
      timestamp: new Date().toISOString()
    },
    id
  })
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

  // Build enhanced MCP object
  const enhanced = {
    // === CORE IDENTITY ===
    id: mcp.id,
    slug: mcp.slug,
    name: mcp.name,
    description: mcp.description,

    // === CATEGORIZATION ===
    category: mcp.category,
    tags: mcp.tags || [],
    use_cases: mcp.use_cases || [],

    // === CONNECTION INFO (E14Z PROXY MODEL) ===
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

    // === HEALTH & STATUS ===
    health: {
      status: mcp.health_status || 'unknown',
      last_check: mcp.last_pulse_check,
      verified: mcp.verified || false,
      uptime_percentage: mcp.mcp_protocol_data?.health?.uptime_percentage || null
    },

    // === QUALITY SCORING ===
    scoring: {
      quality_score: qualityScore?.total_score || mcp.pulse_quality_score || null,
      review_score: reviewScore?.total_score || mcp.review_score || null,
      overall_score: mcp.overall_score || null,
      quality_tier: qualityScore?.tier || null,
      review_tier: reviewScore?.tier || null
    },

    // === TOOLS & CAPABILITIES ===
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

    // === PERFORMANCE DATA ===
    ...(includePerformance && {
      performance: {
        avg_response_time_ms: mcp.mcp_protocol_data?.performance?.avg_response_time_ms || null,
        connection_success_rate: mcp.mcp_protocol_data?.performance?.connection_success_rate || null,
        error_rate: mcp.mcp_protocol_data?.performance?.error_rate || null,
        last_measured: mcp.mcp_protocol_data?.performance?.last_measured || null
      }
    }),

    // === USER FEEDBACK ===
    ...(includeReviews && reviewScore && {
      user_feedback: {
        review_count: reviewScore.review_count,
        avg_rating: reviewCalculator.calculateAverageRating(mcp.reviews || []),
        success_rate: reviewCalculator.calculateOverallSuccessRate(mcp.reviews || []),
        confidence: reviewScore.confidence,
        recommendation: reviewScore.recommendation
      }
    }),

    // === METADATA ===
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

  return enhanced
}

async function handleSubmitMCPReview(args: any, id: any, request: NextRequest) {
  const {
    mcp_id,
    rating,
    success,
    performance_rating,
    ease_of_use,
    documentation_quality,
    latency_ms,
    tasks_completed,
    tasks_failed,
    error_count,
    use_case,
    review_text
  } = args

  const sessionId = crypto.randomUUID()
  const userAgent = request.headers.get('user-agent') || ''

  // Insert comprehensive review
  const { error: reviewError } = await supabase
    .from('reviews')
    .insert({
      mcp_id,
      rating,
      review_text,
      agent_type: extractAgentType(userAgent),
      use_case,
      tasks_completed: tasks_completed || 0,
      tasks_failed: tasks_failed || 0,
      avg_latency_experienced: latency_ms,
      session_id: sessionId,
      success,
      error_count: error_count || 0,
      rating_breakdown: {
        overall: rating,
        performance: performance_rating,
        ease_of_use,
        documentation: documentation_quality
      }
    })

  if (reviewError) {
    return createErrorResponse(-32603, `Review submission failed: ${reviewError.message}`, id)
  }

  // Trigger review score recalculation (async)
  recalculateReviewScoreAsync(mcp_id)

  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      message: 'Comprehensive review submitted successfully',
      session_id: sessionId,
      thanks: 'Thank you for detailed feedback - this helps improve MCP discovery for all agents!'
    },
    id
  })
}

async function handleGetMCPRecommendations(args: any, id: any) {
  // Implement intelligent MCP recommendations based on use case
  // This would use semantic search, quality scores, and success patterns
  
  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      recommendations: [],
      reasoning: 'Recommendation engine coming soon',
      timestamp: new Date().toISOString()
    },
    id
  })
}

// Helper functions
function createErrorResponse(code: number, message: string, id: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    error: { code, message },
    id
  }, { status: 400 })
}

function extractAgentType(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('claude')) return 'claude'
  if (ua.includes('gpt') || ua.includes('openai')) return 'openai'
  if (ua.includes('gemini')) return 'gemini'
  // ... more agent types
  return 'unknown'
}

async function logDiscoveryCall(request: NextRequest, query: string, category: string | undefined, resultCount: number) {
  try {
    await supabase.from('api_calls').insert({
      endpoint: '/mcp/enhanced',
      method: 'MCP',
      query,
      filters: { category },
      results_count: resultCount,
      user_agent: request.headers.get('user-agent') || '',
      agent_type: extractAgentType(request.headers.get('user-agent') || ''),
      session_id: crypto.randomUUID()
    })
  } catch (error) {
    console.error('Failed to log discovery call:', error)
  }
}

async function recalculateReviewScoreAsync(mcpId: string) {
  // Async review score recalculation
  try {
    const reviewScore = await reviewCalculator.calculateReviewScore(mcpId)
    if (reviewScore.total_score !== null) {
      await supabase
        .from('mcps')
        .update({
          review_score: reviewScore.total_score,
          review_breakdown: reviewScore.breakdown,
          review_algorithm_version: reviewScore.algorithm_version
        })
        .eq('id', mcpId)
    }
  } catch (error) {
    console.error('Failed to recalculate review score:', error)
  }
}

function handleResourcesList(id: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      resources: [
        {
          uri: 'e14z://categories',
          name: 'MCP Categories',
          description: 'Available MCP categories for filtering',
          mimeType: 'application/json'
        },
        {
          uri: 'e14z://quality-metrics',
          name: 'Quality Metrics',
          description: 'Explanation of quality scoring methodology',
          mimeType: 'application/json'
        },
        {
          uri: 'e14z://platform-stats',
          name: 'Platform Statistics',
          description: 'Real-time platform statistics and health',
          mimeType: 'application/json'
        }
      ]
    },
    id
  })
}

async function handleResourcesRead(params: any, id: any) {
  const { uri } = params

  try {
    switch (uri) {
      case 'e14z://categories':
        // Return available categories
        const { data: categoryData } = await supabase
          .from('mcps')
          .select('category')
          .not('category', 'is', null)

        const categories = Array.from(new Set(categoryData?.map(row => row.category) || [])).sort()
        
        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ categories }, null, 2)
            }]
          },
          id
        })

      case 'e14z://quality-metrics':
        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                quality_algorithm: {
                  version: qualityCalculator.version,
                  weights: qualityCalculator.weights,
                  description: 'Technical quality based on health, performance, functionality, reliability, and completeness'
                },
                review_algorithm: {
                  version: reviewCalculator.version,
                  weights: reviewCalculator.weights,
                  description: 'User satisfaction based on ratings, success rate, volume, recency, and quality of feedback'
                }
              }, null, 2)
            }]
          },
          id
        })

      default:
        return createErrorResponse(-32602, `Unknown resource: ${uri}`, id)
    }
  } catch (err) {
    return createErrorResponse(-32603, `Resource read failed: ${err}`, id)
  }
}