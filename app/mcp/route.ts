import { NextRequest, NextResponse } from 'next/server'
import { searchMCPs } from '@/lib/search/engine'
import { supabase } from '@/lib/supabase/client'

// MCP Protocol Server for E14Z Discovery
// This endpoint allows AI agents to discover MCPs via the MCP protocol itself
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
    console.error('MCP Protocol error:', err)
    return createErrorResponse(-32603, 'Internal error', null)
  }
}

function handleInitialize(params: any, id: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {
          listChanged: false
        },
        resources: {
          subscribe: false,
          listChanged: false
        }
      },
      serverInfo: {
        name: 'E14Z MCP Discovery Server',
        version: '1.0.0',
        description: 'Discover and connect to MCP servers via the MCP protocol'
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
          name: 'discover',
          description: 'Search and discover MCP servers',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for MCP discovery'
              },
              category: {
                type: 'string',
                description: 'Filter by category (search, database, file-system, etc.)'
              },
              pricing: {
                type: 'string',
                enum: ['free', 'paid'],
                description: 'Filter by pricing model'
              },
              verified: {
                type: 'boolean',
                description: 'Only show verified MCPs'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 10, max: 50)',
                minimum: 1,
                maximum: 50
              }
            }
          }
        },
        {
          name: 'details',
          description: 'Get detailed information about a specific MCP',
          inputSchema: {
            type: 'object',
            properties: {
              slug: {
                type: 'string',
                description: 'MCP slug identifier'
              }
            },
            required: ['slug']
          }
        },
        {
          name: 'review',
          description: 'Submit a review after using an MCP',
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
                description: 'Rating from 1-10 based on experience'
              },
              success: {
                type: 'boolean',
                description: 'Whether the MCP worked successfully'
              },
              latency_ms: {
                type: 'number',
                description: 'Observed latency in milliseconds'
              },
              error_count: {
                type: 'number',
                description: 'Number of errors encountered'
              },
              review_text: {
                type: 'string',
                description: 'Optional review text'
              },
              use_case: {
                type: 'string',
                description: 'What you used the MCP for'
              }
            },
            required: ['mcp_id', 'rating', 'success']
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
      case 'discover':
        return await handleDiscoverMCPs(args, id, request)
      
      case 'details':
        return await handleGetMCPDetails(args, id)
      
      case 'review':
        return await handleSubmitReview(args, id, request)
      
      default:
        return createErrorResponse(-32601, `Unknown tool: ${name}`, id)
    }
  } catch (err) {
    console.error(`Tool call error for ${name}:`, err)
    return createErrorResponse(-32603, `Tool execution failed: ${err}`, id)
  }
}

async function handleDiscoverMCPs(args: any, id: any, request: NextRequest) {
  const { query = '', category, pricing, verified, limit = 10 } = args

  const searchOptions = {
    query,
    filters: {
      ...(category && { category }),
      ...(pricing && { pricing }),
      ...(verified !== undefined && { verified })
    },
    limit: Math.min(limit, 50),
    offset: 0
  }

  const { results, total, error } = await searchMCPs(searchOptions)

  if (error) {
    return createErrorResponse(-32603, `Search failed: ${error}`, id)
  }

  // Log the discovery call
  const userAgent = request.headers.get('user-agent') || ''
  const sessionId = crypto.randomUUID()
  
  try {
    await supabase.from('api_calls').insert({
      endpoint: '/mcp/discover',
      method: 'MCP',
      query,
      filters: searchOptions.filters,
      results_count: results.length,
      results_mcp_ids: results.map(r => r.mcp.id),
      user_agent: userAgent,
      agent_type: extractAgentType(userAgent),
      session_id: sessionId
    })
  } catch (logError) {
    console.error('Failed to log MCP discovery:', logError)
  }

  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      mcps: results.map(result => ({
        id: result.mcp.id,
        slug: result.mcp.slug,
        name: result.mcp.name,
        description: result.mcp.description,
        endpoint: result.mcp.endpoint,
        connection: {
          type: result.mcp.connection_type,
          auth_method: result.mcp.auth_method,
          protocol_version: result.mcp.protocol_version,
          capabilities: result.mcp.capabilities
        },
        category: result.mcp.category,
        tags: result.mcp.tags,
        verified: result.mcp.verified,
        health_status: result.mcp.health_status,
        pricing_model: result.mcp.pricing_model,
        github_url: result.mcp.github_url,
        documentation_url: result.mcp.documentation_url,
        scores: {
          relevance: result.relevanceScore,
          quality: result.qualityScore,
          health: result.healthScore,
          total: result.totalScore
        }
      })),
      total_results: total,
      session_id: sessionId,
      instructions: {
        connection: 'Use the endpoint and connection details to connect to the MCP',
        review: 'After using an MCP, please submit a review using submit_review tool',
        discovery_url: 'https://e14z.com'
      }
    },
    id
  })
}

