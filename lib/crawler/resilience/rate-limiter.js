/**
 * Production Rate Limiter with Domain-specific Controls
 * Prevents overwhelming target servers with concurrent requests
 */

const { createOperationalError, ErrorTypes } = require('./error-manager');

class RateLimiter {
  constructor(options = {}) {
    this.globalMaxConcurrent = options.globalMaxConcurrent || 10;
    this.domainMaxConcurrent = options.domainMaxConcurrent || 3;
    this.requestsPerSecond = options.requestsPerSecond || 5;
    this.burstSize = options.burstSize || 10;
    
    // Global tracking
    this.globalActive = 0;
    this.globalQueue = [];
    
    // Domain-specific tracking
    this.domainActive = new Map(); // domain -> active count
    this.domainQueues = new Map(); // domain -> queue array
    this.domainTokenBuckets = new Map(); // domain -> token bucket
    
    this.stats = {
      totalRequests: 0,
      queuedRequests: 0,
      rejectedRequests: 0,
      completedRequests: 0,
      averageQueueTime: 0,
      peakConcurrency: 0
    };

    this.setupTokenBucketRefresh();
    this.setupMonitoring();
  }

  setupTokenBucketRefresh() {
    // Refill token buckets every 200ms
    setInterval(() => {
      for (const [domain, bucket] of this.domainTokenBuckets) {
        const tokensToAdd = (this.requestsPerSecond * 0.2); // 0.2 seconds worth
        bucket.tokens = Math.min(bucket.tokens + tokensToAdd, this.burstSize);
      }
    }, 200);
  }

  setupMonitoring() {
    setInterval(() => {
      this.logStats();
      this.cleanupInactiveDomains();
    }, 30000); // Every 30 seconds
  }

  async acquire(url, priority = 0) {
    const domain = this.extractDomain(url);
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    this.stats.totalRequests++;
    
    return new Promise((resolve, reject) => {
      const request = {
        id: requestId,
        domain,
        url,
        priority,
        startTime,
        resolve,
        reject,
        timeoutId: null
      };

      // Set timeout for queued requests
      request.timeoutId = setTimeout(() => {
        this.removeFromQueues(request);
        this.stats.rejectedRequests++;
        reject(createOperationalError(
          ErrorTypes.RATE_LIMIT_ERROR,
          `Request to ${url} timed out in rate limiter queue after 60s`
        ));
      }, 60000); // 60 second timeout

      if (this.canExecuteImmediately(domain)) {
        this.executeRequest(request);
      } else {
        this.queueRequest(request, domain);
      }
    });
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  generateRequestId() {
    return Math.random().toString(36).substr(2, 9);
  }

  canExecuteImmediately(domain) {
    // Check global limits
    if (this.globalActive >= this.globalMaxConcurrent) {
      return false;
    }

    // Check domain limits
    const domainActiveCount = this.domainActive.get(domain) || 0;
    if (domainActiveCount >= this.domainMaxConcurrent) {
      return false;
    }

    // Check token bucket
    const bucket = this.getOrCreateTokenBucket(domain);
    if (bucket.tokens < 1) {
      return false;
    }

    return true;
  }

  getOrCreateTokenBucket(domain) {
    if (!this.domainTokenBuckets.has(domain)) {
      this.domainTokenBuckets.set(domain, {
        tokens: this.burstSize,
        lastRefill: Date.now()
      });
    }
    return this.domainTokenBuckets.get(domain);
  }

  executeRequest(request) {
    // Clear timeout
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }

    // Update counters
    this.globalActive++;
    const domainActiveCount = (this.domainActive.get(request.domain) || 0) + 1;
    this.domainActive.set(request.domain, domainActiveCount);

    // Consume token
    const bucket = this.getOrCreateTokenBucket(request.domain);
    bucket.tokens = Math.max(0, bucket.tokens - 1);

    // Update stats
    const queueTime = Date.now() - request.startTime;
    this.updateQueueTimeStats(queueTime);
    this.stats.peakConcurrency = Math.max(this.stats.peakConcurrency, this.globalActive);

    console.log(`🚦 Rate limiter acquired: ${request.domain} (${domainActiveCount}/${this.domainMaxConcurrent} domain, ${this.globalActive}/${this.globalMaxConcurrent} global)`);

    // Return release function
    const releaseFunction = () => this.release(request.domain);
    request.resolve(releaseFunction);
  }

