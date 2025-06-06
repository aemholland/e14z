import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  
  try {
    console.log('🔍 DISCOVER API: Starting query for:', query)
    
    // Direct database query (simplified for now)
    let dbQuery = supabase
      .from('mcps')
      .select('*')
    
    // Apply basic filters
    if (searchParams.get('verified') === 'true') {
      dbQuery = dbQuery.eq('verified', true)
    }
    
    if (searchParams.get('no_auth') === 'true') {
      dbQuery = dbQuery.eq('auth_required', false)
    }
    
    if (searchParams.get('auth_required') === 'true') {
      dbQuery = dbQuery.eq('auth_required', true)
    }
    
    // Execute query with pagination
    const { data: mcps, error } = await dbQuery
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    if (!mcps || mcps.length === 0) {
      return NextResponse.json({
        summary: {
          found: 0,
          query,
          filters_applied: {
            verified: searchParams.get('verified') === 'true',
            no_auth: searchParams.get('no_auth') === 'true',
            auth_required: searchParams.get('auth_required') === 'true',
            executable: searchParams.get('executable') === 'true'
          }
        },
        mcps: [],
        next_actions: {
          run_mcp: "Use the 'run' tool with the slug to execute an MCP",
          submit_review: "Use the 'review' tool after testing to improve recommendations",
          get_details: "Use 'details' tool for more specific information about an MCP"
        }
      })
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
      summary: {
        found: results.length,
        query,
        filters_applied: {
          verified: searchParams.get('verified') === 'true',
          no_auth: searchParams.get('no_auth') === 'true',
          auth_required: searchParams.get('auth_required') === 'true',
          executable: searchParams.get('executable') === 'true'
        }
      },
      mcps: results,
      next_actions: {
        run_mcp: "Use the 'run' tool with the slug to execute an MCP",
        submit_review: "Use the 'review' tool after testing to improve recommendations",
        get_details: "Use 'details' tool for more specific information about an MCP"
      }
    })
    
  } catch (err) {
    console.error('Simple discover error:', err)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}