/**
 * Next.js Instrumentation Hook for E14Z
 * Initializes logging and monitoring systems
 */

export async function register() {
  // Only run on Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Pino logging
    const { logger } = await import('./lib/logging/config');
    
    // Log application startup
    logger.info({
      event: 'application_startup',
      version: process.env.npm_package_version || '4.1.1',
      node_version: process.version,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }, 'E14Z application started');

    // Initialize error handling for unhandled promises
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({
        event: 'unhandled_rejection',
        reason: reason instanceof Error ? {
          name: reason.name,
          message: reason.message,
          stack: reason.stack,
        } : reason,
        promise: promise.toString(),
        timestamp: new Date().toISOString(),
      }, 'Unhandled promise rejection');
    });

    // Initialize error handling for uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal({
        event: 'uncaught_exception',
        error_name: error.name,
        error_message: error.message,
        error_stack: error.stack,
        timestamp: new Date().toISOString(),
      }, 'Uncaught exception');
      
      // Give logger time to flush before exiting
      setTimeout(() => process.exit(1), 100);
    });

    // Log graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info({
        event: 'application_shutdown',
        signal,
        timestamp: new Date().toISOString(),
      }, 'E14Z application shutting down');
      
      setTimeout(() => process.exit(0), 100);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }
}