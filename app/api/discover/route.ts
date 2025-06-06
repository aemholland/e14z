import { NextRequest, NextResponse } from 'next/server'
import { searchMCPs } from '@/lib/search/engine'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  
  try {
    console.log('🔍 DISCOVER API: Starting query for:', query)
    
    // Use proper search engine instead of hardcoded Playwright logic
    const searchResults = await searchMCPs({
      query,
      filters: {
        verified: searchParams.get('verified') === 'true',
        noAuth: searchParams.get('no_auth') === 'true',
        authRequired: searchParams.get('auth_required') === 'true'
      },
      limit,
      offset
    })
    
    if (searchResults.error) {
      return NextResponse.json({ error: searchResults.error }, { status: 500 })
    }
    
    const mcps = searchResults.results.map(result => result.mcp)
    
    // Format response with WORKING parameter extraction (copied from MCP detail route)
    const results = mcps.map(mcp => ({
      id: mcp.id,
      slug: mcp.slug,
      name: mcp.name,
      description: mcp.description,
      
      tools: {
        count: mcp.tools?.length || 0,
        list: mcp.tools?.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: (() => {
            // EXACT COPY of working parameter extraction from MCP detail endpoint
            const inputSchema = tool.inputSchema || (tool as any).schema;
            if (!inputSchema || typeof inputSchema !== 'object') return [];
            
            const properties = inputSchema.properties;
            if (!properties || typeof properties !== 'object') return [];
            
            const required = inputSchema.required || [];
            
            return Object.keys(properties).map(paramName => {
              const param = properties[paramName];
              return {
                name: paramName,
                type: param?.type || 'string',
                required: Array.isArray(required) ? required.includes(paramName) : false,
                description: param?.description || ''
              };
            });
          })()
        })) || []
      }
    }))
    
    return NextResponse.json({
      query,
      results,
      total_results: searchResults.total,
      pagination: {
        limit,
        offset,
        has_more: searchResults.total > offset + limit
      },
      message: "PARAMETERS FIXED! v2.1.0",
      deployment_test: new Date().toISOString()
    })
    
  } catch (err) {
    console.error('Simple discover error:', err)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}