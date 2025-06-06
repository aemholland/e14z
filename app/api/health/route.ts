import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { withAPM } from '@/lib/observability/apm-middleware'

async function healthHandler(request: NextRequest) {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('mcps')
      .select('count')
      .limit(1)
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.2-DEPLOYMENT-TEST'
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    )
  }
}

// Export the handler wrapped with APM middleware
export const GET = withAPM(healthHandler, {
  trackQueries: true,
  trackCache: false,
  sampleRate: 0.1 // Lower sample rate for health checks
});