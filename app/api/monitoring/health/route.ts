/**
 * Health Monitoring API Endpoint (2025)
 * Comprehensive system health checks with APM integration
 */
import { NextRequest, NextResponse } from 'next/server'
import { apmCollector } from '@/lib/monitoring/apm-metrics-collector'
import { databaseMonitor } from '@/lib/monitoring/database-monitor'
import { logger } from '@/lib/logging/config'
import { trace } from '@opentelemetry/api'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  environment: string
  uptime: number
  checks: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      responseTime: number
      issues: string[]
    }
    memory: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      usage: number
      limit: number
      percentage: number
    }
    api: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      averageResponseTime: number
      errorRate: number
    }
    external: {
      supabase: 'healthy' | 'degraded' | 'unhealthy'
      opentelemetry: 'healthy' | 'degraded' | 'unhealthy'
    }
  }
  metrics: {
    requests: {
      total: number
      ratePerMinute: number
      errors: number
      errorRate: number
    }
    performance: {
      averageResponseTime: number
      p95ResponseTime: number
      p99ResponseTime: number
    }
    resources: {
      memoryUsage: number
      cpuUsage: number
      eventLoopLag: number
    }
  }
}

const tracer = trace.getTracer('health-check', '1.0.0')

export async function GET(request: NextRequest) {
  const span = tracer.startSpan('health_check')
  const startTime = Date.now()
  
  try {
    // Detailed health check parameter
    const url = new URL(request.url)
    const detailed = url.searchParams.get('detailed') === 'true'
    const include = url.searchParams.get('include')?.split(',') || []
    
    span.setAttributes({
      'health.detailed': detailed,
      'health.include': include.join(',')
    })
    
    // Basic health status
    const healthCheck: HealthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      checks: {
        database: {
          status: 'healthy',
          responseTime: 0,
          issues: []
        },
        memory: {
          status: 'healthy',
          usage: 0,
          limit: 0,
          percentage: 0
        },
        api: {
          status: 'healthy',
          averageResponseTime: 0,
          errorRate: 0
        },
        external: {
          supabase: 'healthy',
          opentelemetry: 'healthy'
        }
      },
      metrics: {
        requests: {
          total: 0,
          ratePerMinute: 0,
          errors: 0,
          errorRate: 0
        },
        performance: {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0
        },
        resources: {
          memoryUsage: 0,
          cpuUsage: 0,
          eventLoopLag: 0
        }
      }
    }
    
    // Parallel health checks
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkMemory(),
      detailed ? checkExternalServices() : Promise.resolve(null),
      detailed ? getMetrics() : Promise.resolve(null)
    ])
    
    // Process database check
    if (checks[0].status === 'fulfilled' && checks[0].value) {
      healthCheck.checks.database = checks[0].value
      if (checks[0].value.status !== 'healthy') {
        healthCheck.status = checks[0].value.status
      }
    } else {
      healthCheck.checks.database.status = 'unhealthy'
      healthCheck.checks.database.issues = ['Database check failed']
      healthCheck.status = 'unhealthy'
    }
    
    // Process memory check
    if (checks[1].status === 'fulfilled' && checks[1].value) {
      healthCheck.checks.memory = checks[1].value
      if (checks[1].value.status !== 'healthy' && healthCheck.status === 'healthy') {
        healthCheck.status = checks[1].value.status
      }
    }
    
    // Process external services check (if detailed)
    if (detailed && checks[2].status === 'fulfilled' && checks[2].value) {
      healthCheck.checks.external = checks[2].value
    }
    
    // Process metrics (if detailed)
    if (detailed && checks[3].status === 'fulfilled' && checks[3].value) {
      healthCheck.metrics = checks[3].value
    }
    
    const responseTime = Date.now() - startTime
    
    span.setAttributes({
      'health.status': healthCheck.status,
      'health.response_time_ms': responseTime,
      'health.database_status': healthCheck.checks.database.status,
      'health.memory_percentage': healthCheck.checks.memory.percentage
    })
    
    // Determine HTTP status code
    const httpStatus = healthCheck.status === 'healthy' ? 200 :
                      healthCheck.status === 'degraded' ? 200 : 503
    
    // Log health check
    logger.info('Health check completed', {
      status: healthCheck.status,
      responseTime,
      checks: Object.keys(healthCheck.checks).reduce((acc, key) => {
        const check = healthCheck.checks[key as keyof typeof healthCheck.checks]
        if (key === 'external' && typeof check === 'object' && check !== null && 'supabase' in check) {
          acc[key] = `supabase:${check.supabase}, opentelemetry:${check.opentelemetry}`
        } else if (typeof check === 'object' && check !== null && 'status' in check) {
          acc[key] = check.status
        } else {
          acc[key] = 'unknown'
        }
        return acc
      }, {} as Record<string, string>)
    })
    
    span.end()
    
    return NextResponse.json(healthCheck, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check-Time': responseTime.toString(),
        'X-Service-Version': healthCheck.version
      }
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    span.recordException(error as Error)
    span.setAttributes({
      'health.status': 'unhealthy',
      'health.error': errorMessage
    })
    
    logger.error('Health check failed:', error)
    
    span.end()
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: errorMessage,
      uptime: process.uptime()
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

