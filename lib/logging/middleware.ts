/**
 * E14Z API Logging Middleware
 * Automatically logs all API requests and responses with structured data
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiLogger, logPatterns, withRequestContext } from './config';

export interface LoggedRequest extends NextRequest {
  startTime?: number;
  userId?: string;
}

/**
 * Middleware to log API requests and responses
 */
export function withLogging<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Extract user ID from request if available (from auth headers, JWT, etc.)
    const userId = extractUserId(req);
    
    // Create request context for logging
    const requestContext = withRequestContext(req, {
      request_id: requestId,
      user_id: userId,
    });

    // Log incoming request
    apiLogger.info({
      ...logPatterns.apiRequest(req.method, requestContext.url, userId),
      request_id: requestId,
      ...requestContext,
    }, `API Request: ${req.method} ${requestContext.url}`);

    let response: NextResponse;
    let error: Error | null = null;

    try {
      // Execute the API handler
      response = await handler(req, ...args);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      
      // Log the error
      apiLogger.error({
        ...logPatterns.error(error, requestContext),
        request_id: requestId,
      }, `API Error: ${req.method} ${requestContext.url}`);
      
      // Create error response
      response = NextResponse.json(
        { error: 'Internal server error', request_id: requestId },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    const statusCode = response.status;

    // Log response with appropriate level based on status code
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    apiLogger[logLevel]({
      ...logPatterns.apiResponse(req.method, requestContext.url, statusCode, duration, userId),
      request_id: requestId,
      response_size: response.headers.get('content-length'),
      error: error ? {
        name: error.name,
        message: error.message,
      } : undefined,
    }, `API Response: ${req.method} ${requestContext.url} - ${statusCode} (${duration}ms)`);

    // Add request ID to response headers for tracking
    response.headers.set('x-request-id', requestId);
    
    return response;
  };
}

/**
 * Performance tracking wrapper for critical operations
 */
export function withPerformanceLogging<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    const operationId = generateRequestId();

    try {
      apiLogger.debug({
        event: 'operation_start',
        operation,
        operation_id: operationId,
        timestamp: new Date().toISOString(),
      }, `Starting operation: ${operation}`);

      const result = await fn();
      const duration = Date.now() - startTime;

      apiLogger.info({
        ...logPatterns.performance(operation, duration, 'ms', {
          operation_id: operationId,
          success: true,
        }),
      }, `Operation completed: ${operation} (${duration}ms)`);

      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      apiLogger.error({
        ...logPatterns.error(err, {
          operation,
          operation_id: operationId,
          duration_ms: duration,
        }),
      }, `Operation failed: ${operation} (${duration}ms)`);

      reject(error);
    }
  });
}

/**
 * Security event logging helper
 */
export function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any,
  req?: NextRequest
) {
  const context = req ? withRequestContext(req) : {};
  
  apiLogger.warn({
    ...logPatterns.securityEvent(event, severity, details),
    ...context,
  }, `Security Event: ${event} (${severity})`);
}

/**
 * MCP operation logging helper
 */
export function logMCPOperation(
  operation: 'discovery' | 'execution' | 'installation' | 'review',
  slug: string,
  success: boolean,
  duration: number,
  metadata?: any
) {
  const logData = {
    event: `mcp_${operation}`,
    slug,
    success,
    duration_ms: duration,
    ...metadata,
    timestamp: new Date().toISOString(),
  };

  if (success) {
    apiLogger.info(logData, `MCP ${operation} successful: ${slug} (${duration}ms)`);
  } else {
    apiLogger.warn(logData, `MCP ${operation} failed: ${slug} (${duration}ms)`);
  }
}

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract user ID from request (placeholder - implement based on auth system)
 */
function extractUserId(req: NextRequest): string | undefined {
  // TODO: Implement based on your authentication system
  // Examples:
  // - JWT token in Authorization header
  // - Session cookie
  // - API key in headers
  
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Extract from JWT token
    try {
      // Placeholder - implement JWT decoding
      return 'user_from_jwt';
    } catch {
      return undefined;
    }
  }
  
  return undefined;
}

/**
 * Rate limiting logging helper
 */
export function logRateLimitEvent(
  identifier: string,
  limit: number,
  window: string,
  current: number,
  req?: NextRequest
) {
  const context = req ? withRequestContext(req) : {};
  
  apiLogger.warn({
    event: 'rate_limit_exceeded',
    identifier,
    limit,
    window,
    current_requests: current,
    ...context,
    timestamp: new Date().toISOString(),
  }, `Rate limit exceeded: ${identifier} (${current}/${limit} in ${window})`);
}