import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  
  try {
    console.log('🔍 DISCOVER API: Starting query for:', query)
    console.log('🔍 DISCOVER API: Filters:', {
      verified: searchParams.get('verified'),
      no_auth: searchParams.get('no_auth'), 
      auth_required: searchParams.get('auth_required'),
      executable: searchParams.get('executable')
    })
    console.log('🔍 DISCOVER API: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30))
    
    // Test basic connection first
    const { data: testData, error: testError } = await supabase
      .from('mcps')
      .select('count')
      .limit(1)
    
    console.log('🔍 DISCOVER API: Test query result:', { testData, testError })
    
    if (testError) {
      console.error('🔍 DISCOVER API: Test query failed:', testError)
      return NextResponse.json({ 
        error: `Database connection failed: ${testError.message}`,
        debug: {
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30),
          has_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        }
      }, { status: 500 })
    }
    
    // Direct database query (simplified for now)
    let dbQuery = supabase
      .from('mcps')
      .select('*')
    
    // Apply basic filters
    if (searchParams.get('verified') === 'true') {
      dbQuery = dbQuery.eq('verified', true)
      console.log('🔍 DISCOVER API: Applied verified=true filter')
    }
    
    if (searchParams.get('no_auth') === 'true') {
      dbQuery = dbQuery.eq('auth_required', false)
      console.log('🔍 DISCOVER API: Applied no_auth=true filter')
    }
    
    if (searchParams.get('auth_required') === 'true') {
      dbQuery = dbQuery.eq('auth_required', true)
      console.log('🔍 DISCOVER API: Applied auth_required=true filter')
    }
    
    console.log('🔍 DISCOVER API: About to execute main query with limit:', limit, 'offset:', offset)
    
    // Execute query with pagination
    const { data: mcps, error } = await dbQuery
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })
    
    console.log('🔍 DISCOVER API: Main query result:', { 
      mcps_count: mcps?.length || 0, 
      error, 
      first_mcp: mcps?.[0]?.name 
    })
    
    if (error) {
      console.error('🔍 DISCOVER API: Database error:', error)
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