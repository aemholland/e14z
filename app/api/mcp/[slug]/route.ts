import { NextRequest, NextResponse } from 'next/server'
import { getMCPBySlug } from '@/lib/search/engine'
import { withAPM } from '@/lib/observability/apm-middleware'

async function getMCPHandler(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params

    if (!rawSlug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      )
    }

    // Decode URL-encoded slug to handle @ and / characters
    const slug = decodeURIComponent(rawSlug)
    console.log('Looking up MCP with slug:', slug)

    const mcp = await getMCPBySlug(slug)

    if (!mcp) {
      return NextResponse.json(
        { error: `MCP not found: ${slug}` },
        { status: 404 }
      )
    }

    // Format comprehensive MCP intelligence response
    const response = {
      // Core Identity
      id: mcp.id,
      slug: mcp.slug,
      name: mcp.name,
      description: mcp.description,
      category: mcp.category,
      tags: mcp.tags,
      verified: mcp.verified,
      
      // Installation & Setup
      installation: {
        primary_method: mcp.installation_methods?.[0] || {
          type: mcp.install_type,
          command: mcp.endpoint,
          priority: 1
        },
        alternative_methods: mcp.installation_methods?.slice(1) || [],
        auth_method: mcp.auth_method
      },
      
      // Auto-install command for EnhancedExecutionEngine
      auto_install_command: mcp.auto_install_command,
      endpoint: mcp.endpoint,
      
      // Tools & Capabilities (Enhanced with comprehensive intelligence)
      tools: {
        count: mcp.tools?.length || 0,
        working_count: mcp.working_tools_count || 0,
        failing_count: mcp.failing_tools_count || 0,
        success_rate: mcp.tool_success_rate,
        list: mcp.tools?.map(tool => ({
          name: tool.name,
          description: tool.description,
          category: tool.category,
          parameters: tool.parameters || [],
          inputSchema: tool.inputSchema,
          // Enhanced tool data from comprehensive testing
          response_time: mcp.tool_response_times?.[tool.name],
          working: mcp.successful_executions?.some(exec => exec.tool === tool.name),
          auth_required: tool.auth_required || false,
          complexity: Object.keys(tool.inputSchema?.properties || {}).length > 5 ? 'complex' : 
                     Object.keys(tool.inputSchema?.properties || {}).length > 2 ? 'moderate' : 'simple'
        })) || [],
        execution_examples: mcp.successful_executions?.slice(0, 5) || [],
        common_failures: mcp.failed_executions?.slice(0, 3) || []
      },
      
      // Quality & Trust Signals (Enhanced with comprehensive intelligence)
      quality: {
        verified: mcp.verified,
        health_status: mcp.health_status,
        last_health_check: mcp.last_health_check,
        overall_intelligence_score: mcp.overall_intelligence_score,
        reliability_score: mcp.reliability_score,
        documentation_quality: mcp.documentation_quality_score,
        user_experience_rating: mcp.user_experience_rating
      },
      
      // Performance Intelligence (Real data from comprehensive testing)
      performance: {
        initialization_time_ms: mcp.initialization_time_ms,
        avg_response_time_ms: mcp.average_response_time_ms,
        min_response_time_ms: mcp.min_response_time_ms,
        max_response_time_ms: mcp.max_response_time_ms,
        connection_stability: mcp.connection_stability,
        tool_success_rate: mcp.tool_success_rate,
        working_tools_count: mcp.working_tools_count,
        failing_tools_count: mcp.failing_tools_count,
        last_performance_check: mcp.intelligence_collection_date
      },
      
      // Authentication Intelligence
      authentication: {
        required: mcp.auth_required,
        methods: mcp.auth_methods || [],
        required_env_vars: mcp.detected_env_vars || [],
        setup_complexity: mcp.setup_complexity,
        failure_mode: mcp.auth_failure_mode,
        setup_instructions: mcp.auth_setup_instructions || [],
        error_messages: mcp.auth_error_messages || []
      },
      
      // Tool Intelligence (Enhanced with execution results)
      toolIntelligence: {
        total_tools: (mcp.working_tools_count || 0) + (mcp.failing_tools_count || 0),
        working_tools: mcp.working_tools_count || 0,
        failing_tools: mcp.failing_tools_count || 0,
        success_rate: mcp.tool_success_rate,
        execution_results: mcp.tool_execution_results || [],
        response_times: mcp.tool_response_times || {},
        complexity_analysis: mcp.tool_complexity_analysis || {},
        parameter_patterns: mcp.parameter_patterns || {}
      },
      
      // Testing Intelligence
      testing: {
        strategy: mcp.testing_strategy,
        last_tested: mcp.intelligence_collection_date,
        server_version: mcp.mcp_server_version,
        server_vendor: mcp.server_vendor,
        protocol_capabilities: mcp.server_capabilities || {}
      },
      
      // Error Intelligence & Troubleshooting
      errorIntelligence: {
        patterns: mcp.error_patterns || [],
        troubleshooting: mcp.troubleshooting_data || [],
        common_issues: mcp.common_issues || [],
        recovery_strategies: []
      },
      
      // Usage Examples (Real execution data)
      usageExamples: {
        successful_executions: mcp.successful_executions || [],
        failed_executions: mcp.failed_executions || [],
        usage_examples: mcp.usage_examples || []
      },
      
      // Business Intelligence
      businessIntelligence: {
        integration_complexity: mcp.integration_complexity,
        maintenance_level: mcp.maintenance_level,
        value_proposition: mcp.value_proposition
      },
      
      // Documentation & Support
      resources: {
        github_url: mcp.github_url,
        documentation_url: mcp.documentation_url,
        website_url: mcp.website_url
      },
      
      // Provider Information
      provider: {
        author: mcp.author,
        company: mcp.company,
        license: mcp.license,
        commercial: mcp.pricing_model !== 'free'
      },
      
      // Usage Guidance
      use_cases: mcp.use_cases || [],
      
      // Technical Details
      technical: {
        protocol_version: mcp.protocol_version,
        connection_type: mcp.connection_type,
        pricing_model: mcp.pricing_model,
        last_updated: mcp.updated_at,
        created_at: mcp.created_at
      }
    }

    return NextResponse.json({ mcp: response })
  } catch (error) {
    console.error('Error fetching MCP details:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch MCP details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Export the handler wrapped with APM middleware
export const GET = withAPM(getMCPHandler, {
  trackQueries: true,
  trackCache: true,
  sampleRate: 1.0
});