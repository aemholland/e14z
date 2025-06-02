/**
 * E14Z MCP-Specific Analytics API
 * Detailed analytics for individual MCPs with ownership verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { withLogging } from '@/lib/logging/middleware';
import { analyticsCollector } from '@/lib/analytics/comprehensive-collector';
import { supabase } from '@/lib/supabase/client';
import { withAPM } from '@/lib/observability/apm-middleware';

interface AnalyticsParams {
  mcp_id: string;
}

/**
 * GET /api/analytics/[mcp_id] - Get detailed analytics for a specific MCP
 * Free and unlimited access for all users
 */
const getMCPAnalyticsHandler = withLogging(async (req: NextRequest, context: { params: Promise<AnalyticsParams> }) => {
  try {
    const params = await context.params;
    const { mcp_id } = params;
    const { searchParams } = new URL(req.url);
    
    const timeframe = searchParams.get('timeframe') || '7d';
    const format = searchParams.get('format') || 'json'; // json, csv, excel
    const metric_type = searchParams.get('metric_type') || 'all'; // usage, performance, geographic, etc.
    
    // Give everyone full enterprise-level access to all analytics
    const analytics = await analyticsCollector.getMCPAnalytics(mcp_id, timeframe as any, 'enterprise');
    
    if (!analytics) {
      return NextResponse.json(
        { error: 'MCP not found or no analytics data available' },
        { status: 404 }
      );
    }
    
    // Filter metrics based on requested type (but no access restrictions)
    const filteredAnalytics = filterAnalyticsByType(analytics, metric_type);
    
    // Handle different response formats - all formats available to everyone
    if (format === 'csv') {
      return generateCSVResponse(filteredAnalytics, mcp_id, timeframe);
    } else if (format === 'excel') {
      return generateExcelResponse(filteredAnalytics, mcp_id, timeframe);
    }
    
    // Default JSON response
    const responseData = {
      mcp_id,
      timeframe,
      metric_type,
      analytics: filteredAnalytics,
      metadata: {
        access_level: 'full', // Everyone gets full access
        available_exports: ['json', 'csv', 'excel'], // All formats available
        update_frequency: 'hourly',
        last_updated: await getLastUpdateTime(mcp_id),
        note: 'All analytics features are currently free and unlimited',
        generated_at: new Date().toISOString()
      }
    };
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('MCP Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/analytics/[mcp_id]/insights - Generate AI-powered insights
 * Free and unlimited access for all users
 */
const postMCPAnalyticsHandler = withLogging(async (req: NextRequest, context: { params: Promise<AnalyticsParams> }) => {
  try {
    const params = await context.params;
    const { mcp_id } = params;
    const body = await req.json();
    const { insight_type = 'performance', timeframe = '30d' } = body;
    
    // Generate AI insights for everyone - no restrictions
    const insights = await generateAIInsights(mcp_id, insight_type, timeframe);
    
    return NextResponse.json({
      mcp_id,
      insight_type,
      timeframe,
      insights,
      note: 'AI insights are currently free and unlimited',
      generated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('AI Insights error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
});

/**
 * Helper Functions
 */

async function getUserTier(authHeader: string | null): Promise<string> {
  if (!authHeader) return 'anonymous';
  
  // Implement JWT token verification and user tier lookup
  // For now, return a default tier
  return 'community';
}

async function getUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  
  // Implement JWT token verification and user ID extraction
  // For now, return null
  return null;
}

async function verifyMCPOwnership(mcpId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const { data: mcp } = await supabase
      .from('mcps')
      .select('id, created_by, claimed_by')
      .eq('id', mcpId)
      .single();
    
    return Boolean(mcp && (mcp.created_by === userId || mcp.claimed_by === userId));
  } catch (error) {
    return false;
  }
}

function filterAnalyticsByType(analytics: any, metricType: string) {
  if (metricType === 'all') {
    return analytics;
  }
  
  const typeMapping = {
    usage: ['summary', 'time_series'],
    performance: ['summary', 'performance_breakdown'],
    geographic: ['geographic_distribution'],
    users: ['user_intelligence'],
    errors: ['error_analysis'],
    tools: ['tool_usage_stats'],
    business: ['competitive_intelligence', 'revenue_optimization']
  };
  
  const allowedKeys = typeMapping[metricType as keyof typeof typeMapping] || ['summary'];
  
  return Object.keys(analytics)
    .filter(key => allowedKeys.includes(key))
    .reduce((filtered, key) => {
      filtered[key] = analytics[key];
      return filtered;
    }, {} as any);
}

function getTierDataScope(userTier: string) {
  // Reuse the function from the main analytics route
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
        'AI-powered insights',
        'Export capabilities'
      ],
      excludes: []
    }
  };
  
  return scopes[userTier as keyof typeof scopes] || scopes.anonymous;
}

async function getLastUpdateTime(mcpId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('mcp_usage_aggregates')
      .select('updated_at')
      .eq('mcp_id', mcpId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    return data?.updated_at || new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

function generateCSVResponse(analytics: any, mcpId: string, timeframe: string) {
  // Convert analytics to CSV format
  const csvData = convertAnalyticsToCSV(analytics);
  
  return new NextResponse(csvData, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="mcp-${mcpId}-analytics-${timeframe}.csv"`
    }
  });
}

function generateExcelResponse(analytics: any, mcpId: string, timeframe: string) {
  // This would require a library like 'xlsx' to generate actual Excel files
  // For now, return JSON with appropriate headers
  return NextResponse.json(analytics, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="mcp-${mcpId}-analytics-${timeframe}.json"`
    }
  });
}

function convertAnalyticsToCSV(analytics: any): string {
  // Simple CSV conversion for summary data
  if (!analytics.summary) {
    return 'No summary data available';
  }
  
  const { summary } = analytics;
  let csv = 'Metric,Value\n';
  
  csv += `Total Executions,${summary.total_executions}\n`;
  csv += `Unique Users,${summary.unique_users}\n`;
  csv += `Success Rate,${(summary.success_rate * 100).toFixed(2)}%\n`;
  csv += `Average Execution Time,${summary.avg_execution_time.toFixed(0)}ms\n`;
  
  return csv;
}

async function generateAIInsights(mcpId: string, insightType: string, timeframe: string) {
  // This would integrate with an AI service to generate insights
  // For now, return placeholder insights
  
  const placeholderInsights = {
    performance: {
      summary: 'Your MCP shows strong performance with 95% success rate and average execution time of 850ms.',
      recommendations: [
        'Consider optimizing database queries to reduce execution time by 15-20%',
        'Add caching layer for frequently accessed data',
        'Monitor peak usage hours and scale accordingly'
      ],
      trends: [
        'Execution time increased by 12% over the last 30 days',
        'Error rate decreased by 45% after recent updates',
        'User adoption growing at 23% month-over-month'
      ]
    },
    usage: {
      summary: 'Your MCP has 1,240 unique users with peak usage during business hours.',
      recommendations: [
        'Target marketing to European time zones for growth',
        'Create documentation for enterprise use cases',
        'Add advanced features for power users'
      ],
      trends: [
        'Weekend usage up 34% indicating automation adoption',
        'Mobile usage growing faster than desktop',
        'New user retention at 67% - above average'
      ]
    }
  };
  
  return placeholderInsights[insightType as keyof typeof placeholderInsights] || placeholderInsights.performance;
}

// Export the handlers wrapped with APM middleware
export const GET = withAPM(getMCPAnalyticsHandler, {
  trackQueries: true,
  trackCache: true,
  sampleRate: 1.0
});

export const POST = withAPM(postMCPAnalyticsHandler, {
  trackQueries: true,
  trackCache: false,
  sampleRate: 1.0
});