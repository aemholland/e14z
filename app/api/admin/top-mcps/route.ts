/**
 * E14Z Admin Top MCPs API
 * Provides analytics on the most active MCPs for admin monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { withLogging } from '@/lib/logging/middleware';
import { supabase } from '@/lib/supabase/client';

/**
 * GET /api/admin/top-mcps - Get top performing MCPs
 */
export const GET = withLogging(async (req: NextRequest) => {
  try {
    // TODO: Add admin authentication check
    const isAdmin = await verifyAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get('timeframe') || '24h';
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sort') || 'executions'; // executions, success_rate, avg_time

    // Calculate time range
    const now = new Date();
    const hoursBack = getHoursBack(timeframe);
    const since = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    // Get MCP execution statistics
    const mcpStats = await getMCPStats(since, limit, sortBy);

    const response = {
      timeframe,
      period_start: since.toISOString(),
      period_end: now.toISOString(),
      total_mcps: mcpStats.length,
      mcps: mcpStats,
      generated_at: now.toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Admin top MCPs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top MCPs data' },
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

  // For development, allow localhost requests
  const forwardedFor = req.headers.get('x-forwarded-for');
  const isLocalhost = !forwardedFor || forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost');
  
  return process.env.NODE_ENV === 'development' && isLocalhost;
}

function getHoursBack(timeframe: string): number {
  switch (timeframe) {
    case '1h': return 1;
    case '6h': return 6;
    case '24h': return 24;
    case '7d': return 24 * 7;
    case '30d': return 24 * 30;
    default: return 24;
  }
}

async function getMCPStats(since: Date, limit: number, sortBy: string) {
  try {
    // Get all executions since the specified time
    const { data: executions } = await supabase
      .from('mcp_execution_analytics')
      .select(`
        mcp_id,
        mcp_slug,
        execution_success,
        execution_duration_ms,
        execution_start_time
      `)
      .gte('execution_start_time', since.toISOString());

    if (!executions || executions.length === 0) {
      return [];
    }

    // Get MCP details
    const mcpIds = [...new Set(executions.map(e => e.mcp_id))];
    const { data: mcps } = await supabase
      .from('mcps')
      .select('id, name, slug, category, verified')
      .in('id', mcpIds);

    const mcpMap = new Map(mcps?.map(mcp => [mcp.id, mcp]) || []);

    // Group executions by MCP and calculate stats
    const mcpStats = new Map();

    executions.forEach(execution => {
      const mcpId = execution.mcp_id;
      const mcp = mcpMap.get(mcpId);
      
      if (!mcp) return;

      if (!mcpStats.has(mcpId)) {
        mcpStats.set(mcpId, {
          id: mcpId,
          name: mcp.name,
          slug: mcp.slug,
          category: mcp.category,
          verified: mcp.verified,
          executions_total: 0,
          executions_successful: 0,
          total_execution_time: 0,
          execution_times: [],
          first_execution: execution.execution_start_time,
          last_execution: execution.execution_start_time
        });
      }

      const stats = mcpStats.get(mcpId);
      stats.executions_total++;
      
      if (execution.execution_success) {
        stats.executions_successful++;
      }
      
      if (execution.execution_duration_ms) {
        stats.total_execution_time += execution.execution_duration_ms;
        stats.execution_times.push(execution.execution_duration_ms);
      }

      // Track time range
      if (execution.execution_start_time < stats.first_execution) {
        stats.first_execution = execution.execution_start_time;
      }
      if (execution.execution_start_time > stats.last_execution) {
        stats.last_execution = execution.execution_start_time;
      }
    });

    // Calculate final metrics and format results
    const results = Array.from(mcpStats.values()).map(stats => {
      const successRate = stats.executions_total > 0 
        ? stats.executions_successful / stats.executions_total 
        : 0;

      const avgExecutionTime = stats.execution_times.length > 0
        ? Math.round(stats.total_execution_time / stats.execution_times.length)
        : 0;

      // Calculate percentiles
      const sortedTimes = stats.execution_times.sort((a: number, b: number) => a - b);
      const p50 = sortedTimes.length > 0 
        ? sortedTimes[Math.floor(sortedTimes.length * 0.5)] 
        : 0;
      const p95 = sortedTimes.length > 0 
        ? sortedTimes[Math.floor(sortedTimes.length * 0.95)] 
        : 0;
      const p99 = sortedTimes.length > 0 
        ? sortedTimes[Math.floor(sortedTimes.length * 0.99)] 
        : 0;

      return {
        id: stats.id,
        name: stats.name,
        slug: stats.slug,
        category: stats.category,
        verified: stats.verified,
        executions_24h: stats.executions_total,
        success_rate: successRate,
        avg_execution_time: avgExecutionTime,
        median_execution_time: p50,
        p95_execution_time: p95,
        p99_execution_time: p99,
        error_count: stats.executions_total - stats.executions_successful,
        first_execution: stats.first_execution,
        last_execution: stats.last_execution,
        
        // Additional metrics
        executions_per_hour: calculateExecutionsPerHour(stats.executions_total, since),
        trending_score: calculateTrendingScore(stats.executions_total, successRate, avgExecutionTime),
        health_status: getHealthStatus(successRate, avgExecutionTime)
      };
    });

    // Sort based on requested criteria
    results.sort((a, b) => {
      switch (sortBy) {
        case 'success_rate':
          return b.success_rate - a.success_rate;
        case 'avg_time':
          return a.avg_execution_time - b.avg_execution_time;
        case 'trending':
          return b.trending_score - a.trending_score;
        case 'executions':
        default:
          return b.executions_24h - a.executions_24h;
      }
    });

    return results.slice(0, limit);

  } catch (error) {
    console.error('Error getting MCP stats:', error);
    return [];
  }
}

function calculateExecutionsPerHour(totalExecutions: number, since: Date): number {
  const hoursElapsed = (Date.now() - since.getTime()) / (1000 * 60 * 60);
  return hoursElapsed > 0 ? Math.round(totalExecutions / hoursElapsed) : 0;
}

function calculateTrendingScore(executions: number, successRate: number, avgTime: number): number {
  // Simple trending score: weight executions heavily, bonus for good performance
  let score = executions * 10;
  
  // Bonus for high success rate
  if (successRate > 0.95) score *= 1.2;
  else if (successRate > 0.9) score *= 1.1;
  else if (successRate < 0.8) score *= 0.8;
  
  // Penalty for slow execution
  if (avgTime > 5000) score *= 0.8;
  else if (avgTime > 2000) score *= 0.9;
  else if (avgTime < 500) score *= 1.1;
  
  return Math.round(score);
}

function getHealthStatus(successRate: number, avgTime: number): string {
  if (successRate < 0.8 || avgTime > 10000) return 'critical';
  if (successRate < 0.9 || avgTime > 5000) return 'warning';
  if (successRate >= 0.95 && avgTime < 2000) return 'excellent';
  return 'good';
}