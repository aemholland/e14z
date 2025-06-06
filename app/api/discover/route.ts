import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

// SIMPLIFIED DISCOVER ROUTE - BYPASS ALL COMPLEX LOGIC
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
  
  try {
    // Direct database query - no search engine complexity
    let dbQuery = supabase.from('mcps').select('*')
    
    if (query.trim()) {
      dbQuery = dbQuery.ilike('name', `%${query}%`)
    }
    
    const { data: mcps, error } = await dbQuery
      .limit(limit)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    if (!mcps) return NextResponse.json({ results: [], total: 0 })
    
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
            // EXACT COPY from working MCP detail route
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
      total: mcps.length,
      message: "SIMPLIFIED ROUTE - SHOULD WORK!"
    })
    
  } catch (err) {
    console.error('Simple discover error:', err)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}