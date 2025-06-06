import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// FORCE DIRECT SUPABASE CONNECTION - bypass any client issues
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zmfvcqjtubfclkhsdqjx.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZnZjcWp0dWJmY2xraHNkcWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MzE1NzQsImV4cCI6MjA2NDEwNzU3NH0.27QJGrimbfNirtrto-6ZYrfgsbiZOp8Ax4759o6XKYc'
)

// SIMPLIFIED DISCOVER ROUTE - BYPASS ALL COMPLEX LOGIC
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
  
  try {
    console.log('🔍 DISCOVER API: Starting query for:', query)
    
    // Direct database query - no search engine complexity
    let dbQuery = supabase.from('mcps').select('*')
    
    if (query.trim()) {
      dbQuery = dbQuery.ilike('name', `%${query}%`)
    }
    
    console.log('🔍 DISCOVER API: Executing database query')
    const { data: mcps, error } = await dbQuery
      .limit(limit)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('🔍 DISCOVER API: Database error:', error)
      throw error
    }
    
    if (!mcps) {
      console.log('🔍 DISCOVER API: No MCPs returned')
      return NextResponse.json({ results: [], total: 0 })
    }
    
    console.log('🔍 DISCOVER API: Found', mcps.length, 'MCPs')
    if (mcps[0]) {
      console.log('🔍 DISCOVER API: First MCP tools count:', mcps[0].tools?.length)
      if (mcps[0].tools?.[0]) {
        const firstTool = mcps[0].tools[0]
        console.log('🔍 DISCOVER API: First tool:', firstTool.name, 'has inputSchema:', !!firstTool.inputSchema)
        if (firstTool.inputSchema?.properties) {
          console.log('🔍 DISCOVER API: Properties:', Object.keys(firstTool.inputSchema.properties))
        }
      }
    }
    
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
            // EXACT COPY from working MCP detail route with debug logging
            const inputSchema = tool.inputSchema || (tool as any).schema;
            
            if (tool.name === 'browser_resize') {
              console.log('🔧 PROCESSING browser_resize tool:')
              console.log('  - Has inputSchema:', !!inputSchema)
              console.log('  - InputSchema type:', typeof inputSchema)
              console.log('  - Has properties:', !!inputSchema?.properties)
              if (inputSchema?.properties) {
                console.log('  - Property keys:', Object.keys(inputSchema.properties))
              }
            }
            
            if (!inputSchema || typeof inputSchema !== 'object') {
              if (tool.name === 'browser_resize') console.log('  - FAILED: No inputSchema')
              return [];
            }
            
            const properties = inputSchema.properties;
            if (!properties || typeof properties !== 'object') {
              if (tool.name === 'browser_resize') console.log('  - FAILED: No properties')
              return [];
            }
            
            const required = inputSchema.required || [];
            
            const params = Object.keys(properties).map(paramName => {
              const param = properties[paramName];
              return {
                name: paramName,
                type: param?.type || 'string',
                required: Array.isArray(required) ? required.includes(paramName) : false,
                description: param?.description || ''
              };
            });
            
            if (tool.name === 'browser_resize') {
              console.log('  - SUCCESS: Extracted', params.length, 'parameters')
              console.log('  - Parameters:', JSON.stringify(params))
            }
            
            return params;
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