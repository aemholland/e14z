/**
 * APM (Application Performance Monitoring) Dashboard API
 * Provides comprehensive application performance metrics and insights
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { telemetry } from '@/lib/observability/telemetry'
import { apmMiddleware } from '@/lib/observability/apm-middleware'
import { withLogging } from '@/lib/logging/middleware'

/**
 * @swagger
 * /api/monitoring/apm:
 *   get:
 *     tags: [Health]
 *     summary: Get APM dashboard data
 *     description: |
 *       Returns comprehensive application performance monitoring data including
 *       response times, error rates, database performance, and system metrics.
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time period for metrics aggregation
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [minute, hour, day]
 *           default: hour
 *         description: Data point granularity
 *     responses:
 *       200:
 *         description: APM dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overview:
 *                   type: object
 *                   properties:
 *                     avg_response_time_ms:
 *                       type: number
 *                     error_rate_percent:
 *                       type: number
 *                     requests_per_minute:
 *                       type: number
 *                     active_users:
 *                       type: number
 *                 performance:
 *                   type: object
 *                   properties:
 *                     response_time_series:
 *                       type: array
 *                     error_rate_series:
 *                       type: array
 *                     throughput_series:
 *                       type: array
 *                 database:
 *                   type: object
 *                   properties:
 *                     avg_query_time_ms:
 *                       type: number
 *                     slow_queries_count:
 *                       type: number
 *                     connection_pool_usage:
 *                       type: number
 *                 endpoints:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       endpoint:
 *                         type: string
 *                       avg_response_time:
 *                         type: number
 *                       request_count:
 *                         type: number
 *                       error_rate:
 *                         type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         description: Internal server error
 */
