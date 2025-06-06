import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
// import { withAPM } from '@/lib/observability/apm-middleware-simple'

async function healthHandler(request: NextRequest) {
  try {
    console.log('🏥 HEALTH: Testing database connection...')
    console.log('🏥 HEALTH: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30))
    console.log('🏥 HEALTH: Has anon key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    
    // Test basic count query
    const { data: countData, error: countError } = await supabase
      .from('mcps')
      .select('id', { count: 'exact' })
      .limit(1)

    console.log('🏥 HEALTH: Count query result:', { countData, countError })

    if (countError) {
      throw new Error(`Count query failed: ${countError.message}`)
    }

    // Test actual data retrieval 
    const { data: mcpData, error: mcpError } = await supabase
      .from('mcps')
      .select('id, name, slug')
      .limit(1)

    console.log('🏥 HEALTH: MCP query result:', { 
      mcpData, 
      mcpError,
      mcp_count: mcpData?.length || 0
    })

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.3-DEBUG-TEST',
      debug: {
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30),
        has_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        count_query: { data: countData, error: countError?.message },
        mcp_query: { count: mcpData?.length || 0, error: mcpError?.message },
        first_mcp: mcpData?.[0]?.name
      }
    })
  } catch (error) {
    console.error('🏥 HEALTH: Error:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30),
          has_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        }
      },
      { status: 503 }
    )
  }
}

// Export the handler
export const GET = healthHandler;