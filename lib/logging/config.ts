/**
 * E14Z Structured Logging Configuration with Pino
 * High-performance JSON logging for production monitoring
 */

import pino from 'pino';

// Log levels for different environments
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Create different transports for development and production
const createTransport = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: JSON logging for log aggregation services
    return {
      target: 'pino/file',
      options: {
        destination: process.stdout.fd,
      },
    };
  } else {
    // Development: Pretty printing for better readability
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        levelFirst: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    };
  }
};

// Base logger configuration
export const loggerConfig = {
  level: logLevel,
  transport: createTransport(),
  formatters: {
    // Custom log formatting for better structure
    level: (label: string) => ({ level: label.toUpperCase() }),
    bindings: (bindings: any) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      node_version: process.version,
      environment: process.env.NODE_ENV,
    }),
  },
  // Add timestamp in ISO format for production
  timestamp: pino.stdTimeFunctions.isoTime,
  // Include source file information in development
  ...(process.env.NODE_ENV !== 'production' && {
    options: {
      caller: true,
    },
  }),
};

// Create the main logger instance
export const logger = pino(loggerConfig);

// Create specialized loggers for different domains
export const apiLogger = logger.child({ component: 'api' });
export const authLogger = logger.child({ component: 'auth' });
export const mcpLogger = logger.child({ component: 'mcp' });
export const autoInstallerLogger = logger.child({ component: 'auto-installer' });
export const securityLogger = logger.child({ component: 'security' });
export const performanceLogger = logger.child({ component: 'performance' });

// Log level helpers for consistent logging patterns
export const logPatterns = {
  // API request/response logging
  apiRequest: (method: string, url: string, userId?: string) => ({
    event: 'api_request',
    method,
    url,
    userId,
    timestamp: new Date().toISOString(),
  }),

  apiResponse: (method: string, url: string, status: number, duration: number, userId?: string) => ({
    event: 'api_response',
    method,
    url,
    status,
    duration_ms: duration,
    userId,
    timestamp: new Date().toISOString(),
  }),

  // MCP operation logging
  mcpDiscovery: (query: string, resultCount: number, filters?: any) => ({
    event: 'mcp_discovery',
    query,
    result_count: resultCount,
    filters,
    timestamp: new Date().toISOString(),
  }),

  mcpExecution: (slug: string, success: boolean, duration: number, error?: string) => ({
    event: 'mcp_execution',
    slug,
    success,
    duration_ms: duration,
    error,
    timestamp: new Date().toISOString(),
  }),

  // Auto-installation logging
  autoInstall: (slug: string, version: string, method: string, success: boolean, duration: number) => ({
    event: 'auto_install',
    slug,
    version,
    installation_method: method,
    success,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
  }),

  // Security event logging
  securityEvent: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: any) => ({
    event: 'security_event',
    security_event: event,
    severity,
    details,
    timestamp: new Date().toISOString(),
  }),

  // Performance metrics logging
  performance: (metric: string, value: number, unit: string, metadata?: any) => ({
    event: 'performance_metric',
    metric,
    value,
    unit,
    metadata,
    timestamp: new Date().toISOString(),
  }),

  // Error logging with context
  error: (error: Error, context?: any) => ({
    event: 'error',
    error_name: error.name,
    error_message: error.message,
    error_stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  }),
};

// Helper function to log with request context
export const withRequestContext = (req: Request, additionalContext?: any) => {
  const url = new URL(req.url);
  return {
    method: req.method,
    url: url.pathname,
    query: Object.fromEntries(url.searchParams),
    user_agent: req.headers.get('user-agent'),
    referer: req.headers.get('referer'),
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    ...additionalContext,
  };
};

export default logger;