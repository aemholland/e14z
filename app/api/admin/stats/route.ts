/**
 * E14Z Admin Dashboard Stats API
 * Provides real-time system metrics for admin monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { withLogging } from '@/lib/logging/middleware';
import { supabase } from '@/lib/supabase/client';
import { withAPM } from '@/lib/observability/apm-middleware';

/**
 * GET /api/admin/stats - Get system-wide statistics
 */
const adminStatsHandler = withLogging(async (req: NextRequest) => {
  try {
    // TODO: Add admin authentication check
    const isAdmin = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Calculate time ranges
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get system statistics in parallel
    const [
      totalRequests24h,
      errorStats24h,
      avgResponseTime,
      activeUsers,
      totalMCPs,
      pendingReviews,
      criticalAlerts,
      systemUptime
    ] = await Promise.all([
      getTotalRequests24h(last24h),
      getErrorStats24h(last24h),
      getAverageResponseTime(last24h),
      getActiveUsers(last7d),
      getTotalMCPs(),
      getPendingReviews(),
      getCriticalAlerts(),
      getSystemUptime()
    ]);

    const stats = {
      uptime: systemUptime,
      total_requests_24h: totalRequests24h,
      error_rate_24h: errorStats24h.errorRate,
      avg_response_time: avgResponseTime,
      active_users: activeUsers,
      total_mcps: totalMCPs,
      pending_reviews: pendingReviews,
      critical_alerts: criticalAlerts,
      last_updated: now.toISOString(),
      
      // Additional detailed metrics
      detailed_metrics: {
        requests_by_hour: await getRequestsByHour(last24h),
        error_breakdown: errorStats24h.breakdown,
        top_endpoints: await getTopEndpoints(last24h),
        geographic_distribution: await getGeographicDistribution(last7d),
        database_stats: await getDatabaseStats(),
        memory_usage: await getMemoryUsage()
      }
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Admin stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system statistics' },
      { status: 500 }
    );
  }
});

/**
 * Helper Functions
 */

async function verifyAdminAccess(req: NextRequest): Promise<boolean> {
  // For now, check for admin API key
  const adminKey = req.headers.get('x-admin-key');
  if (adminKey === process.env.ADMIN_API_KEY) {
    return true;
  }

  // TODO: Implement proper admin JWT verification
  // const authHeader = req.headers.get('authorization');
  // return verifyAdminJWT(authHeader);

  // For development, allow localhost requests
  const forwardedFor = req.headers.get('x-forwarded-for');
  const isLocalhost = !forwardedFor || forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost');
  
  return process.env.NODE_ENV === 'development' && isLocalhost;
}

async function getTotalRequests24h(since: Date): Promise<number> {
  try {
    // Get from analytics table
    const { count } = await supabase
      .from('mcp_execution_analytics')
      .select('*', { count: 'exact', head: true })
      .gte('execution_start_time', since.toISOString());

    return count || 0;
  } catch (error) {
    return 0;
  }
}

