/**
 * Vercel-Optimized Rate Limiting Configuration
 * Uses Upstash Redis for distributed rate limiting across Vercel's serverless functions
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest } from 'next/server';
import { securityLogger } from '../logging/vercel-config';

// Redis client for Vercel/Upstash
const redis = Redis.fromEnv();

// Rate limiting configurations for different endpoints
const rateLimitConfigs = {
  // API endpoints
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '15 min'),
    analytics: true,
    prefix: 'e14z:api',
  }),
  
  // Authentication endpoints (stricter)
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '15 min'),
    analytics: true,
    prefix: 'e14z:auth',
  }),
  
  // MCP execution endpoints (most strict)
  execution: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '5 min'),
    analytics: true,
    prefix: 'e14z:exec',
  }),
  
  // Search and discovery (moderate)
  search: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '5 min'),
    analytics: true,
    prefix: 'e14z:search',
  }),
  
  // File uploads (strict)
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 min'),
    analytics: true,
    prefix: 'e14z:upload',
  }),
  
  // Admin operations (very strict)
  admin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'e14z:admin',
  }),
  
  // Global rate limit (fallback)
  global: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '10 min'),
    analytics: true,
    prefix: 'e14z:global',
  })
};

// Rate limit types
export type RateLimitType = keyof typeof rateLimitConfigs;

// Get client identifier from request
export function getClientIdentifier(request: NextRequest): string {
  // Priority order for client identification:
  // 1. User ID (if authenticated)
  // 2. X-Forwarded-For header (Vercel proxy)
  // 3. X-Real-IP header
  // 4. Connection remote address
  // 5. Fallback to 'anonymous'
  
  const headers = request.headers;
  
  // Check for authenticated user (would be set by auth middleware)
  const userId = headers.get('x-user-id');
  if (userId) {
    return `user:${userId}`;
  }
  
  // Get IP from Vercel headers
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, use the first one
    const ip = xForwardedFor.split(',')[0].trim();
    return `ip:${ip}`;
  }
  
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) {
    return `ip:${xRealIp}`;
  }
  
  // Fallback to connection IP (less reliable in serverless)
  const connectionIp = headers.get('x-vercel-forwarded-for');
  if (connectionIp) {
    return `ip:${connectionIp}`;
  }
  
  // Last resort
  return 'anonymous';
}

// Rate limiting wrapper with enhanced logging
export async function checkRateLimit(
  request: NextRequest,
  type: RateLimitType = 'global',
  customIdentifier?: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}> {
  const startTime = performance.now();
  
  try {
    const ratelimit = rateLimitConfigs[type];
    const identifier = customIdentifier || getClientIdentifier(request);
    
    const result = await ratelimit.limit(identifier);
    const duration = performance.now() - startTime;
    
    // Log rate limit check
    securityLogger.debug({
      event: 'rate_limit_check',
      type,
      identifier,
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      duration_ms: Math.round(duration),
      user_agent: request.headers.get('user-agent')?.substring(0, 100)
    }, `Rate limit check: ${type} - ${result.success ? 'ALLOWED' : 'BLOCKED'}`);
    
    // Log rate limit violations
    if (!result.success) {
      securityLogger.warn({
        event: 'rate_limit_exceeded',
        type,
        identifier,
        limit: result.limit,
        reset: result.reset,
        url: request.url,
        method: request.method,
        user_agent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      }, `Rate limit exceeded for ${type}: ${identifier}`);
    }
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: result.success ? undefined : Math.ceil((result.reset.getTime() - Date.now()) / 1000)
    };
    
  } catch (error) {
    const duration = performance.now() - startTime;
    
    securityLogger.error({
      event: 'rate_limit_error',
      type,
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Math.round(duration)
    }, 'Rate limiting failed');
    
    // Fail open - allow request if rate limiting fails
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: new Date(),
      retryAfter: undefined
    };
  }
}

// Advanced rate limiting features
export class AdvancedRateLimiter {
  private redis: Redis;
  
  constructor() {
    this.redis = redis;
  }
  
  // Burst protection: Allow short bursts but enforce longer-term limits
  async checkBurstLimit(
    identifier: string,
    shortWindow: { requests: number; window: string },
    longWindow: { requests: number; window: string }
  ): Promise<{ success: boolean; reason?: string }> {
    
    const shortLimit = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(shortWindow.requests, shortWindow.window),
      prefix: 'e14z:burst:short'
    });
    
    const longLimit = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(longWindow.requests, longWindow.window),
      prefix: 'e14z:burst:long'
    });
    
    const [shortResult, longResult] = await Promise.all([
      shortLimit.limit(identifier),
      longLimit.limit(identifier)
    ]);
    
    if (!shortResult.success) {
      return { success: false, reason: 'burst_limit_exceeded' };
    }
    
    if (!longResult.success) {
      return { success: false, reason: 'sustained_limit_exceeded' };
    }
    
    return { success: true };
  }
  
  // Adaptive rate limiting based on system load
  async checkAdaptiveLimit(
    identifier: string,
    baseLimit: number,
    loadFactor: number = 1.0
  ): Promise<{ success: boolean; adjustedLimit: number }> {
    
    // Adjust limit based on system load (0.5 = half capacity, 2.0 = double capacity)
    const adjustedLimit = Math.max(1, Math.floor(baseLimit * loadFactor));
    
    const adaptiveRateLimit = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(adjustedLimit, '5 min'),
      prefix: 'e14z:adaptive'
    });
    
    const result = await adaptiveRateLimit.limit(identifier);
    
    securityLogger.debug({
      event: 'adaptive_rate_limit',
      identifier,
      base_limit: baseLimit,
      load_factor: loadFactor,
      adjusted_limit: adjustedLimit,
      success: result.success
    }, `Adaptive rate limit: ${result.success ? 'ALLOWED' : 'BLOCKED'}`);
    
    return {
      success: result.success,
      adjustedLimit
    };
  }
  
  // IP reputation-based rate limiting
  async checkReputationLimit(
    identifier: string,
    reputation: 'good' | 'neutral' | 'bad'
  ): Promise<{ success: boolean; appliedLimit: number }> {
    
    const reputationLimits = {
      good: 200,    // Higher limit for good reputation
      neutral: 100, // Standard limit
      bad: 20       // Lower limit for bad reputation
    };
    
    const limit = reputationLimits[reputation];
    
    const reputationRateLimit = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(limit, '10 min'),
      prefix: `e14z:reputation:${reputation}`
    });
    
    const result = await reputationRateLimit.limit(identifier);
    
    securityLogger.debug({
      event: 'reputation_rate_limit',
      identifier,
      reputation,
      applied_limit: limit,
      success: result.success
    }, `Reputation-based rate limit (${reputation}): ${result.success ? 'ALLOWED' : 'BLOCKED'}`);
    
    return {
      success: result.success,
      appliedLimit: limit
    };
  }
  
  // Get rate limit analytics
  async getAnalytics(
    type: RateLimitType,
    timeWindow: '1h' | '24h' | '7d' = '1h'
  ): Promise<{
    totalRequests: number;
    blockedRequests: number;
    blockRate: number;
    topBlockedIdentifiers: { identifier: string; count: number }[];
  }> {
    
    try {
      // This would require implementing analytics collection
      // For now, return placeholder data
      return {
        totalRequests: 0,
        blockedRequests: 0,
        blockRate: 0,
        topBlockedIdentifiers: []
      };
      
    } catch (error) {
      securityLogger.error({
        event: 'rate_limit_analytics_error',
        type,
        time_window: timeWindow,
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to get rate limit analytics');
      
      return {
        totalRequests: 0,
        blockedRequests: 0,
        blockRate: 0,
        topBlockedIdentifiers: []
      };
    }
  }
}

// Export singleton instance
export const advancedRateLimiter = new AdvancedRateLimiter();

// Utility function to create rate limit headers
export function createRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}): Headers {
  const headers = new Headers();
  
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', Math.ceil(result.reset.getTime() / 1000).toString());
  
  if (result.retryAfter) {
    headers.set('Retry-After', result.retryAfter.toString());
  }
  
  return headers;
}

// Helper to check if rate limiting is enabled
export function isRateLimitingEnabled(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && 
    process.env.UPSTASH_REDIS_REST_TOKEN &&
    process.env.ENABLE_RATE_LIMITING !== 'false'
  );
}