/**
 * Production Rate Limiting System
 * Distributed rate limiting with Redis, circuit breakers, and intelligent backoff
 */

const Bottleneck = require('bottleneck');
const Redis = require('ioredis');
const { logger } = require('../logging/logger');
const { telemetry } = require('../observability/telemetry');

class ProductionRateLimiter {
  constructor(options = {}) {
    this.redis = this.createRedisConnection(options.redis);
    this.limiters = new Map();
    this.circuitBreakers = new Map();
    this.defaultLimits = {
      // Conservative defaults for respectful scraping
      'registry.npmjs.org': { maxConcurrent: 5, minTime: 200 },
      'api.github.com': { maxConcurrent: 10, minTime: 100 },
      'pypi.org': { maxConcurrent: 3, minTime: 300 },
      'crates.io': { maxConcurrent: 5, minTime: 200 },
      'pkg.go.dev': { maxConcurrent: 5, minTime: 200 },
      'default': { maxConcurrent: 2, minTime: 500 },
    };
    
    // Domain-specific limits can be overridden
    this.customLimits = options.customLimits || {};
    
    // Circuit breaker settings
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 10;
    this.circuitBreakerTimeout = options.circuitBreakerTimeout || 60000; // 1 minute
    
    this.initializeGlobalLimiter();
  }

  /**
   * Create Redis connection for distributed rate limiting
   */
  createRedisConnection(redisOptions = {}) {
    const defaultOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    const redis = new Redis({ ...defaultOptions, ...redisOptions });
    
    redis.on('connect', () => {
      logger.info('📊 Redis connected for rate limiting');
    });

    redis.on('error', (error) => {
      logger.error('Redis connection error', error);
    });

    return redis;
  }

  /**
   * Initialize global rate limiter to prevent overwhelming any single domain
   */
  initializeGlobalLimiter() {
    this.globalLimiter = new Bottleneck({
      id: 'global-crawler-limiter',
      datastore: 'redis',
      clearDatastore: false,
      clientOptions: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
      },
      
      // Global limits across all crawler instances
      maxConcurrent: 50, // Total concurrent operations across all domains
      reservoir: 1000,   // Total operations per period
      reservoirRefreshAmount: 1000,
      reservoirRefreshInterval: 60 * 1000, // 1 minute
      
      // Clustering support for horizontal scaling
      settings: {
        stalledInterval: 30 * 1000,
        maxConcurrent: 50,
      },
    });