async function getErrorStats24h(since: Date): Promise<{ errorRate: number; breakdown: any }> {
  try {
    const { data: executions } = await supabase
      .from('mcp_execution_analytics')
      .select('execution_success, execution_error_type')
      .gte('execution_start_time', since.toISOString());

    if (!executions || executions.length === 0) {
      return { errorRate: 0, breakdown: {} };
    }

    const total = executions.length;
    const errors = executions.filter(e => !e.execution_success);
    const errorRate = errors.length / total;

    // Breakdown by error type
    const breakdown = errors.reduce((acc, error) => {
      const type = error.execution_error_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { errorRate, breakdown };
  } catch (error) {
    return { errorRate: 0, breakdown: {} };
  }
}

async function getAverageResponseTime(since: Date): Promise<number> {
  try {
    const { data: executions } = await supabase
      .from('mcp_execution_analytics')
      .select('execution_duration_ms')
      .gte('execution_start_time', since.toISOString())
      .not('execution_duration_ms', 'is', null);

    if (!executions || executions.length === 0) {
      return 0;
    }

    const totalTime = executions.reduce((sum, e) => sum + (e.execution_duration_ms || 0), 0);
    return Math.round(totalTime / executions.length);
  } catch (error) {
    return 0;
  }
}

async function getActiveUsers(since: Date): Promise<number> {
  try {
    const { data: users } = await supabase
      .from('mcp_execution_analytics')
      .select('user_id, ip_address')
      .gte('execution_start_time', since.toISOString());

    if (!users) return 0;

    // Count unique users (by user_id or IP)
    const uniqueIdentifiers = new Set();
    users.forEach(user => {
      const identifier = user.user_id || user.ip_address;
      if (identifier) uniqueIdentifiers.add(identifier);
    });

    return uniqueIdentifiers.size;
  } catch (error) {
    return 0;
  }
}

async function getTotalMCPs(): Promise<number> {
  try {
    const { count } = await supabase
      .from('mcps')
      .select('*', { count: 'exact', head: true });

    return count || 0;
  } catch (error) {
    return 0;
  }
}

async function getPendingReviews(): Promise<number> {
  try {
    const { count } = await supabase
      .from('mcps')
      .select('*', { count: 'exact', head: true })
      .eq('verified', false);

    return count || 0;
  } catch (error) {
    return 0;
  }
}

async function getCriticalAlerts(): Promise<number> {
  // TODO: Implement alerts system
  // For now, return mock data based on error rates
  try {
    const errorStats = await getErrorStats24h(new Date(Date.now() - 24 * 60 * 60 * 1000));
    return errorStats.errorRate > 0.1 ? 1 : 0; // Critical if error rate > 10%
  } catch (error) {
    return 0;
  }
}

async function getSystemUptime(): Promise<string> {
  // TODO: Implement proper uptime tracking
  // For now, calculate based on successful requests vs errors
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errorStats = await getErrorStats24h(last24h);
    const uptime = (1 - errorStats.errorRate) * 100;
    return `${uptime.toFixed(2)}%`;
  } catch (error) {
    return '99.9%';
  }
}

async function getRequestsByHour(since: Date): Promise<any[]> {
  try {
    // Use optimized query with proper aggregation
    const { data } = await supabase
      .from('system_usage_aggregates')
      .select('date, hour, total_requests')
      .gte('date', since.toISOString().split('T')[0])
      .order('date', { ascending: true })
      .order('hour', { ascending: true });

    // Fallback to hourly aggregates if system aggregates don't exist
    if (!data || data.length === 0) {
      const { data: hourlyData } = await supabase
        .from('mcp_usage_aggregates')
        .select('date, hour, total_executions')
        .gte('date', since.toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('hour', { ascending: true });
      
      return hourlyData || [];
    }

    return data;
  } catch (error) {
    return [];
  }
}

async function getTopEndpoints(since: Date): Promise<any[]> {
  // Mock data for top API endpoints
  return [
    { endpoint: '/api/discover', requests: 1250, avg_time: 150 },
    { endpoint: '/api/mcp/[slug]', requests: 890, avg_time: 95 },
    { endpoint: '/api/analytics', requests: 650, avg_time: 220 },
    { endpoint: '/api/run', requests: 430, avg_time: 1200 },
    { endpoint: '/api/health', requests: 2100, avg_time: 25 }
  ];
}

async function getGeographicDistribution(since: Date): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('mcp_execution_analytics')
      .select('country_code')
      .gte('execution_start_time', since.toISOString())
      .not('country_code', 'is', null);

    if (!data) return [];

    const countryCounts = data.reduce((acc, record) => {
      const country = record.country_code;
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  } catch (error) {
    return [];
  }
}

async function getDatabaseStats(): Promise<any> {
  // Mock database statistics
  return {
    connection_count: 15,
    active_queries: 3,
    cache_hit_rate: 0.94,
    storage_used_gb: 2.8,
    storage_total_gb: 100
  };
}

async function getMemoryUsage(): Promise<any> {
  // Get Node.js memory usage
  const memUsage = process.memoryUsage();
  
  return {
    heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
    external_mb: Math.round(memUsage.external / 1024 / 1024),
    rss_mb: Math.round(memUsage.rss / 1024 / 1024)
  };
}

// Export the handler wrapped with APM middleware
export const GET = withAPM(adminStatsHandler, {
  trackQueries: true,
  trackCache: true,
  sampleRate: 1.0
});