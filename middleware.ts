/**
 * E14Z Next.js Middleware
 * Applies rate limiting, security headers, and logging to all requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getRateLimiter, 
  getUserTier, 
  getRateLimitIdentifier, 
  getEffectiveLimit,
  rateLimitRules 
} from '@/lib/rate-limiting/config';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/_') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }
  
  // Apply rate limiting only to API routes
  if (pathname.startsWith('/api/')) {
    return await handleApiRateLimit(request);
  }
  
  // For other routes, just add security headers
  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

/**
 * Handle rate limiting for API routes
 */
async function handleApiRateLimit(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();
  
  try {
    // Get the appropriate rate limiter for this endpoint
    const { limiter, rule, type } = getRateLimiter(pathname);
    
    // Determine user tier for rate limit multiplier
    const userTier = getUserTier(request);
    
    // Get identifier for rate limiting (IP or user ID)
    const identifier = getRateLimitIdentifier(request, userTier);
    
    // Calculate effective limit based on user tier
    const effectiveLimit = getEffectiveLimit(rule.requests, userTier);
    
    // Check rate limit
    const result = await limiter.limit(identifier);
    
    // Create response
    const response = NextResponse.next();
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', effectiveLimit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining?.toString() || '0');
    response.headers.set('X-RateLimit-Reset', 
      result.reset instanceof Date ? result.reset.getTime().toString() : 
      result.reset?.toString() || '0'
    );
    response.headers.set('X-RateLimit-Type', type);
    response.headers.set('X-User-Tier', userTier);
    
    // Add security headers
    addSecurityHeaders(response);
    
    if (!result.success) {
      // Rate limit exceeded - log and return 429
      await logRateLimitExceeded(request, identifier, rule, userTier, type);
      
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many ${rule.description} requests. Limit: ${effectiveLimit} requests per ${rule.window}`,
          type: type,
          limit: effectiveLimit,
          window: rule.window,
          reset: result.reset instanceof Date ? result.reset.toISOString() : undefined,
          user_tier: userTier,
          upgrade_info: userTier === 'anonymous' ? {
            message: 'Authenticate to get higher rate limits',
            community_multiplier: '2x',
            verified_multiplier: '5x'
          } : undefined
        }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(
              ((result.reset instanceof Date ? result.reset.getTime() : (result.reset || Date.now())) - Date.now()) / 1000
            ).toString(),
            ...Object.fromEntries(response.headers.entries())
          }
        }
      );
    }
    
    // Rate limit passed - log successful request
    await logRateLimitSuccess(request, identifier, rule, userTier, type, Date.now() - startTime);
    
    return response;
    
  } catch (error) {
    // Log error and allow request to continue (fail open for availability)
    console.error('Rate limiting error:', error);
    
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Error', 'true');
    addSecurityHeaders(response);
    return response;
  }
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse) {
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // CORS headers for API endpoints
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  // Performance headers
  response.headers.set('X-Powered-By', 'E14Z');
}

/**
 * Log rate limit exceeded event
 */
async function logRateLimitExceeded(
  request: NextRequest, 
  identifier: string, 
  rule: typeof rateLimitRules.default,
  userTier: string,
  type: string
) {
  // Import edge-compatible logging
  const { securityLogger, edgeLogPatterns } = await import('@/lib/logging/edge-config');
  
  securityLogger.warn({
    ...edgeLogPatterns.rateLimitExceeded(identifier, request.nextUrl.pathname, rule.requests, rule.window),
    method: request.method,
    rule_type: type,
    user_tier: userTier,
    user_agent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    referer: request.headers.get('referer'),
  }, `Rate limit exceeded: ${identifier} on ${request.nextUrl.pathname}`);
}

/**
 * Log successful rate limit check
 */
async function logRateLimitSuccess(
  request: NextRequest,
  identifier: string,
  rule: typeof rateLimitRules.default,
  userTier: string,
  type: string,
  duration: number
) {
  // Import edge-compatible logging
  const { performanceLogger, edgeLogPatterns } = await import('@/lib/logging/edge-config');
  
  performanceLogger.debug({
    ...edgeLogPatterns.rateLimitPassed(identifier, request.nextUrl.pathname, 0),
    method: request.method,
    rule_type: type,
    user_tier: userTier,
    duration_ms: duration,
  }, `Rate limit check passed: ${identifier} on ${request.nextUrl.pathname}`);
}

/**
 * Configure which paths this middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};