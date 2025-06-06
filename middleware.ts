/**
 * Next.js Middleware for E14Z MCP Registry
 * Handles security, rate limiting, logging, and request processing for Vercel deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, createRateLimitHeaders, getClientIdentifier, type RateLimitType } from './lib/rate-limiting/vercel-config';
import { performanceLogger, securityLogger, requestLogger } from './lib/logging/vercel-config';
import { performanceMonitor } from './lib/monitoring/vercel-adapter';

// Request tracking
interface RequestContext {
  id: string;
  startTime: number;
  ip: string;
  userAgent?: string;
  path: string;
  method: string;
}

export async function middleware(request: NextRequest) {
  const requestContext: RequestContext = {
    id: generateRequestId(),
    startTime: performance.now(),
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || undefined,
    path: request.nextUrl.pathname,
    method: request.method
  };

  // Add request ID to headers for tracking
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestContext.id);

  try {
    // 1. Security Headers and CORS
    const response = await handleSecurity(request, requestContext);
    if (response) return response;

    // 2. Rate Limiting
    const rateLimitResponse = await handleRateLimit(request, requestContext);
    if (rateLimitResponse) return rateLimitResponse;

    // 3. Request Logging
    logRequest(request, requestContext);

    // 4. Performance Monitoring (simplified since full performance monitor not available)
    const performanceTiming = { 
      end: () => performance.now() - requestContext.startTime 
    };

    // Continue to the application
    const nextResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // 5. Add security headers to response
    addSecurityHeaders(nextResponse);

    // 6. Performance logging
    const duration = performanceTiming.end();
    addPerformanceHeaders(nextResponse, duration, requestContext);

    return nextResponse;

  } catch (error) {
    const duration = performance.now() - requestContext.startTime;
    
    securityLogger.error({
      event: 'middleware_error',
      request_id: requestContext.id,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Math.round(duration),
      path: requestContext.path,
      method: requestContext.method,
      ip: requestContext.ip
    }, 'Middleware error occurred');

    // Return error response
    return new NextResponse('Internal Server Error', { 
      status: 500,
      headers: {
        'x-request-id': requestContext.id,
        'x-error': 'middleware_error'
      }
    });
  }
}

// Security handling
async function handleSecurity(request: NextRequest, context: RequestContext): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // CORS preflight handling
  if (request.method === 'OPTIONS') {
    return handleCORS(request);
  }

  // Security checks for sensitive endpoints
  if (pathname.startsWith('/api/admin')) {
    const authCheck = await checkAdminAuth(request, context);
    if (authCheck) return authCheck;
  }

  // Block suspicious requests
  const suspiciousCheck = checkSuspiciousRequest(request, context);
  if (suspiciousCheck) return suspiciousCheck;

  return null;
}

// CORS handling
function handleCORS(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://e14z.com'];
  
  const isAllowedOrigin = allowedOrigins.includes(origin || '') || 
                         process.env.NODE_ENV === 'development';

  const response = new NextResponse(null, { status: 200 });
  
  if (isAllowedOrigin && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Max-Age', '86400');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

// Admin authentication check
async function checkAdminAuth(request: NextRequest, context: RequestContext): Promise<NextResponse | null> {
  // This would integrate with your auth system
  // For now, just log the attempt
  securityLogger.warn({
    event: 'admin_access_attempt',
    request_id: context.id,
    path: context.path,
    ip: context.ip,
    user_agent: context.userAgent
  }, 'Admin endpoint access attempt');

  // TODO: Implement actual admin auth check
  return null;
}

// Suspicious request detection
function checkSuspiciousRequest(request: NextRequest, context: RequestContext): NextResponse | null {
  const { pathname } = request.nextUrl;
  const userAgent = context.userAgent || '';

  // Check for common attack patterns
  const suspiciousPatterns = [
    /\.\./,           // Path traversal
    /<script/i,       // XSS attempts
    /union.*select/i, // SQL injection
    /eval\(/i,        // Code injection
    /base64_decode/i, // PHP injection
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(pathname) || pattern.test(request.url)
  );

  // Check for suspicious user agents
  const suspiciousUserAgents = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /acunetix/i,
    /nmap/i
  ];

  const isSuspiciousUA = suspiciousUserAgents.some(pattern => 
    pattern.test(userAgent)
  );

  if (isSuspicious || isSuspiciousUA) {
    securityLogger.warn({
      event: 'suspicious_request_blocked',
      request_id: context.id,
      path: context.path,
      ip: context.ip,
      user_agent: userAgent,
      reason: isSuspicious ? 'suspicious_path' : 'suspicious_user_agent'
    }, 'Suspicious request blocked');

    return new NextResponse('Forbidden', { 
      status: 403,
      headers: {
        'x-request-id': context.id,
        'x-blocked-reason': 'suspicious_request'
      }
    });
  }

  return null;
}

// Rate limiting
async function handleRateLimit(request: NextRequest, context: RequestContext): Promise<NextResponse | null> {
  // Skip rate limiting in development or if disabled
  if (process.env.NODE_ENV === 'development' && process.env.DEV_DISABLE_RATE_LIMITING === 'true') {
    return null;
  }

  if (process.env.ENABLE_RATE_LIMITING === 'false') {
    return null;
  }

  const rateLimitType = getRateLimitType(request.nextUrl.pathname);
  const result = await checkRateLimit(request, rateLimitType);

  if (!result.success) {
    const response = new NextResponse('Too Many Requests', { 
      status: 429,
      headers: createRateLimitHeaders(result)
    });
    
    response.headers.set('x-request-id', context.id);
    return response;
  }

  return null;
}

// Determine rate limit type based on path
function getRateLimitType(pathname: string): RateLimitType {
  if (pathname.startsWith('/api/admin')) return 'admin';
  if (pathname.startsWith('/api/mcp') && pathname.includes('execute')) return 'execution';
  if (pathname.startsWith('/api/auth')) return 'auth';
  if (pathname.startsWith('/api/discover') || pathname.startsWith('/api/search')) return 'search';
  if (pathname.startsWith('/api/submit') || pathname.includes('upload')) return 'upload';
  if (pathname.startsWith('/api')) return 'api';
  return 'global';
}

// Request logging
function logRequest(request: NextRequest, context: RequestContext) {
  const { pathname, search } = request.nextUrl;
  
  requestLogger.info({
    event: 'request_started',
    request_id: context.id,
    method: context.method,
    path: pathname,
    query: search,
    ip: context.ip,
    user_agent: context.userAgent,
    referer: request.headers.get('referer'),
    content_type: request.headers.get('content-type'),
    content_length: request.headers.get('content-length'),
    accept: request.headers.get('accept'),
    accept_language: request.headers.get('accept-language'),
    vercel_region: process.env.VERCEL_REGION
  }, `${context.method} ${pathname}`);
}

// Add security headers
function addSecurityHeaders(response: NextResponse) {
  // Only add if not already set
  if (!response.headers.get('X-Frame-Options')) {
    response.headers.set('X-Frame-Options', 'DENY');
  }
  
  if (!response.headers.get('X-Content-Type-Options')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }
  
  if (!response.headers.get('X-XSS-Protection')) {
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }
  
  if (!response.headers.get('Referrer-Policy')) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  // Add request tracking headers
  response.headers.set('X-Powered-By', 'E14Z MCP Registry');
  response.headers.set('X-Version', process.env.npm_package_version || '4.1.1');
}

// Add performance headers
function addPerformanceHeaders(response: NextResponse, duration: number, context: RequestContext) {
  response.headers.set('X-Response-Time', `${Math.round(duration)}ms`);
  response.headers.set('X-Request-ID', context.id);
  
  if (process.env.VERCEL_REGION) {
    response.headers.set('X-Vercel-Region', process.env.VERCEL_REGION);
  }
}

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Middleware configuration
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};