    this.globalLimiter.on('error', (error) => {
      logger.error('Global rate limiter error', error);
    });
  }

  /**
   * Get or create domain-specific rate limiter
   */
  getDomainLimiter(domain) {
    if (this.limiters.has(domain)) {
      return this.limiters.get(domain);
    }

    const limits = this.customLimits[domain] || this.defaultLimits[domain] || this.defaultLimits.default;
    
    const limiter = new Bottleneck({
      id: `domain-limiter-${domain}`,
      datastore: 'redis',
      clearDatastore: false,
      clientOptions: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
      },
      
      // Domain-specific limits
      maxConcurrent: limits.maxConcurrent,
      minTime: limits.minTime,
      
      // Dynamic reservoir based on success rate
      reservoir: limits.maxConcurrent * 10,
      reservoirRefreshAmount: limits.maxConcurrent * 10,
      reservoirRefreshInterval: 60 * 1000,
      
      // Exponential backoff on errors
      settings: {
        stalledInterval: 30 * 1000,
        maxConcurrent: limits.maxConcurrent,
        minTime: limits.minTime,
        highWater: limits.maxConcurrent * 2,
        strategy: Bottleneck.strategy.LEAK,
        penalty: limits.minTime * 2, // Double delay on errors
      },
    });

    // Event handlers for monitoring
    limiter.on('error', (error) => {
      logger.error(`Domain limiter error for ${domain}`, error);
      telemetry.recordError('rate_limiter_error', error.message, { domain });
    });

    limiter.on('depleted', () => {
      logger.rateLimit.delayed(domain, limits.minTime, 'depleted');
      telemetry.recordError('rate_limit_depleted', 'Rate limit depleted', { domain });
    });

    limiter.on('dropped', (info) => {
      logger.rateLimit.blocked(domain, info.retryAfter || 'unknown');
      telemetry.recordError('request_dropped', 'Request dropped due to rate limit', { domain });
    });

    this.limiters.set(domain, limiter);
    return limiter;
  }

  /**
   * Execute a request with rate limiting and circuit breaker protection
   */
  async executeRequest(url, requestFunction, options = {}) {
    const domain = this.extractDomain(url);
    const span = telemetry.createSpan('rate_limited_request', { domain, url });

    try {
      // Check circuit breaker first
      if (this.isCircuitBreakerOpen(domain)) {
        const error = new Error(`Circuit breaker open for ${domain}`);
        error.code = 'CIRCUIT_BREAKER_OPEN';
        throw error;
      }

      // Get domain-specific limiter
      const domainLimiter = this.getDomainLimiter(domain);
      
      // Execute with both global and domain limiting
      const result = await this.globalLimiter.schedule(
        { priority: options.priority || 5 },
        () => domainLimiter.schedule(
          { priority: options.priority || 5 },
          async () => {
            const startTime = Date.now();
            
            try {
              logger.debug(`🌐 Executing request: ${url}`);
              const response = await requestFunction();
              
              // Record success
              const duration = Date.now() - startTime;
              this.recordSuccess(domain, duration);
              
              return response;
            } catch (error) {
              // Record failure and update circuit breaker
              this.recordFailure(domain, error);
              throw error;
            }
          }
        )
      );

      span.setStatus({ code: 1 }); // OK
      return result;
      
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      
      // Handle different types of errors
      if (error.code === 'CIRCUIT_BREAKER_OPEN') {
        logger.rateLimit.blocked(domain, 'circuit breaker');
        throw error;
      }
      
      // Handle rate limit specific errors
      if (this.isRateLimitError(error)) {
        const retryAfter = this.extractRetryAfter(error);
        logger.rateLimit.blocked(domain, retryAfter);
        
        // Implement exponential backoff
        await this.exponentialBackoff(domain, retryAfter);
        throw error;
      }
      
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Circuit breaker implementation
   */
  isCircuitBreakerOpen(domain) {
    const breaker = this.circuitBreakers.get(domain);
    if (!breaker) return false;
    
    if (breaker.state === 'open') {
      if (Date.now() - breaker.lastFailure > this.circuitBreakerTimeout) {
        breaker.state = 'half-open';
        breaker.consecutiveFailures = 0;
        logger.info(`🔄 Circuit breaker half-open for ${domain}`);
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Record successful request
   */
  recordSuccess(domain, duration) {
    const breaker = this.circuitBreakers.get(domain) || this.createCircuitBreaker(domain);
    
    if (breaker.state === 'half-open') {
      breaker.state = 'closed';
      breaker.consecutiveFailures = 0;
      logger.info(`✅ Circuit breaker closed for ${domain}`);
    }
    
    // Update success metrics
    breaker.totalRequests++;
    breaker.successCount++;
    breaker.averageResponseTime = ((breaker.averageResponseTime * (breaker.successCount - 1)) + duration) / breaker.successCount;
    
    telemetry.recordPackageScraped('unknown', domain, true, duration);
  }

  /**
   * Record failed request
   */
  recordFailure(domain, error) {
    const breaker = this.circuitBreakers.get(domain) || this.createCircuitBreaker(domain);
    
    breaker.totalRequests++;
    breaker.failureCount++;
    breaker.consecutiveFailures++;
    breaker.lastFailure = Date.now();
    
    // Trip circuit breaker if threshold exceeded
    if (breaker.consecutiveFailures >= this.circuitBreakerThreshold) {
      breaker.state = 'open';
      logger.error(`🚫 Circuit breaker opened for ${domain}`, error);
    }
    
    telemetry.recordError('request_failure', error.message, { domain });
  }

  /**
   * Create new circuit breaker for domain
   */
  createCircuitBreaker(domain) {
    const breaker = {
      domain,
      state: 'closed', // closed, open, half-open
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      lastFailure: null,
      averageResponseTime: 0,
    };
    
    this.circuitBreakers.set(domain, breaker);
    return breaker;
  }

  /**
   * Exponential backoff implementation
   */
  async exponentialBackoff(domain, baseDelay = 1000) {
    const breaker = this.circuitBreakers.get(domain);
    const failures = breaker ? breaker.consecutiveFailures : 1;
    
    // Exponential backoff with jitter
    const delay = Math.min(baseDelay * Math.pow(2, failures - 1), 30000); // Max 30 seconds
    const jitter = Math.random() * 0.3; // 30% jitter
    const finalDelay = delay * (1 + jitter);
    
    logger.rateLimit.delayed(domain, finalDelay, 'exponential backoff');
    
    await new Promise(resolve => setTimeout(resolve, finalDelay));
  }

  /**
   * Helper methods
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  isRateLimitError(error) {
    if (!error) return false;
    
    const rateLimitIndicators = [
      'rate limit',
      'too many requests',
      'quota exceeded',
      'throttled',
      '429',
      'ECONNRESET',
      'ETIMEDOUT',
    ];
    
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.statusCode || 0;
    
    return status === 429 || rateLimitIndicators.some(indicator => message.includes(indicator));
  }

  extractRetryAfter(error) {
    // Try to extract retry-after header or default backoff
    if (error.headers && error.headers['retry-after']) {
      return parseInt(error.headers['retry-after']) * 1000;
    }
    
    return 5000; // Default 5 second backoff
  }

  /**
   * Get current status of all limiters
   */
  getStatus() {
    const status = {
      global: {
        running: this.globalLimiter.running(),
        queued: this.globalLimiter.queued(),
      },
      domains: {},
      circuitBreakers: {},
    };

    // Domain limiter status
    for (const [domain, limiter] of this.limiters) {
      status.domains[domain] = {
        running: limiter.running(),
        queued: limiter.queued(),
      };
    }

    // Circuit breaker status
    for (const [domain, breaker] of this.circuitBreakers) {
      status.circuitBreakers[domain] = {
        state: breaker.state,
        totalRequests: breaker.totalRequests,
        successRate: breaker.totalRequests > 0 ? (breaker.successCount / breaker.totalRequests * 100).toFixed(1) : 0,
        consecutiveFailures: breaker.consecutiveFailures,
        averageResponseTime: Math.round(breaker.averageResponseTime),
      };
    }

    return status;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('🛑 Shutting down rate limiters...');
    
    // Disconnect all limiters
    await Promise.all([
      this.globalLimiter.disconnect(),
      ...Array.from(this.limiters.values()).map(limiter => limiter.disconnect()),
    ]);
    
    // Disconnect Redis
    await this.redis.disconnect();
    
    logger.info('✅ Rate limiters shutdown complete');
  }
}

// Export singleton instance
const rateLimiter = new ProductionRateLimiter();

module.exports = { 
  rateLimiter,
  ProductionRateLimiter 
};