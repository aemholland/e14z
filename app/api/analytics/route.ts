/**
 * E14Z Analytics API Endpoints
 * Provides tiered access to MCP usage analytics for developers
 */

import { NextRequest, NextResponse } from 'next/server';
import { withLogging } from '@/lib/logging/middleware';
import { analyticsCollector } from '@/lib/analytics/comprehensive-collector';
import { optimizedAnalytics } from '@/lib/analytics/optimized-queries';
import { supabase } from '@/lib/supabase/client';
import { withAPM } from '@/lib/observability/apm-middleware';

/**
 * GET /api/analytics - Get MCP analytics overview
 * Query params:
 * - mcp_id: The MCP ID to get analytics for
 * - timeframe: 24h, 7d, 30d, 90d (default: 7d)
 * - detail_level: basic, standard, detailed, full (default: full - no restrictions for now)
 */
const getAnalyticsHandler = withLogging(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const mcpId = searchParams.get('mcp_id');
    const timeframe = searchParams.get('timeframe') || '7d';
    const detailLevel = searchParams.get('detail_level') || 'full'; // Give everyone full access for now
    
    if (!mcpId) {
      return NextResponse.json(
        { error: 'mcp_id parameter is required' },
        { status: 400 }
      );
    }
    
    // Validate timeframe
    const validTimeframes = ['24h', '7d', '30d', '90d'];
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json(
        { error: 'Invalid timeframe. Must be one of: 24h, 7d, 30d, 90d' },
        { status: 400 }
      );
    }
    
    // Use optimized analytics engine for better performance
    const analytics = await optimizedAnalytics.getMCPPerformanceMetrics(
      mcpId, 
      timeframe,
      { 
        useCache: true, 
        useAggregates: true, 
        includeRealTime: timeframe === '24h' || timeframe === '1h' 
      }
    );
    
    if (!analytics) {
      return NextResponse.json(
        { error: 'MCP not found or no analytics data available' },
        { status: 404 }
      );
    }
    
    const responseData = {
      mcp_id: mcpId,
      timeframe,
      detail_level: detailLevel,
      analytics,
      note: 'All analytics features are currently free and unlimited',
      generated_at: new Date().toISOString()
    };
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/analytics/aggregates - Trigger manual aggregation (admin only)
 */
const postAnalyticsHandler = withLogging(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { mcp_id, force_regenerate } = body;
    
    // In a real implementation, you'd check admin authentication here
    const isAdmin = req.headers.get('x-admin-key') === process.env.ADMIN_API_KEY;
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    if (mcp_id) {
      // Trigger aggregation for specific MCP
      await triggerMCPAggregation(mcp_id, force_regenerate);
      return NextResponse.json({ 
        message: `Aggregation triggered for MCP ${mcp_id}`,
        timestamp: new Date().toISOString()
      });
    } else {
      // Trigger global aggregation
      await triggerGlobalAggregation(force_regenerate);
      return NextResponse.json({ 
        message: 'Global aggregation triggered',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Analytics aggregation error:', error);
    return NextResponse.json(
      { error: 'Aggregation failed' },
      { status: 500 }
    );
  }
});

/**
 * Helper function to describe what data is available at each tier
 */
function getTierDataScope(userTier: string) {
  const scopes = {
    anonymous: {
      includes: ['Basic usage metrics', 'Success rates', 'Execution counts'],
      excludes: ['Geographic data', 'User intelligence', 'Performance breakdown', 'Error analysis']
    },
    community: {
      includes: ['Basic usage metrics', 'Time series data', 'Geographic distribution'],
      excludes: ['Detailed user intelligence', 'Performance breakdown', 'Competitive analysis']
    },
    verified: {
      includes: [
        'All community features',
        'User intelligence', 
        'Performance breakdown',
        'Error analysis',
        'Tool usage statistics'
      ],
      excludes: ['Competitive intelligence', 'Revenue optimization', 'Real-time alerts']
    },
    enterprise: {
      includes: [
        'All verified features',
        'Competitive intelligence',
        'Revenue optimization',
        'Custom segments',
        'Real-time alerts',
        'Export capabilities'
      ],
      excludes: []
    }
  };
  
  return scopes[userTier as keyof typeof scopes] || scopes.anonymous;
}

/**
 * Helper function to trigger aggregation for a specific MCP
 */
async function triggerMCPAggregation(mcpId: string, forceRegenerate: boolean = false) {
  // This would implement the logic to recalculate aggregated metrics
  // for a specific MCP. For now, it's a placeholder.
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  
  // Get recent execution data for this MCP
  const { data: executions } = await supabase
    .from('mcp_execution_analytics')
    .select('*')
    .eq('mcp_id', mcpId)
    .gte('execution_start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  if (!executions || executions.length === 0) {
    return;
  }
  
  // Calculate aggregated metrics
  const totalExecutions = executions.length;
  const uniqueUsers = new Set(executions.map(e => e.user_id || e.ip_address)).size;
  const successfulExecutions = executions.filter(e => e.execution_success).length;
  const successRate = successfulExecutions / totalExecutions;
  
  const avgExecutionTime = executions
    .filter(e => e.execution_duration_ms)
    .reduce((sum, e) => sum + (e.execution_duration_ms || 0), 0) / 
    executions.filter(e => e.execution_duration_ms).length;
  
  // Upsert aggregated data
  await supabase
    .from('mcp_usage_aggregates')
    .upsert({
      mcp_id: mcpId,
      date: today,
      hour: currentHour,
      total_executions: totalExecutions,
      unique_users: uniqueUsers,
      success_rate: successRate,
      avg_execution_time_ms: avgExecutionTime,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'mcp_id,date,hour'
    });
}

/**
 * Helper function to trigger global aggregation
 */
async function triggerGlobalAggregation(forceRegenerate: boolean = false) {
  // This would implement global analytics aggregation
  // For now, it's a placeholder that could trigger background jobs
  console.log('Global aggregation triggered', { forceRegenerate });
}

// Export the handlers wrapped with APM middleware
export const GET = withAPM(getAnalyticsHandler, {
  trackQueries: true,
  trackCache: true,
  sampleRate: 1.0
});

export const POST = withAPM(postAnalyticsHandler, {
  trackQueries: true,
  trackCache: false,
  sampleRate: 1.0
});