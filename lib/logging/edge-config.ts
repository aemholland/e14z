/**
 * E14Z Edge Runtime Logging Configuration
 * Lightweight logging for Next.js middleware (Edge Runtime compatible)
 */

// Simple log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Edge-compatible logger interface
interface EdgeLogger {
  debug: (data: any, msg?: string) => void;
  info: (data: any, msg?: string) => void;
  warn: (data: any, msg?: string) => void;
  error: (data: any, msg?: string) => void;
}

/**
 * Create edge-compatible logger that uses console methods
 */
function createEdgeLogger(component: string): EdgeLogger {
  const log = (level: LogLevel, data: any, msg?: string) => {
    // Only log in development or if explicitly enabled
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_EDGE_LOGGING === 'true') {
      const logData = {
        level: level.toUpperCase(),
        component,
        timestamp: new Date().toISOString(),
        ...(typeof data === 'object' ? data : { message: data }),
        ...(msg && { msg }),
      };
      
      console[level === 'debug' ? 'log' : level](JSON.stringify(logData));
    }
  };

  return {
    debug: (data, msg) => log('debug', data, msg),
    info: (data, msg) => log('info', data, msg),
    warn: (data, msg) => log('warn', data, msg),
    error: (data, msg) => log('error', data, msg),
  };
}

// Export edge-compatible loggers
export const securityLogger = createEdgeLogger('security');
export const performanceLogger = createEdgeLogger('performance');
export const middlewareLogger = createEdgeLogger('middleware');

// Log patterns for edge runtime
export const edgeLogPatterns = {
  rateLimitExceeded: (identifier: string, endpoint: string, limit: number, window: string) => ({
    event: 'rate_limit_exceeded',
    identifier,
    endpoint,
    limit,
    window,
    timestamp: new Date().toISOString(),
  }),

  rateLimitPassed: (identifier: string, endpoint: string, remaining: number) => ({
    event: 'rate_limit_passed',
    identifier,
    endpoint,
    remaining,
    timestamp: new Date().toISOString(),
  }),

  middlewareError: (error: Error, context?: any) => ({
    event: 'middleware_error',
    error_name: error.name,
    error_message: error.message,
    context,
    timestamp: new Date().toISOString(),
  }),

  securityEvent: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: any) => ({
    event: 'security_event',
    security_event: event,
    severity,
    details,
    timestamp: new Date().toISOString(),
  }),
};