async function checkDatabase() {
  const startTime = Date.now()
  
  try {
    const dbHealth = await databaseMonitor.checkDatabaseHealth()
    const responseTime = Date.now() - startTime
    
    return {
      status: dbHealth.status,
      responseTime,
      issues: dbHealth.issues
    }
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      responseTime: Date.now() - startTime,
      issues: ['Database connection failed']
    }
  }
}

async function checkMemory() {
  const memUsage = process.memoryUsage()
  const totalMem = memUsage.heapTotal
  const usedMem = memUsage.heapUsed
  const percentage = (usedMem / totalMem) * 100
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  
  if (percentage > 90) {
    status = 'unhealthy'
  } else if (percentage > 75) {
    status = 'degraded'
  }
  
  return {
    status,
    usage: usedMem,
    limit: totalMem,
    percentage: Math.round(percentage * 100) / 100
  }
}

async function checkExternalServices() {
  const checks = await Promise.allSettled([
    checkSupabase(),
    checkOpenTelemetry()
  ])
  
  return {
    supabase: checks[0].status === 'fulfilled' ? checks[0].value : 'unhealthy',
    opentelemetry: checks[1].status === 'fulfilled' ? checks[1].value : 'unhealthy'
  }
}

async function checkSupabase(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    const startTime = Date.now()
    
    // Simple query to test Supabase connection
    const metrics = await databaseMonitor.collectMetrics()
    
    const responseTime = Date.now() - startTime
    
    // Check if metrics collection was successful and response time is reasonable
    if (responseTime > 5000) {
      return 'degraded'
    }
    
    // Additional check: if metrics show concerning values, mark as degraded
    if (metrics.connectionUtilization > 0.9 || metrics.cacheHitRatio < 0.8) {
      return 'degraded'
    }
    
    return 'healthy'
  } catch (error) {
    return 'unhealthy'
  }
}

async function checkOpenTelemetry(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    // Check if OpenTelemetry is properly initialized
    const span = tracer.startSpan('otel_health_check')
    span.setAttributes({ 'test': 'health_check' })
    span.end()
    
    return 'healthy'
  } catch (error) {
    return 'unhealthy'
  }
}

async function getMetrics() {
  try {
    const apmMetrics = await apmCollector.getHealthMetrics()
    
    return {
      requests: {
        total: 0, // Would come from actual metrics
        ratePerMinute: 0,
        errors: 0,
        errorRate: 0
      },
      performance: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      },
      resources: {
        memoryUsage: apmMetrics.system.heap.used,
        cpuUsage: 0, // Would calculate from CPU metrics
        eventLoopLag: apmMetrics.system.eventLoopLag
      }
    }
  } catch (error) {
    return {
      requests: { total: 0, ratePerMinute: 0, errors: 0, errorRate: 0 },
      performance: { averageResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0 },
      resources: { memoryUsage: 0, cpuUsage: 0, eventLoopLag: 0 }
    }
  }
}

// Readiness probe endpoint
export async function HEAD(request: NextRequest) {
  try {
    // Quick readiness check
    const memUsage = process.memoryUsage()
    const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100
    
    if (memPercentage > 95) {
      return new NextResponse(null, { status: 503 })
    }
    
    return new NextResponse(null, { status: 200 })
  } catch (error) {
    return new NextResponse(null, { status: 503 })
  }
}