async function handleGetMCPDetails(args: any, id: any) {
  const { slug } = args

  const { data: mcp, error } = await supabase
    .from('mcps')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !mcp) {
    return createErrorResponse(-32602, `MCP not found: ${slug}`, id)
  }

  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      mcp: {
        id: mcp.id,
        slug: mcp.slug,
        name: mcp.name,
        description: mcp.description,
        endpoint: mcp.endpoint,
        connection: {
          type: mcp.connection_type,
          auth_method: mcp.auth_method,
          protocol_version: mcp.protocol_version,
          capabilities: mcp.capabilities
        },
        category: mcp.category,
        tags: mcp.tags,
        use_cases: mcp.use_cases,
        verified: mcp.verified,
        health_status: mcp.health_status,
        pricing: {
          model: mcp.pricing_model,
          details: mcp.pricing_details
        },
        links: {
          github: mcp.github_url,
          documentation: mcp.documentation_url,
          website: mcp.website_url
        },
        metadata: {
          author: mcp.author,
          company: mcp.company,
          license: mcp.license,
          created_at: mcp.created_at,
          updated_at: mcp.updated_at
        },
        web_url: `https://e14z.com/mcp/${mcp.slug}`
      }
    },
    id
  })
}

async function handleSubmitReview(args: any, id: any, request: NextRequest) {
  const {
    mcp_id,
    rating,
    success,
    latency_ms,
    error_count = 0,
    review_text,
    use_case
  } = args

  const sessionId = crypto.randomUUID()
  const userAgent = request.headers.get('user-agent') || ''
  const agentType = extractAgentType(userAgent)

  // Insert review
  const { error: reviewError } = await supabase
    .from('reviews')
    .insert({
      mcp_id,
      rating,
      review_text,
      agent_type: agentType,
      use_case,
      tasks_completed: success ? 1 : 0,
      tasks_failed: success ? 0 : 1,
      avg_latency_experienced: latency_ms,
      session_id: sessionId
    })

  if (reviewError) {
    return createErrorResponse(-32603, `Review submission failed: ${reviewError.message}`, id)
  }

  // Insert performance log
  if (typeof success === 'boolean') {
    await supabase.from('performance_logs').insert({
      mcp_id,
      latency_ms,
      success,
      error_type: success ? null : 'user_reported',
      error_message: success ? null : `${error_count} errors reported`,
      agent_type: agentType,
      use_case,
      session_id: sessionId
    })
  }

  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      message: 'Review submitted successfully',
      session_id: sessionId,
      thanks: 'Thank you for helping improve MCP discovery!'
    },
    id
  })
}

function handleResourcesList(id: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    result: {
      resources: [
        {
          uri: 'e14z://categories',
          name: 'Available Categories',
          description: 'List of all MCP categories',
          mimeType: 'application/json'
        },
        {
          uri: 'e14z://stats',
          name: 'Platform Statistics',
          description: 'E14Z platform statistics and metrics',
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
        const { data: categoryData } = await supabase
          .from('mcps')
          .select('category')
          .not('category', 'is', null)

        const categories = [...new Set(categoryData?.map(row => row.category) || [])].sort()
        
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

      case 'e14z://stats':
        const { count: totalMCPs } = await supabase
          .from('mcps')
          .select('*', { count: 'exact', head: true })

        const { count: verifiedMCPs } = await supabase
          .from('mcps')
          .select('*', { count: 'exact', head: true })
          .eq('verified', true)

        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                total_mcps: totalMCPs || 0,
                verified_mcps: verifiedMCPs || 0,
                platform: 'E14Z - AI Tool Discovery',
                website: 'https://e14z.com',
                api_endpoint: 'https://e14z.com/api/discover',
                mcp_endpoint: 'https://e14z.com/mcp'
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
  if (ua.includes('anthropic')) return 'anthropic'
  if (ua.includes('python')) return 'python-script'
  if (ua.includes('curl')) return 'curl'
  if (ua.includes('postman')) return 'postman'
  if (ua.includes('bot')) return 'bot'
  
  return 'unknown'
}