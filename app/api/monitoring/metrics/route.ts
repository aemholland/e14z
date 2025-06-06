/**
 * Metrics API Endpoint (2025)
 * OpenTelemetry metrics exposure for Prometheus scraping
 */
import { NextRequest, NextResponse } from 'next/server'
import { apmCollector } from '@/lib/monitoring/apm-metrics-collector'
import { databaseMonitor } from '@/lib/monitoring/database-monitor'
import { logger } from '@/lib/logging/config'
import { trace, metrics } from '@opentelemetry/api'

const tracer = trace.getTracer('metrics-endpoint', '1.0.0')
const meter = metrics.getMeter('metrics-endpoint', '1.0.0')

// Metrics request counter
const metricsRequestCounter = meter.createCounter('metrics_requests_total', {
  description: 'Total metrics endpoint requests'
})

export async function GET(request: NextRequest) {
  const span = tracer.startSpan('metrics_endpoint')
  const startTime = Date.now()
  
  try {
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'prometheus'
    const include = url.searchParams.get('include')?.split(',') || ['all']
    
    span.setAttributes({
      'metrics.format': format,
      'metrics.include': include.join(',')
    })
    
    metricsRequestCounter.add(1, {
      format,
      user_agent: request.headers.get('user-agent') || 'unknown'
    })
    
    let responseBody: string
    let contentType: string
    
    switch (format) {
      case 'prometheus':
        responseBody = await generatePrometheusMetrics(include)
        contentType = 'text/plain; version=0.0.4; charset=utf-8'
        break
      
      case 'json':
        const jsonMetrics = await generateJSONMetrics(include)
        responseBody = JSON.stringify(jsonMetrics, null, 2)
        contentType = 'application/json'
        break
      
      case 'openmetrics':
        responseBody = await generateOpenMetrics(include)
        contentType = 'application/openmetrics-text; version=1.0.0; charset=utf-8'
        break
      
      default:
        throw new Error(`Unsupported format: ${format}`)
    }
    
    const responseTime = Date.now() - startTime
    
    span.setAttributes({
      'metrics.response_size': responseBody.length,
      'metrics.response_time_ms': responseTime
    })
    
    span.end()
    
    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Metrics-Generated-At': new Date().toISOString(),
        'X-Response-Time-Ms': responseTime.toString()
      }
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    span.recordException(error as Error)
    span.setAttributes({
      'metrics.error': errorMessage
    })
    
    logger.error('Metrics endpoint error:', error)
    
    span.end()
    
    return NextResponse.json({
      error: 'Failed to generate metrics',
      message: errorMessage,
      timestamp: new Date().toISOString()
    }, {
      status: 500
    })
  }
}

async function generatePrometheusMetrics(include: string[]): Promise<string> {
  const metrics: string[] = []
  
  // Add metadata
  metrics.push('# HELP e14z_info E14Z service information')
  metrics.push('# TYPE e14z_info gauge')
  metrics.push(`e14z_info{version="${process.env.npm_package_version || '1.0.0'}",environment="${process.env.NODE_ENV || 'development'}"} 1`)
  metrics.push('')
  
  if (include.includes('all') || include.includes('system')) {
    await addSystemMetrics(metrics)
  }
  
  if (include.includes('all') || include.includes('application')) {
    await addApplicationMetrics(metrics)
  }
  
  if (include.includes('all') || include.includes('database')) {
    await addDatabaseMetrics(metrics)
  }
  
  if (include.includes('all') || include.includes('business')) {
    await addBusinessMetrics(metrics)
  }
  
  return metrics.join('\n')
}

async function addSystemMetrics(metrics: string[]): Promise<void> {
  const memUsage = process.memoryUsage()
  const uptime = process.uptime()
  
  // Memory metrics
  metrics.push('# HELP nodejs_memory_usage_bytes Node.js memory usage in bytes')
  metrics.push('# TYPE nodejs_memory_usage_bytes gauge')
  metrics.push(`nodejs_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed}`)
  metrics.push(`nodejs_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal}`)
  metrics.push(`nodejs_memory_usage_bytes{type="external"} ${memUsage.external}`)
  metrics.push(`nodejs_memory_usage_bytes{type="rss"} ${memUsage.rss}`)
  metrics.push('')
  
  // Uptime
  metrics.push('# HELP nodejs_uptime_seconds Node.js uptime in seconds')
  metrics.push('# TYPE nodejs_uptime_seconds counter')
  metrics.push(`nodejs_uptime_seconds ${uptime}`)
  metrics.push('')
  
  // Process info
  metrics.push('# HELP nodejs_process_info Node.js process information')
  metrics.push('# TYPE nodejs_process_info gauge')
  metrics.push(`nodejs_process_info{version="${process.version}",pid="${process.pid}"} 1`)
  metrics.push('')
}

