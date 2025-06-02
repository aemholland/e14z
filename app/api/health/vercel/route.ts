/**
 * Vercel-Optimized Health Check API
 * Provides comprehensive health monitoring for Vercel deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { healthCheck, performanceMonitor, memoryMonitor, errorTracker } from '../../../../lib/monitoring/vercel-adapter';
import { performanceLogger, securityLogger } from '../../../../lib/logging/vercel-config';

// Export named functions for Vercel
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    const component = searchParams.get('component');

    // Quick health check
    if (!detailed && !component) {
      return NextResponse.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        region: process.env.VERCEL_REGION,
        deployment: process.env.VERCEL_DEPLOYMENT_ID 
      });
    }

    // Component-specific health check
    if (component) {
      const result = await getComponentHealth(component);
      return NextResponse.json(result);
    }

    // Detailed health check
    const healthData = await getDetailedHealth();
    const duration = performance.now() - startTime;

    // Log health check
    performanceLogger.info({
      event: 'health_check_completed',
      duration_ms: Math.round(duration),
      healthy: healthData.status === 'healthy'
    }, `Health check completed in ${Math.round(duration)}ms`);

    return NextResponse.json(healthData);

  } catch (error) {
    const duration = performance.now() - startTime;
    
    securityLogger.error({
      event: 'health_check_failed',
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Math.round(duration)
    }, 'Health check failed');

    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

async function getComponentHealth(component: string) {
  const startTime = performance.now();
  
  try {
    let result;
    
    switch (component) {
      case 'database':
        result = await healthCheck.runDatabaseCheck();
        break;
      case 'redis':
        result = await healthCheck.runRedisCheck();
        break;
      case 'memory':
        result = getMemoryHealth();
        break;
      case 'performance':
        result = getPerformanceHealth();
        break;
      default:
        return {
          status: 'error',
          message: `Unknown component: ${component}`,
          available: ['database', 'redis', 'memory', 'performance']
        };
    }

    const duration = performance.now() - startTime;
    
    return {
      component,
      status: result.success ? 'healthy' : 'unhealthy',
      ...result,
      check_duration_ms: Math.round(duration),
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      component,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

async function getDetailedHealth() {
  const startTime = performance.now();
  
  // Run all health checks
  const healthChecks = await healthCheck.runFullHealthCheck();
  
  // Get system metrics
  const memorySnapshot = memoryMonitor.snapshot('health_check');
  const performanceMetrics = performanceMonitor.reportMetrics();
  const errorStats = errorTracker.getErrorStats();
  
  // Calculate overall health
  const allChecksHealthy = Object.values(healthChecks).every(check => check.success);
  const memoryHealthy = (memorySnapshot.heapUsed / memorySnapshot.heapTotal) < 0.9;
  const errorRateHealthy = errorStats.errorCount < 10; // Less than 10 errors is healthy
  
  const overallHealthy = allChecksHealthy && memoryHealthy && errorRateHealthy;
  
  const duration = performance.now() - startTime;
  
  return {
    status: overallHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    check_duration_ms: Math.round(duration),
    
    // System info
    system: {
      node_version: process.version,
      uptime_seconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV,
      vercel_region: process.env.VERCEL_REGION,
      vercel_deployment: process.env.VERCEL_DEPLOYMENT_ID,
      memory_usage: {
        heap_used_mb: Math.round(memorySnapshot.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memorySnapshot.heapTotal / 1024 / 1024),
        heap_usage_percent: Math.round((memorySnapshot.heapUsed / memorySnapshot.heapTotal) * 100),
        external_mb: Math.round(memorySnapshot.external / 1024 / 1024),
        rss_mb: Math.round(memorySnapshot.rss / 1024 / 1024)
      }
    },
    
    // Health checks
    checks: healthChecks,
    
    // Performance metrics
    performance: {
      metrics: performanceMetrics,
      error_stats: errorStats
    },
    
    // Feature availability
    features: {
      analytics: !!process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ID,
      redis: !!process.env.UPSTASH_REDIS_REST_URL,
      monitoring: !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      error_tracking: !!(process.env.SENTRY_DSN || process.env.ERROR_TRACKING_WEBHOOK)
    }
  };
}

function getMemoryHealth() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;
  
  return {
    name: 'memory',
    success: memoryUsagePercent < 90,
    error: memoryUsagePercent >= 90 ? `High memory usage: ${Math.round(memoryUsagePercent)}%` : null,
    duration: 0,
    timestamp: Date.now(),
    details: {
      heap_used_mb: Math.round(heapUsedMB),
      heap_total_mb: Math.round(heapTotalMB),
      usage_percent: Math.round(memoryUsagePercent),
      external_mb: Math.round(memUsage.external / 1024 / 1024),
      rss_mb: Math.round(memUsage.rss / 1024 / 1024)
    }
  };
}

function getPerformanceHealth() {
  const metrics = performanceMonitor.reportMetrics();
  const hasMetrics = Object.keys(metrics).length > 0;
  
  // Check if any operations are running slow
  const slowOperations = Object.entries(metrics).filter(([name, stats]) => {
    return stats && stats.avg > 5000; // 5 seconds is considered slow
  });
  
  return {
    name: 'performance',
    success: slowOperations.length === 0,
    error: slowOperations.length > 0 ? `Slow operations detected: ${slowOperations.map(([name]) => name).join(', ')}` : null,
    duration: 0,
    timestamp: Date.now(),
    details: {
      has_metrics: hasMetrics,
      total_operations: Object.keys(metrics).length,
      slow_operations: slowOperations.length,
      metrics: hasMetrics ? metrics : null
    }
  };
}

// Simple HEAD request for basic uptime checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}