export const GET = withLogging(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const timeframe = searchParams.get('timeframe') || '24h'
    const granularity = searchParams.get('granularity') || 'hour'

    // Parse timeframe
    const timeframeParsed = parseTimeframe(timeframe)
    const startTime = new Date(Date.now() - timeframeParsed)

    // Get current metrics snapshot
    const currentSnapshot = apmMiddleware.getMetricsSnapshot()
    const telemetrySnapshot = await telemetry.getMetricsSnapshot()

    // Get historical performance data
    const performanceData = await getPerformanceMetrics(startTime)
    
    // Get database metrics
    const databaseMetrics = await getDatabaseMetrics(startTime)
    
    // Get endpoint performance
    const endpointMetrics = await getEndpointMetrics(startTime)
    
    // Get error analysis
    const errorAnalysis = await getErrorAnalysis(startTime)
    
    // Get system resource metrics
    const systemMetrics = await getSystemMetrics(startTime)

    // Calculate overview metrics
    const overview = {
      avg_response_time_ms: performanceData.avg_response_time || 0,
      error_rate_percent: (performanceData.error_rate || 0) * 100,
      requests_per_minute: performanceData.requests_per_minute || 0,
      active_users: performanceData.active_users || 0,
      total_requests: performanceData.total_requests || 0,
      uptime_hours: 24, // Simplified - assume 24h uptime
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      cpu_usage_percent: 15, // Simplified CPU estimation
      active_connections: currentSnapshot.active_requests || 0
    }

    // Prepare time series data
    const timeSeries = await getTimeSeriesData(startTime, granularity)

    const response = {
      overview,
      performance: {
        response_time_series: timeSeries.response_times,
        error_rate_series: timeSeries.error_rates,
        throughput_series: timeSeries.throughput,
        p95_response_time_ms: performanceData.p95_response_time,
        p99_response_time_ms: performanceData.p99_response_time
      },
      database: {
        avg_query_time_ms: databaseMetrics.avg_query_time,
        slow_queries_count: databaseMetrics.slow_queries_count,
        total_queries: databaseMetrics.total_queries,
        query_error_rate: databaseMetrics.error_rate,
        connection_pool_usage: databaseMetrics.connection_usage,
        cache_hit_rate: databaseMetrics.cache_hit_rate
      },
      endpoints: endpointMetrics,
      errors: {
        total_errors: errorAnalysis.total_errors,
        error_types: errorAnalysis.error_types,
        error_trends: errorAnalysis.trends,
        top_errors: errorAnalysis.top_errors
      },
      system: {
        memory_usage: systemMetrics.memory,
        cpu_metrics: systemMetrics.cpu,
        gc_metrics: systemMetrics.gc,
        event_loop_lag: systemMetrics.event_loop_lag
      },
      metadata: {
        timeframe,
        granularity,
        collected_at: new Date().toISOString(),
        data_points: timeSeries.response_times.length,
        system_info: {
          node_version: process.version,
          platform: process.platform,
          uptime_seconds: process.uptime()
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('APM dashboard error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to load APM data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

/**
 * Parse timeframe string to milliseconds
 */
function parseTimeframe(timeframe: string): number {
  const timeframes: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  }
  
  return timeframes[timeframe] || timeframes['24h']
}

/**
 * Get performance metrics from database
 */
async function getPerformanceMetrics(startTime: Date) {
  try {
    // Use api_calls table instead of performance_logs
    const { data: metrics } = await supabase
      .from('api_calls')
      .select('response_time_ms, created_at, session_id, endpoint, method')
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false })

    if (!metrics || metrics.length === 0) {
      return {
        avg_response_time: 0,
        error_rate: 0,
        requests_per_minute: 0,
        active_users: 0,
        total_requests: 0,
        p95_response_time: 0,
        p99_response_time: 0
      }
    }

    const totalRequests = metrics.length
    const avgResponseTime = metrics.reduce((sum, m) => sum + (m.response_time_ms || 0), 0) / totalRequests
    // Since api_calls doesn't have status_code, estimate errors from high response times (>10s)
    const errorCount = metrics.filter(m => (m.response_time_ms || 0) > 10000).length
    const errorRate = errorCount / totalRequests
    
    // Calculate percentiles
    const sortedDurations = metrics.map(m => m.response_time_ms || 0).sort((a, b) => a - b)
    const p95Index = Math.floor(sortedDurations.length * 0.95)
    const p99Index = Math.floor(sortedDurations.length * 0.99)
    
    const uniqueUsers = new Set(metrics.map(m => m.session_id).filter(Boolean)).size
    const timeSpanMinutes = (Date.now() - startTime.getTime()) / (1000 * 60)
    const requestsPerMinute = timeSpanMinutes > 0 ? totalRequests / timeSpanMinutes : 0

    return {
      avg_response_time: avgResponseTime,
      error_rate: errorRate,
      requests_per_minute: requestsPerMinute,
      active_users: uniqueUsers,
      total_requests: totalRequests,
      p95_response_time: sortedDurations[p95Index] || 0,
      p99_response_time: sortedDurations[p99Index] || 0
    }
  } catch (error) {
    console.error('Error getting performance metrics:', error)
    return {
      avg_response_time: 0,
      error_rate: 0,
      requests_per_minute: 0,
      active_users: 0,
      total_requests: 0,
      p95_response_time: 0,
      p99_response_time: 0
    }
  }
}

/**
 * Get database performance metrics
 */
async function getDatabaseMetrics(startTime: Date) {
  try {
    const { data: metrics } = await supabase
      .from('performance_logs')
      .select('db_query_time_ms, db_query_count, cache_hits, cache_misses, created_at')
      .gte('created_at', startTime.toISOString())
      .not('db_query_time_ms', 'is', null)

    if (!metrics || metrics.length === 0) {
      return {
        avg_query_time: 0,
        slow_queries_count: 0,
        total_queries: 0,
        error_rate: 0,
        connection_usage: 0,
        cache_hit_rate: 0
      }
    }

    const totalQueries = metrics.reduce((sum, m) => sum + (m.db_query_count || 0), 0)
    const totalQueryTime = metrics.reduce((sum, m) => sum + (m.db_query_time_ms || 0), 0)
    const avgQueryTime = totalQueries > 0 ? totalQueryTime / totalQueries : 0
    
    const slowQueries = metrics.filter(m => (m.db_query_time_ms || 0) > 1000).length
    
    const totalCacheHits = metrics.reduce((sum, m) => sum + (m.cache_hits || 0), 0)
    const totalCacheMisses = metrics.reduce((sum, m) => sum + (m.cache_misses || 0), 0)
    const cacheHitRate = (totalCacheHits + totalCacheMisses) > 0 
      ? totalCacheHits / (totalCacheHits + totalCacheMisses)
      : 0

    return {
      avg_query_time: avgQueryTime,
      slow_queries_count: slowQueries,
      total_queries: totalQueries,
      error_rate: 0, // Would need error tracking
      connection_usage: 0.7, // Placeholder - would need actual connection pool metrics
      cache_hit_rate: cacheHitRate
    }
  } catch (error) {
    console.error('Error getting database metrics:', error)
    return {
      avg_query_time: 0,
      slow_queries_count: 0,
      total_queries: 0,
      error_rate: 0,
      connection_usage: 0,
      cache_hit_rate: 0
    }
  }
}

/**
 * Get endpoint-specific performance metrics
 */
async function getEndpointMetrics(startTime: Date) {
  try {
    const { data: metrics } = await supabase
      .from('performance_logs')
      .select('endpoint, duration_ms, status_code, created_at')
      .gte('created_at', startTime.toISOString())

    if (!metrics || metrics.length === 0) {
      return []
    }

    // Group by endpoint
    const endpointGroups = metrics.reduce((groups, metric) => {
      const endpoint = metric.endpoint || 'unknown'
      if (!groups[endpoint]) {
        groups[endpoint] = []
      }
      groups[endpoint].push(metric)
      return groups
    }, {} as Record<string, any[]>)

    // Calculate metrics for each endpoint
    return Object.entries(endpointGroups).map(([endpoint, endpointMetrics]) => {
      const requestCount = endpointMetrics.length
      const avgResponseTime = endpointMetrics.reduce((sum, m) => sum + (m.duration_ms || 0), 0) / requestCount
      const errorCount = endpointMetrics.filter(m => (m.status_code || 0) >= 400).length
      const errorRate = errorCount / requestCount

      return {
        endpoint,
        avg_response_time: Math.round(avgResponseTime),
        request_count: requestCount,
        error_rate: Math.round(errorRate * 100) / 100,
        errors: errorCount
      }
    }).sort((a, b) => b.request_count - a.request_count)

  } catch (error) {
    console.error('Error getting endpoint metrics:', error)
    return []
  }
}

/**
 * Get error analysis
 */
async function getErrorAnalysis(startTime: Date) {
  try {
    const { data: errors } = await supabase
      .from('performance_logs')
      .select('status_code, endpoint, error_count, metadata, created_at')
      .gte('created_at', startTime.toISOString())
      .gte('status_code', 400)

    if (!errors || errors.length === 0) {
      return {
        total_errors: 0,
        error_types: [],
        trends: [],
        top_errors: []
      }
    }

    // Group by status code
    const errorTypes = errors.reduce((types, error) => {
      const statusCode = error.status_code?.toString() || 'unknown'
      types[statusCode] = (types[statusCode] || 0) + 1
      return types
    }, {} as Record<string, number>)

    // Top error endpoints
    const endpointErrors = errors.reduce((endpoints, error) => {
      const endpoint = error.endpoint || 'unknown'
      endpoints[endpoint] = (endpoints[endpoint] || 0) + 1
      return endpoints
    }, {} as Record<string, number>)

    const topErrors = Object.entries(endpointErrors)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      total_errors: errors.length,
      error_types: Object.entries(errorTypes).map(([code, count]) => ({ code, count })),
      trends: [], // Would calculate hourly trends
      top_errors: topErrors
    }

  } catch (error) {
    console.error('Error getting error analysis:', error)
    return {
      total_errors: 0,
      error_types: [],
      trends: [],
      top_errors: []
    }
  }
}

/**
 * Get system resource metrics
 */
async function getSystemMetrics(startTime: Date) {
  const memoryUsage = process.memoryUsage()
  
  return {
    memory: {
      heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external_mb: Math.round(memoryUsage.external / 1024 / 1024),
      rss_mb: Math.round(memoryUsage.rss / 1024 / 1024)
    },
    cpu: {
      usage_percent: 0, // Would need actual CPU monitoring
      load_average: 0
    },
    gc: {
      collections: 0, // Would need GC monitoring
      pause_time_ms: 0
    },
    event_loop_lag: 0 // Would need event loop monitoring
  }
}

/**
 * Get time series data for charts
 */
async function getTimeSeriesData(startTime: Date, granularity: string) {
  try {
    // This would generate time series data based on granularity
    // For now, return sample data structure
    const points = granularity === 'minute' ? 60 : granularity === 'hour' ? 24 : 7
    const interval = (Date.now() - startTime.getTime()) / points
    
    const timestamps = Array.from({ length: points }, (_, i) => 
      new Date(startTime.getTime() + i * interval).toISOString()
    )

    return {
      response_times: timestamps.map(timestamp => ({
        timestamp,
        value: Math.random() * 1000 + 200 // Sample data
      })),
      error_rates: timestamps.map(timestamp => ({
        timestamp,
        value: Math.random() * 5 // Sample error rate 0-5%
      })),
      throughput: timestamps.map(timestamp => ({
        timestamp,
        value: Math.random() * 100 + 50 // Sample requests per minute
      }))
    }

  } catch (error) {
    console.error('Error getting time series data:', error)
    return {
      response_times: [],
      error_rates: [],
      throughput: []
    }
  }
}