  queueRequest(request, domain) {
    this.stats.queuedRequests++;
    
    // Add to global queue (sorted by priority)
    this.insertByPriority(this.globalQueue, request);
    
    // Add to domain queue
    if (!this.domainQueues.has(domain)) {
      this.domainQueues.set(domain, []);
    }
    this.domainQueues.get(domain).push(request);

    console.log(`⏳ Rate limiter queued: ${request.url} (global queue: ${this.globalQueue.length})`);
  }

  insertByPriority(queue, request) {
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (request.priority > queue[i].priority) {
        queue.splice(i, 0, request);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      queue.push(request);
    }
  }

  release(domain) {
    // Update counters
    this.globalActive = Math.max(0, this.globalActive - 1);
    const domainActiveCount = Math.max(0, (this.domainActive.get(domain) || 1) - 1);
    this.domainActive.set(domain, domainActiveCount);
    this.stats.completedRequests++;

    console.log(`✅ Rate limiter released: ${domain} (${domainActiveCount}/${this.domainMaxConcurrent} domain, ${this.globalActive}/${this.globalMaxConcurrent} global)`);

    // Process queued requests
    this.processQueue();
  }

  processQueue() {
    // Process global queue
    for (let i = this.globalQueue.length - 1; i >= 0; i--) {
      const request = this.globalQueue[i];
      
      if (this.canExecuteImmediately(request.domain)) {
        this.globalQueue.splice(i, 1);
        
        // Remove from domain queue too
        const domainQueue = this.domainQueues.get(request.domain);
        if (domainQueue) {
          const domainIndex = domainQueue.indexOf(request);
          if (domainIndex !== -1) {
            domainQueue.splice(domainIndex, 1);
          }
        }
        
        this.executeRequest(request);
        break; // Process one at a time
      }
    }
  }

  removeFromQueues(request) {
    // Remove from global queue
    const globalIndex = this.globalQueue.indexOf(request);
    if (globalIndex !== -1) {
      this.globalQueue.splice(globalIndex, 1);
    }

    // Remove from domain queue
    const domainQueue = this.domainQueues.get(request.domain);
    if (domainQueue) {
      const domainIndex = domainQueue.indexOf(request);
      if (domainIndex !== -1) {
        domainQueue.splice(domainIndex, 1);
      }
    }
  }

  updateQueueTimeStats(queueTime) {
    if (this.stats.completedRequests === 0) {
      this.stats.averageQueueTime = queueTime;
    } else {
      // Rolling average
      this.stats.averageQueueTime = 
        (this.stats.averageQueueTime * 0.9) + (queueTime * 0.1);
    }
  }

  cleanupInactiveDomains() {
    // Remove domains with no active requests and empty queues
    for (const [domain, activeCount] of this.domainActive) {
      if (activeCount === 0) {
        const queue = this.domainQueues.get(domain);
        if (!queue || queue.length === 0) {
          this.domainActive.delete(domain);
          this.domainQueues.delete(domain);
          this.domainTokenBuckets.delete(domain);
        }
      }
    }
  }

  logStats() {
    const domainsActive = Array.from(this.domainActive.entries())
      .filter(([_, count]) => count > 0)
      .map(([domain, count]) => `${domain}:${count}`)
      .join(', ');

    console.log(`📊 Rate limiter stats: Global ${this.globalActive}/${this.globalMaxConcurrent} | Queue: ${this.globalQueue.length} | Domains: [${domainsActive}]`);
  }

  getStats() {
    const activeDomains = {};
    for (const [domain, count] of this.domainActive) {
      if (count > 0) {
        activeDomains[domain] = count;
      }
    }

    const queuedByDomain = {};
    for (const [domain, queue] of this.domainQueues) {
      if (queue.length > 0) {
        queuedByDomain[domain] = queue.length;
      }
    }

    return {
      globalActive: this.globalActive,
      globalMaxConcurrent: this.globalMaxConcurrent,
      globalQueueSize: this.globalQueue.length,
      activeDomains,
      queuedByDomain,
      averageQueueTime: Math.round(this.stats.averageQueueTime),
      ...this.stats
    };
  }

  async drain() {
    // Wait for all active requests to complete
    while (this.globalActive > 0 || this.globalQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  destroy() {
    // Cancel all queued requests
    for (const request of this.globalQueue) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      request.reject(createOperationalError(
        ErrorTypes.RATE_LIMIT_ERROR,
        'Rate limiter shutting down'
      ));
    }

    this.globalQueue.length = 0;
    this.domainQueues.clear();
    this.domainActive.clear();
    this.domainTokenBuckets.clear();
  }
}

module.exports = { RateLimiter };