async function addApplicationMetrics(metrics: string[]): Promise<void> {
  try {
    // Simplified metrics for now
    const apmMetrics = { httpRequests: 0, errors: 0 }
    
    // HTTP request metrics
    metrics.push('# HELP http_requests_total Total HTTP requests')
    metrics.push('# TYPE http_requests_total counter')
    metrics.push(`http_requests_total 0`) // Would use actual metrics from APM
    metrics.push('')
    
    // HTTP request duration
    metrics.push('# HELP http_request_duration_seconds HTTP request duration in seconds')
    metrics.push('# TYPE http_request_duration_seconds histogram')
    metrics.push(`http_request_duration_seconds_bucket{le="0.1"} 0`)
    metrics.push(`http_request_duration_seconds_bucket{le="0.5"} 0`)
    metrics.push(`http_request_duration_seconds_bucket{le="1.0"} 0`)
    metrics.push(`http_request_duration_seconds_bucket{le="+Inf"} 0`)
    metrics.push(`http_request_duration_seconds_sum 0`)
    metrics.push(`http_request_duration_seconds_count 0`)
    metrics.push('')
    
    // MCP execution metrics
    metrics.push('# HELP mcp_executions_total Total MCP executions')
    metrics.push('# TYPE mcp_executions_total counter')
    metrics.push(`mcp_executions_total 0`) // Would use actual metrics
    metrics.push('')
    
    metrics.push('# HELP mcp_execution_duration_seconds MCP execution duration in seconds')
    metrics.push('# TYPE mcp_execution_duration_seconds histogram')
    metrics.push(`mcp_execution_duration_seconds_bucket{le="1.0"} 0`)
    metrics.push(`mcp_execution_duration_seconds_bucket{le="5.0"} 0`)
    metrics.push(`mcp_execution_duration_seconds_bucket{le="10.0"} 0`)
    metrics.push(`mcp_execution_duration_seconds_bucket{le="+Inf"} 0`)
    metrics.push(`mcp_execution_duration_seconds_sum 0`)
    metrics.push(`mcp_execution_duration_seconds_count 0`)
    metrics.push('')
  } catch (error) {
    logger.warn('Error adding application metrics:', error)
  }
}

async function addDatabaseMetrics(metrics: string[]): Promise<void> {
  try {
    // Simplified database metrics for now
    const dbMetrics = { 
      activeConnections: 0, 
      idleConnections: 0, 
      totalConnections: 0,
      averageQueryTime: 0,
      cacheHitRatio: 0,
      connectionUtilization: 0,
      analyticsTableSize: 0,
      mcpTableSize: 0,
      reviewsTableSize: 0
    }
    
    // Database connections
    metrics.push('# HELP database_connections Database connections')
    metrics.push('# TYPE database_connections gauge')
    metrics.push(`database_connections{type="active"} ${dbMetrics.activeConnections || 0}`)
    metrics.push(`database_connections{type="idle"} ${dbMetrics.idleConnections || 0}`)
    metrics.push(`database_connections{type="total"} ${dbMetrics.totalConnections || 0}`)
    metrics.push('')
    
    // Database query duration
    metrics.push('# HELP database_query_duration_seconds Database query duration in seconds')
    metrics.push('# TYPE database_query_duration_seconds histogram')
    metrics.push(`database_query_duration_seconds_bucket{le="0.001"} 0`)
    metrics.push(`database_query_duration_seconds_bucket{le="0.01"} 0`)
    metrics.push(`database_query_duration_seconds_bucket{le="0.1"} 0`)
    metrics.push(`database_query_duration_seconds_bucket{le="1.0"} 0`)
    metrics.push(`database_query_duration_seconds_bucket{le="+Inf"} 0`)
    metrics.push(`database_query_duration_seconds_sum ${(dbMetrics.averageQueryTime || 0) / 1000}`)
    metrics.push(`database_query_duration_seconds_count 0`)
    metrics.push('')
    
    // Cache hit ratio
    metrics.push('# HELP database_cache_hit_ratio Database cache hit ratio')
    metrics.push('# TYPE database_cache_hit_ratio gauge')
    metrics.push(`database_cache_hit_ratio ${dbMetrics.cacheHitRatio || 0}`)
    metrics.push('')
    
    // Table sizes
    metrics.push('# HELP database_table_size_bytes Database table size in bytes')
    metrics.push('# TYPE database_table_size_bytes gauge')
    metrics.push(`database_table_size_bytes{table="mcp_execution_analytics"} ${dbMetrics.analyticsTableSize || 0}`)
    metrics.push(`database_table_size_bytes{table="mcps"} ${dbMetrics.mcpTableSize || 0}`)
    metrics.push(`database_table_size_bytes{table="mcp_reviews"} ${dbMetrics.reviewsTableSize || 0}`)
    metrics.push('')
  } catch (error) {
    logger.warn('Error adding database metrics:', error)
  }
}

