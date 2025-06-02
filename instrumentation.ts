/**
 * Next.js Instrumentation Hook for E14Z - Vercel Optimized
 * Initializes logging, monitoring, and alerting systems for Vercel deployment
 */

export async function register() {
  // Only run on Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      // Initialize Vercel-optimized logging
      const { logger, performanceLogger, securityLogger } = await import('./lib/logging/vercel-config');
      
      // Log application startup
      logger.info({
        event: 'application_startup',
        version: process.env.npm_package_version || '4.1.1',
        node_version: process.version,
        environment: process.env.NODE_ENV,
        vercel_env: process.env.VERCEL_ENV,
        vercel_region: process.env.VERCEL_REGION,
        vercel_deployment: process.env.VERCEL_DEPLOYMENT_ID,
        timestamp: new Date().toISOString(),
      }, 'E14Z application started on Vercel');

      // Initialize Vercel monitoring adapters
      try {
        const { vercelAnalytics, performanceMonitor, errorTracker } = await import('./lib/monitoring/vercel-adapter');
        
        // Initialize Vercel Analytics
        await vercelAnalytics.initialize();
        
        performanceLogger.info({ event: 'vercel_monitoring_initialized' }, 'Vercel monitoring systems started');
        
        // Store in global scope for access
        global.vercelMonitoring = {
          analytics: vercelAnalytics,
          performance: performanceMonitor,
          errorTracker: errorTracker
        };
        
      } catch (error) {
        securityLogger.error({ 
          event: 'vercel_monitoring_init_failed', 
          error: error instanceof Error ? error.message : String(error) 
        }, 'Failed to start Vercel monitoring');
      }

      // Initialize enhanced error handling for unhandled promises
      process.on('unhandledRejection', (reason, promise) => {
        securityLogger.error({
          event: 'unhandled_rejection',
          reason: reason instanceof Error ? {
            name: reason.name,
            message: reason.message,
            stack: reason.stack,
          } : reason,
          promise: promise.toString(),
          timestamp: new Date().toISOString(),
          vercel_region: process.env.VERCEL_REGION,
        }, 'Unhandled promise rejection');
        
        // Track error in Vercel monitoring
        if (global.vercelMonitoring?.errorTracker) {
          global.vercelMonitoring.errorTracker.captureException(
            reason instanceof Error ? reason : new Error(String(reason)),
            { type: 'unhandled_rejection' }
          );
        }
      });

      // Initialize enhanced error handling for uncaught exceptions
      process.on('uncaughtException', (error) => {
        securityLogger.fatal({
          event: 'uncaught_exception',
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          timestamp: new Date().toISOString(),
          vercel_region: process.env.VERCEL_REGION,
        }, 'Uncaught exception');
        
        // Track error in Vercel monitoring
        if (global.vercelMonitoring?.errorTracker) {
          global.vercelMonitoring.errorTracker.captureException(error, { 
            type: 'uncaught_exception',
            severity: 'fatal'
          });
        }
        
        // Give logger and monitoring time to flush before exiting
        setTimeout(() => process.exit(1), 2000);
      });

      // Graceful shutdown handling
      const gracefulShutdown = (signal: string) => {
        logger.info({
          event: 'application_shutdown',
          signal,
          timestamp: new Date().toISOString(),
          vercel_region: process.env.VERCEL_REGION,
        }, 'E14Z application shutting down');
        
        // Cleanup monitoring
        if (global.vercelMonitoring) {
          delete global.vercelMonitoring;
        }
        
        setTimeout(() => process.exit(0), 1000);
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      // Periodic health monitoring optimized for serverless
      startVercelHealthMonitoring(performanceLogger, securityLogger);

    } catch (error) {
      console.error('Instrumentation initialization failed:', error);
      // Don't crash the app if instrumentation fails
    }
  }
}

/**
 * Start health monitoring optimized for Vercel's serverless environment
 */
function startVercelHealthMonitoring(performanceLogger: any, securityLogger: any) {
  // Only start monitoring if we're not in a function execution
  if (typeof process.env.AWS_LAMBDA_FUNCTION_NAME !== 'undefined') {
    return; // Skip in Lambda/serverless function context
  }

  try {
    // Memory monitoring (less frequent for serverless)
    const memoryInterval = setInterval(() => {
      try {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
        const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;
        
        performanceLogger.debug({
          event: 'memory_usage',
          heap_used_mb: Math.round(heapUsedMB),
          heap_total_mb: Math.round(heapTotalMB),
          memory_usage_percent: Math.round(memoryUsagePercent),
          external_mb: Math.round(memUsage.external / 1024 / 1024),
          rss_mb: Math.round(memUsage.rss / 1024 / 1024),
          vercel_region: process.env.VERCEL_REGION
        }, 'Memory usage stats');
        
        // Alert on high memory usage (more aggressive for serverless)
        if (memoryUsagePercent > 80) {
          securityLogger.warn({
            event: 'high_memory_usage',
            heap_used_mb: Math.round(heapUsedMB),
            memory_usage_percent: Math.round(memoryUsagePercent),
            vercel_region: process.env.VERCEL_REGION
          }, 'High memory usage detected');
        }
        
        if (memoryUsagePercent > 90) {
          securityLogger.error({
            event: 'critical_memory_usage',
            heap_used_mb: Math.round(heapUsedMB),
            memory_usage_percent: Math.round(memoryUsagePercent),
            vercel_region: process.env.VERCEL_REGION
          }, 'Critical memory usage detected');
        }
      } catch (error) {
        securityLogger.error({ 
          event: 'memory_monitoring_failed', 
          error: error instanceof Error ? error.message : String(error) 
        }, 'Memory monitoring failed');
      }
    }, 60000); // Every minute for serverless
    
    // Store interval for cleanup
    global.healthMonitoringInterval = memoryInterval;
    
    // Cleanup on process exit
    process.on('exit', () => {
      if (global.healthMonitoringInterval) {
        clearInterval(global.healthMonitoringInterval);
      }
    });
    
  } catch (error) {
    securityLogger.error({
      event: 'health_monitoring_init_failed',
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to start health monitoring');
  }
}

// Type declarations for global variables
declare global {
  var vercelMonitoring: {
    analytics: any;
    performance: any;
    errorTracker: any;
  };
  var healthMonitoringInterval: NodeJS.Timeout;
}