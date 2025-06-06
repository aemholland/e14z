/**
 * @swagger
 * /api/discover:
 *   get:
 *     tags: [Discovery]
 *     summary: Discover MCP servers
 *     description: |
 *       Search and discover Model Context Protocol servers with advanced filtering, ranking, and analytics.
 *       Returns comprehensive results with installation instructions, health status, and usage metrics.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Search query for MCP names, descriptions, and tags
 *         example: "database postgresql"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [payments, databases, content-creation, ai-tools, development-tools, cloud-storage, communication, infrastructure, productivity, project-management, security, social-media, web-apis, finance, research, iot, other]
 *         description: Filter by MCP category
 *         example: "databases"
 *       - in: query
 *         name: pricing
 *         schema:
 *           type: string
 *           enum: [free, paid]
 *         description: Filter by pricing model
 *         example: "free"
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *         description: Only return verified MCPs
 *         example: true
 *       - in: query
 *         name: health
 *         schema:
 *           type: string
 *           enum: [healthy, degraded, down, unknown]
 *         description: Filter by health status
 *         example: "healthy"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Maximum number of results to return
 *         example: 10
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip for pagination
 *         example: 0
 *     responses:
 *       200:
 *         description: Successful discovery response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiscoveryResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 *       500:
 *         description: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchMCPs } from '@/lib/search/engine'
import { supabase } from '@/lib/supabase/client'
import type { SearchOptions } from '@/types'
import { withLogging, withPerformanceLogging, logMCPOperation } from '@/lib/logging/middleware'
import { apiLogger, logPatterns } from '@/lib/logging/config'
import { withAPM } from '@/lib/observability/apm-middleware'

async function discoverHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // Parse search parameters (move outside try block for error handling scope)
  const query = searchParams.get('q') || ''
  const pricing = searchParams.get('pricing') as 'free' | 'paid' | null
  const verified = searchParams.get('verified') === 'true' ? true : undefined
  const healthStatus = searchParams.get('health') as 'healthy' | 'degraded' | 'down' | null
  const minRating = searchParams.get('minRating') ? parseInt(searchParams.get('minRating')!) : undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100) // Max 100 results
  const offset = parseInt(searchParams.get('offset') || '0')
  
  // Auth-aware filters for autonomous agents
  const noAuth = searchParams.get('no_auth') === 'true'
  const authRequired = searchParams.get('auth_required') === 'true'
  const executable = searchParams.get('executable') === 'true'

  // Generate session ID for tracking
  const sessionId = crypto.randomUUID()

  // Build search options
  const searchOptions: SearchOptions = {
    query,
    filters: {
      ...(pricing && { pricing }),
      ...(verified !== undefined && { verified }),
      ...(healthStatus && { healthStatus }),
      ...(minRating && { minRating }),
      ...(noAuth && { noAuth: true }),
      ...(authRequired && { authRequired: true }),
      ...(executable && { executable: true })
    },
    limit,
    offset
  }
  
  try {

    // Perform search with performance logging
    const { results, total, error } = await withPerformanceLogging(
      'mcp_search',
      () => searchMCPs(searchOptions)
    );

    if (error) {
      apiLogger.error({
        ...logPatterns.error(new Error(error), {
          search_options: searchOptions,
          session_id: sessionId,
        }),
      }, 'MCP search failed');

      return NextResponse.json(
        { error: 'Search failed', details: error },
        { status: 500 }
      )
    }

    // Log MCP discovery operation
    const userAgent = request.headers.get('user-agent') || ''
    const agentType = extractAgentType(userAgent)
    
    apiLogger.info({
      ...logPatterns.mcpDiscovery(query, results.length, searchOptions.filters),
      session_id: sessionId,
      agent_type: agentType,
      user_agent: userAgent,
    }, `MCP discovery completed: ${results.length} results for "${query}"`);
    
    // Store analytics in database (with error handling)
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
        response_time_ms: null // Will be calculated by middleware
      })
    } catch (logError) {
      apiLogger.warn({
        ...logPatterns.error(logError instanceof Error ? logError : new Error(String(logError)), {
          session_id: sessionId,
          operation: 'analytics_logging',
        }),
      }, 'Failed to log analytics data to database');
      // Don't fail the request if analytics logging fails
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
        
        // Installation & Setup
        installation: {
          primary_method: result.mcp.installation_methods?.[0] || {
            type: result.mcp.install_type,
            command: result.mcp.endpoint,
            priority: 1
          },
          alternative_methods: result.mcp.installation_methods?.slice(1) || [],
          auth_method: result.mcp.auth_method
        },
        
        // Auto-install command for EnhancedExecutionEngine
        auto_install_command: result.mcp.auto_install_command,
        endpoint: result.mcp.endpoint,
        
        // Tools & Capabilities (Enhanced with comprehensive intelligence)
        tools: {
          count: result.mcp.tools?.length || 0,
          working_count: (result.mcp as any).working_tools_count || 0,
          failing_count: (result.mcp as any).failing_tools_count || 0,
          success_rate: (result.mcp as any).tool_success_rate,
          list: result.mcp.tools?.map(tool => ({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            parameters: (() => {
              // CRITICAL FIX: Direct parameter extraction from tool inputSchema with fallback for legacy schema property
              const inputSchema = tool.inputSchema || (tool as any).schema;
              if (!inputSchema?.properties) return [];
              
              return Object.keys(inputSchema.properties).map(paramName => ({
                name: paramName,
                type: inputSchema.properties[paramName]?.type || 'string',
                required: (inputSchema.required || []).includes(paramName),
                description: inputSchema.properties[paramName]?.description || ''
              }));
            })(),
            inputSchema: tool.inputSchema || (tool as any).schema,
            response_time: (result.mcp as any).tool_response_times?.[tool.name],
            working: (result.mcp as any).successful_executions?.some((exec: any) => exec.tool === tool.name),
            auth_required: (tool as any).auth_required || false,
            complexity: (() => {
              const inputSchema = tool.inputSchema || (tool as any).schema;
              const paramCount = inputSchema?.properties ? Object.keys(inputSchema.properties).length : 0;
              return paramCount > 5 ? 'complex' : paramCount > 2 ? 'moderate' : 'simple';
            })()
          })) || [],
          execution_examples: (result.mcp as any).successful_executions?.slice(0, 3) || [],
          common_failures: (result.mcp as any).failed_executions?.slice(0, 3) || []
        },
        
        // Quality & Trust Signals (Enhanced with comprehensive intelligence)
        quality: {
          verified: result.mcp.verified,
          health_status: result.mcp.health_status,
          last_health_check: result.mcp.last_health_check,
          relevance_score: Math.round(result.relevanceScore),
          quality_score: Math.round(result.qualityScore),
          total_score: Math.round(result.totalScore),
          overall_intelligence_score: (result.mcp as any).overall_intelligence_score,
          reliability_score: (result.mcp as any).reliability_score,
          documentation_quality: (result.mcp as any).documentation_quality_score,
          user_experience_rating: (result.mcp as any).user_experience_rating
        },
        
        // Performance Intelligence (Real data from comprehensive testing)
        performance: {
          initialization_time_ms: (result.mcp as any).initialization_time_ms,
          avg_response_time_ms: (result.mcp as any).average_response_time_ms,
          min_response_time_ms: (result.mcp as any).min_response_time_ms,
          max_response_time_ms: (result.mcp as any).max_response_time_ms,
          connection_stability: (result.mcp as any).connection_stability,
          tool_success_rate: (result.mcp as any).tool_success_rate,
          working_tools_count: (result.mcp as any).working_tools_count,
          failing_tools_count: (result.mcp as any).failing_tools_count,
          last_performance_check: (result.mcp as any).intelligence_collection_date
        },
        
        // Authentication Intelligence
        authentication: {
          required: result.mcp.auth_required,
          methods: (result.mcp as any).auth_methods || [],
          required_env_vars: (result.mcp as any).detected_env_vars || [],
          setup_complexity: (result.mcp as any).setup_complexity,
          failure_mode: (result.mcp as any).auth_failure_mode,
          setup_instructions: (result.mcp as any).auth_setup_instructions || [],
          error_messages: (result.mcp as any).auth_error_messages || []
        },
        
        // Tool Intelligence (Enhanced with execution results)
        toolIntelligence: {
          total_tools: ((result.mcp as any).working_tools_count || 0) + ((result.mcp as any).failing_tools_count || 0),
          working_tools: (result.mcp as any).working_tools_count || 0,
          failing_tools: (result.mcp as any).failing_tools_count || 0,
          success_rate: (result.mcp as any).tool_success_rate,
          execution_results: (result.mcp as any).tool_execution_results || [],
          response_times: (result.mcp as any).tool_response_times || {},
          complexity_analysis: (result.mcp as any).tool_complexity_analysis || {},
          parameter_patterns: (result.mcp as any).parameter_patterns || {}
        },
        
        // Testing Intelligence
        testing: {
          strategy: (result.mcp as any).testing_strategy,
          last_tested: (result.mcp as any).intelligence_collection_date,
          server_version: (result.mcp as any).mcp_server_version,
          server_vendor: (result.mcp as any).server_vendor,
          protocol_capabilities: (result.mcp as any).server_capabilities || {}
        },
        
        // Error Intelligence & Troubleshooting
        errorIntelligence: {
          patterns: (result.mcp as any).error_patterns || [],
          troubleshooting: (result.mcp as any).troubleshooting_data || [],
          common_issues: (result.mcp as any).common_issues || [],
          recovery_strategies: []
        },
        
        // Usage Examples (Real execution data)
        usageExamples: {
          successful_executions: (result.mcp as any).successful_executions || [],
          failed_executions: (result.mcp as any).failed_executions || [],
          usage_examples: (result.mcp as any).usage_examples || []
        },
        
        // Business Intelligence
        businessIntelligence: {
          integration_complexity: (result.mcp as any).integration_complexity,
          maintenance_level: (result.mcp as any).maintenance_level,
          value_proposition: (result.mcp as any).value_proposition
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
          website_url: result.mcp.website_url
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
    const error = err instanceof Error ? err : new Error(String(err));
    
    apiLogger.error({
      ...logPatterns.error(error, {
        endpoint: '/api/discover',
        search_options: searchOptions,
      }),
    }, 'Discover API internal error');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Export the handler wrapped with APM and logging middleware
export const GET = withAPM(withLogging(discoverHandler), {
  trackQueries: true,
  trackCache: true,
  sampleRate: 1.0
});

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