async function addBusinessMetrics(metrics: string[]): Promise<void> {
  try {
    // These would come from actual business logic
    metrics.push('# HELP e14z_active_users Current active users')
    metrics.push('# TYPE e14z_active_users gauge')
    metrics.push(`e14z_active_users 0`)
    metrics.push('')
    
    metrics.push('# HELP e14z_total_mcps Total number of MCPs in registry')
    metrics.push('# TYPE e14z_total_mcps gauge')
    metrics.push(`e14z_total_mcps 0`)
    metrics.push('')
    
    metrics.push('# HELP e14z_mcp_executions_success_rate MCP execution success rate')
    metrics.push('# TYPE e14z_mcp_executions_success_rate gauge')
    metrics.push(`e14z_mcp_executions_success_rate 0.95`)
    metrics.push('')
  } catch (error) {
    logger.warn('Error adding business metrics:', error)
  }
}

async function generateJSONMetrics(include: string[]): Promise<any> {
  const result: any = {
    timestamp: new Date().toISOString(),
    service: 'e14z-registry',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    metrics: {}
  }
  
  if (include.includes('all') || include.includes('system')) {
    const memUsage = process.memoryUsage()
    result.metrics.system = {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      uptime: process.uptime(),
      nodeVersion: process.version,
      pid: process.pid
    }
  }
  
  if (include.includes('all') || include.includes('application')) {
    result.metrics.application = {
      requests: {
        total: 0,
        errors: 0,
        averageResponseTime: 0
      },
      mcp: {
        executions: 0,
        successRate: 0.95,
        averageExecutionTime: 0
      }
    }
  }
  
  if (include.includes('all') || include.includes('database')) {
    try {
      // Simplified database metrics for now
    const dbMetrics = { 
      activeConnections: 0, 
      idleConnections: 0, 
      totalConnections: 0,
      averageQueryTime: 0,
      cacheHitRatio: 0,
      connectionUtilization: 0,
      analyticsTableSize: 0,
      mcpTableSize: 0,
      reviewsTableSize: 0
    }
      result.metrics.database = {
        connections: {
          active: dbMetrics.activeConnections || 0,
          idle: dbMetrics.idleConnections || 0,
          total: dbMetrics.totalConnections || 0
        },
        performance: {
          averageQueryTime: dbMetrics.averageQueryTime || 0,
          slowQueries: 0,
          cacheHitRatio: dbMetrics.cacheHitRatio || 0
        },
        tables: {
          analyticsSize: dbMetrics.analyticsTableSize || 0,
          mcpSize: dbMetrics.mcpTableSize || 0,
          reviewsSize: dbMetrics.reviewsTableSize || 0
        }
      }
    } catch (error) {
      result.metrics.database = { error: 'Failed to collect database metrics' }
    }
  }
  
  return result
}

async function generateOpenMetrics(include: string[]): Promise<string> {
  // OpenMetrics format (similar to Prometheus but with additional metadata)
  const metrics: string[] = []
  
  metrics.push('# HELP e14z_info E14Z service information')
  metrics.push('# TYPE e14z_info info')
  metrics.push(`e14z_info{version="${process.env.npm_package_version || '1.0.0'}",environment="${process.env.NODE_ENV || 'development'}"} 1`)
  metrics.push('')
  
  // Add standard Prometheus metrics with OpenMetrics extensions
  await addSystemMetrics(metrics)
  
  if (include.includes('all') || include.includes('application')) {
    await addApplicationMetrics(metrics)
  }
  
  // Add OpenMetrics EOF
  metrics.push('# EOF')
  
  return metrics.join('\n')
}