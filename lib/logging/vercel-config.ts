/**
 * Vercel-Optimized Logging Configuration
 * Configures Pino logging for optimal performance in Vercel's serverless environment
 */

import pino from 'pino';

// Vercel-optimized log level mapping
const VERCEL_LOG_LEVELS = {
  development: 'debug',
  preview: 'info', 
  production: 'warn'
} as const;

// Get environment-appropriate log level
function getLogLevel(): pino.Level {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL as pino.Level;
  }
  
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
  return VERCEL_LOG_LEVELS[env as keyof typeof VERCEL_LOG_LEVELS] || 'info';
}

// Vercel-specific log formatting
const vercelLogConfig: pino.LoggerOptions = {
  level: getLogLevel(),
  
  // Disable pretty printing in production for better performance
  transport: process.env.NODE_ENV === 'development' && process.env.LOG_PRETTY !== 'false' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false
    }
  } : undefined,
  
  // Base fields for all logs
  base: {
    service: 'e14z-mcp-registry',
    version: process.env.npm_package_version || '4.1.1',
    environment: process.env.NODE_ENV,
    vercel_region: process.env.VERCEL_REGION,
    vercel_url: process.env.VERCEL_URL,
    deployment_id: process.env.VERCEL_DEPLOYMENT_ID
  },
  
  // Performance optimizations for serverless
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
    bindings: (bindings: any) => {
      // Reduce log size by omitting some bindings in production
      if (process.env.NODE_ENV === 'production') {
        return {
          service: bindings.service,
          version: bindings.version,
          environment: bindings.environment
        };
      }
      return bindings;
    }
  },
  
  // Redact sensitive information
  redact: {
    paths: [
      'password',
      'pass',
      'authorization',
      'cookie',
      'access_token',
      'refresh_token',
      'secret',
      'key',
      'token',
      'JWT_SECRET_KEY',
      'ENCRYPTION_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]'
    ],
    censor: '[REDACTED]'
  }
};

// Create loggers
export const logger = pino(vercelLogConfig);

// Performance-focused logger for metrics
export const performanceLogger = logger.child({ 
  component: 'performance',
  // Reduce noise in production
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
});

// Security-focused logger for alerts
export const securityLogger = logger.child({ 
  component: 'security',
  // Always capture security events
  level: 'debug'
});

// Analytics logger for business metrics
export const analyticsLogger = logger.child({ 
  component: 'analytics',
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
});

// HTTP request logger
export const requestLogger = logger.child({ 
  component: 'http',
  level: getLogLevel()
});

// Database logger
export const dbLogger = logger.child({ 
  component: 'database',
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
});

// Custom log serializers for Vercel
const customSerializers = {
  req: (req: any) => {
    return {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-vercel-forwarded-for': req.headers['x-vercel-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip']
      },
      remoteAddress: req.socket?.remoteAddress,
      remotePort: req.socket?.remotePort
    };
  },
  
  res: (res: any) => {
    return {
      statusCode: res.statusCode,
      headers: {
        'content-type': res.getHeader?.('content-type'),
        'content-length': res.getHeader?.('content-length')
      }
    };
  },
  
  err: (err: Error) => {
    return {
      type: err.constructor.name,
      message: err.message,
      stack: err.stack,
      ...(err as any).toJSON?.()
    };
  }
};

// Add serializers to all loggers
Object.entries(customSerializers).forEach(([key, serializer]) => {
  logger.addSerializers({ [key]: serializer });
  performanceLogger.addSerializers({ [key]: serializer });
  securityLogger.addSerializers({ [key]: serializer });
  analyticsLogger.addSerializers({ [key]: serializer });
  requestLogger.addSerializers({ [key]: serializer });
  dbLogger.addSerializers({ [key]: serializer });
});

// Structured logging helpers
export const logHelpers = {
  // Log with request context
  withRequest: (req: any, logger: pino.Logger = logger) => {
    return logger.child({
      request_id: req.headers['x-request-id'] || generateRequestId(),
      user_id: req.user?.id,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      user_agent: req.headers['user-agent']
    });
  },
  
  // Log with performance timing
  withTiming: (operation: string, logger: pino.Logger = performanceLogger) => {
    const start = performance.now();
    return {
      logger: logger.child({ operation }),
      end: (additional?: any) => {
        const duration = performance.now() - start;
        logger.info({
          event: 'operation_completed',
          operation,
          duration_ms: Math.round(duration),
          ...additional
        }, `${operation} completed in ${Math.round(duration)}ms`);
        return duration;
      }
    };
  },
  
  // Log with error context
  withError: (error: Error, context?: any, logger: pino.Logger = securityLogger) => {
    return logger.child({
      error_type: error.constructor.name,
      error_message: error.message,
      ...context
    });
  },
  
  // Log analytics events
  analytics: (event: string, properties?: any, logger: pino.Logger = analyticsLogger) => {
    logger.info({
      event: 'analytics_event',
      event_name: event,
      properties,
      timestamp: new Date().toISOString()
    }, `Analytics: ${event}`);
  }
};

// Request ID generation
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export for instrumentation
export const vercelLogConfig = {
  logger,
  performanceLogger,
  securityLogger,
  analyticsLogger,
  requestLogger,
  dbLogger,
  logHelpers
};

// Log configuration info on startup
logger.info({
  event: 'logging_configured',
  log_level: getLogLevel(),
  environment: process.env.NODE_ENV,
  vercel_env: process.env.VERCEL_ENV,
  pretty_logs: process.env.LOG_PRETTY !== 'false' && process.env.NODE_ENV === 'development'
}, 'Vercel logging configuration initialized');