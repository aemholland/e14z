/**
 * Next.js Middleware for E14Z MCP Registry
 * Handles security, rate limiting, logging, and request processing for Vercel deployment
 */

import { NextRequest, NextResponse } from 'next/server';

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
    ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
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

    // 2. Rate Limiting (disabled for now)
    // const rateLimitResponse = await handleRateLimit(request, requestContext);
    // if (rateLimitResponse) return rateLimitResponse;

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
    
    console.error('Middleware error:', {
      event: 'middleware_error',
      request_id: requestContext.id,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Math.round(duration),
      path: requestContext.path,
      method: requestContext.method,
      ip: requestContext.ip
    });

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
  console.warn('Admin endpoint access attempt:', {
    event: 'admin_access_attempt',
    request_id: context.id,
    path: context.path,
    ip: context.ip,
    user_agent: context.userAgent
  });

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
    console.warn('Suspicious request blocked:', {
      event: 'suspicious_request_blocked',
      request_id: context.id,
      path: context.path,
      ip: context.ip,
      user_agent: userAgent,
      reason: isSuspicious ? 'suspicious_path' : 'suspicious_user_agent'
    });

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

// Rate limiting (disabled for now)
// async function handleRateLimit(request: NextRequest, context: RequestContext): Promise<NextResponse | null> {
//   return null;
// }

// Request logging
function logRequest(request: NextRequest, context: RequestContext) {
  const { pathname, search } = request.nextUrl;
  
  // Simple console logging for now
  console.log(`${context.method} ${pathname}`, {
    request_id: context.id,
    ip: context.ip,
    user_agent: context.userAgent
  });
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