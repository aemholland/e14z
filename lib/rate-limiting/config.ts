/**
 * E14Z Rate Limiting Configuration
 * Comprehensive rate limiting for different API endpoints and user types
 */

import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';
import { securityLogger } from '@/lib/logging/edge-config';

// Rate limiting rules for different endpoints
export const rateLimitRules = {
  // Discovery endpoints - high frequency allowed for AI agents
  discovery: {
    requests: 100,
    window: '1 m',
    description: 'MCP discovery operations'
  },
  
  // Execution endpoints - moderate frequency (auto-installation is resource intensive)
  execution: {
    requests: 20,
    window: '1 m', 
    description: 'MCP execution and auto-installation'
  },
  
  // Publishing endpoints - low frequency (content creation)
  publishing: {
    requests: 10,
    window: '1 h',
    description: 'MCP publishing and claiming'
  },
  
  // Review/feedback endpoints - moderate frequency
  reviews: {
    requests: 50,
    window: '1 h',
    description: 'Review and feedback submission'
  },
  
  // Authentication endpoints - low frequency (security)
  auth: {
    requests: 5,
    window: '15 m',
    description: 'Authentication operations'
  },
  
  // Admin endpoints - very low frequency (privileged operations)
  admin: {
    requests: 100,
    window: '1 h',
    description: 'Administrative operations'
  },
  
  // Default for unspecified endpoints
  default: {
    requests: 60,
    window: '1 m',
    description: 'General API operations'
  }
};

// User tier multipliers for different user types
export const userTierMultipliers = {
  anonymous: 1,      // Base rate
  community: 2,      // 2x rate for authenticated users
  verified: 5,       // 5x rate for verified developers
  enterprise: 10,    // 10x rate for enterprise users
  admin: 100,        // 100x rate for admin users
};

/**
 * Memory-based rate limiter for development and fallback
 */
class MemoryRateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  
  async limit(identifier: string, maxRequests: number, windowMs: number): Promise<{ success: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const key = identifier;
    const current = this.requests.get(key);
    
    // Clean up expired entries
    if (current && now > current.resetTime) {
      this.requests.delete(key);
    }
    
    const entry = this.requests.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (entry.count >= maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }
    
    entry.count++;
    this.requests.set(key, entry);
    
    return {
      success: true,
      remaining: maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }
  
  // Cleanup old entries periodically
  cleanup() {
    const now = Date.now();
    const toDelete: string[] = [];
    this.requests.forEach((value, key) => {
      if (now > value.resetTime) {
        toDelete.push(key);
      }
    });
    toDelete.forEach(key => this.requests.delete(key));
  }
}

// Singleton memory rate limiter instance
const memoryLimiter = new MemoryRateLimiter();

// Cleanup memory limiter every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => memoryLimiter.cleanup(), 5 * 60 * 1000);
}

/**
 * Parse window string to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid window format: ${window}`);
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new Error(`Invalid time unit: ${unit}`);
  }
}

/**
 * Convert window string to Upstash Duration format
 */
function convertToUpstashDuration(window: string): string {
  const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid window format: ${window}`);
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  // Upstash expects format like "10 s", "1 m", "1 h", "1 d"
  return `${value} ${unit}`;
}

/**
 * Create rate limiter based on environment and availability
 */
function createRateLimiter(rule: typeof rateLimitRules.default) {
  const windowMs = parseWindow(rule.window);
  
  // Try to use Upstash/Redis rate limiter in production
  if (process.env.NODE_ENV === 'production' && process.env.UPSTASH_REDIS_REST_URL) {
    try {
      // Use the original window format as Upstash expects
      return new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(rule.requests, rule.window as any),
        analytics: true, // Enable analytics for monitoring
      });
    } catch (error) {
      securityLogger.warn({
        event: 'rate_limiter_fallback',
        error: error instanceof Error ? error.message : String(error),
        limiter: 'upstash',
        fallback: 'memory',
      }, 'Failed to initialize Upstash rate limiter, falling back to memory');
    }
  }
  
  // Fallback to memory-based rate limiter
  return {
    limit: async (identifier: string) => {
      const result = await memoryLimiter.limit(identifier, rule.requests, windowMs);
      return {
        success: result.success,
        remaining: result.remaining,
        reset: new Date(result.resetTime),
      };
    }
  };
}

/**
 * Rate limiter instances for different endpoint types
 */
export const rateLimiters = {
  discovery: createRateLimiter(rateLimitRules.discovery),
  execution: createRateLimiter(rateLimitRules.execution),
  publishing: createRateLimiter(rateLimitRules.publishing),
  reviews: createRateLimiter(rateLimitRules.reviews),
  auth: createRateLimiter(rateLimitRules.auth),
  admin: createRateLimiter(rateLimitRules.admin),
  default: createRateLimiter(rateLimitRules.default),
};

/**
 * Get rate limiter for a specific endpoint
 */
export function getRateLimiter(pathname: string) {
  if (pathname.includes('/api/discover') || pathname.includes('/api/mcp/')) {
    return { limiter: rateLimiters.discovery, rule: rateLimitRules.discovery, type: 'discovery' };
  }
  
  if (pathname.includes('/api/run') || pathname.includes('/api/execute')) {
    return { limiter: rateLimiters.execution, rule: rateLimitRules.execution, type: 'execution' };
  }
  
  if (pathname.includes('/api/publish') || pathname.includes('/api/claim')) {
    return { limiter: rateLimiters.publishing, rule: rateLimitRules.publishing, type: 'publishing' };
  }
  
  if (pathname.includes('/api/review')) {
    return { limiter: rateLimiters.reviews, rule: rateLimitRules.reviews, type: 'reviews' };
  }
  
  if (pathname.includes('/api/auth')) {
    return { limiter: rateLimiters.auth, rule: rateLimitRules.auth, type: 'auth' };
  }
  
  if (pathname.includes('/api/admin')) {
    return { limiter: rateLimiters.admin, rule: rateLimitRules.admin, type: 'admin' };
  }
  
  return { limiter: rateLimiters.default, rule: rateLimitRules.default, type: 'default' };
}

/**
 * Get user tier from request (implement based on your auth system)
 */
export function getUserTier(request: Request): keyof typeof userTierMultipliers {
  // TODO: Implement based on your authentication system
  // Check JWT token, API key, or session for user tier
  
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // Placeholder: decode JWT and extract user tier
    // For now, return 'community' for authenticated users
    return 'community';
  }
  
  // Check for API key in headers
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    // Placeholder: lookup API key and determine tier
    return 'verified';
  }
  
  return 'anonymous';
}

/**
 * Get rate limit identifier for a request
 */
export function getRateLimitIdentifier(request: Request, userTier: string): string {
  // For authenticated users, use user ID if available
  const userId = extractUserId(request);
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP address for anonymous users
  const ip = request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') || 
            request.headers.get('cf-connecting-ip') || 
            '127.0.0.1';
  
  return `ip:${ip}`;
}

/**
 * Extract user ID from request (placeholder - implement based on auth system)
 */
function extractUserId(request: Request): string | null {
  // TODO: Implement based on your authentication system
  // Examples:
  // - Decode JWT token
  // - Look up session
  // - Use API key mapping
  
  return null; // Placeholder
}

/**
 * Calculate effective rate limit based on user tier
 */
export function getEffectiveLimit(baseLimit: number, userTier: keyof typeof userTierMultipliers): number {
  return Math.floor(baseLimit * userTierMultipliers[userTier]);
}