import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// DEBUG ENDPOINT - Return raw database data
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zmfvcqjtubfclkhsdqjx.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZnZjcWp0dWJmY2xraHNkcWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MzE1NzQsImV4cCI6MjA2NDEwNzU3NH0.27QJGrimbfNirtrto-6ZYrfgsbiZOp8Ax4759o6XKYc'
)

export async function GET(request: NextRequest) {
  try {
    // Get raw Playwright MCP data
    const { data: mcps, error } = await supabase
      .from('mcps')
      .select('*')
      .ilike('name', '%playwright%')
      .limit(1)
    
    if (error) throw error
    if (!mcps || mcps.length === 0) {
      return NextResponse.json({ error: 'No playwright MCP found' })
    }
    
    const mcp = mcps[0]
    const resizeTool = mcp.tools?.find(t => t.name === 'browser_resize')
    
    return NextResponse.json({
      mcp_id: mcp.id,
      mcp_name: mcp.name,
      tools_count: mcp.tools?.length,
      browser_resize_tool: resizeTool ? {
        name: resizeTool.name,
        description: resizeTool.description,
        has_inputSchema: !!resizeTool.inputSchema,
        inputSchema_type: typeof resizeTool.inputSchema,
        inputSchema_keys: resizeTool.inputSchema ? Object.keys(resizeTool.inputSchema) : [],
        has_properties: !!(resizeTool.inputSchema?.properties),
        properties_keys: resizeTool.inputSchema?.properties ? Object.keys(resizeTool.inputSchema.properties) : [],
        full_inputSchema: resizeTool.inputSchema,
        raw_tool: resizeTool
      } : 'TOOL_NOT_FOUND',
      environment: {
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        HAS_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NODE_ENV: process.env.NODE_ENV
      }
    })
    
  } catch (err) {
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 })
  }
}