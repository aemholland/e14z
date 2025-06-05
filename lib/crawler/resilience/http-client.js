/**
 * Production-Grade HTTP Client with Retries, Timeouts, and Circuit Breakers
 * Based on 2025 Axios best practices
 */

const axios = require('axios');
const { CircuitBreaker } = require('./circuit-breaker');
const { createOperationalError, ErrorTypes } = require('./error-manager');

class RobustHttpClient {
  constructor(options = {}) {
    this.name = options.name || 'http-client';
    this.maxRetries = options.maxRetries || 3;
    this.baseTimeout = options.baseTimeout || 30000; // 30 seconds
    this.retryDelay = options.retryDelay || 1000; // 1 second
    this.maxRetryDelay = options.maxRetryDelay || 10000; // 10 seconds
    this.retryMultiplier = options.retryMultiplier || 2;
    
    // Create circuit breaker for each major domain
    this.circuitBreakers = new Map();
    
    // Create axios instance with robust defaults
    this.axiosInstance = this.createAxiosInstance();
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      retriedRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      networkErrors: 0,
      serverErrors: 0,
      clientErrors: 0
    };

    this.setupInterceptors();
  }

  createAxiosInstance() {
    return axios.create({
      timeout: this.baseTimeout,
      maxRedirects: 5,
      maxBodyLength: 10 * 1024 * 1024, // 10MB
      maxContentLength: 10 * 1024 * 1024, // 10MB
      validateStatus: (status) => status < 500, // Only server errors are failures
      headers: {
        'User-Agent': 'E14Z-MCP-Crawler/1.0 (+https://e14z.com)',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
      // Keep-alive for connection reuse
      httpAgent: new (require('http').Agent)({ 
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 10,
        maxFreeSockets: 5
      }),
      httpsAgent: new (require('https').Agent)({ 
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 10,
        maxFreeSockets: 5,
        rejectUnauthorized: false // For development - should be true in production
      })
    });
  }

  setupInterceptors() {
    // Request interceptor for logging and stats
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.stats.totalRequests++;
        config.metadata = { startTime: Date.now() };
        console.log(`🌐 HTTP ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging and stats
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        this.stats.successfulRequests++;
        console.log(`✅ HTTP ${response.status} ${response.config.url} (${duration}ms)`);
        return response;
      },
      (error) => {
        const duration = error.config?.metadata ? 
          Date.now() - error.config.metadata.startTime : 0;
        
        this.categorizeError(error);
        console.warn(`❌ HTTP ${error.response?.status || 'ERR'} ${error.config?.url} (${duration}ms): ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  categorizeError(error) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      this.stats.timeouts++;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
      this.stats.networkErrors++;
    } else if (error.response?.status >= 500) {
      this.stats.serverErrors++;
    } else if (error.response?.status >= 400) {
      this.stats.clientErrors++;
    }
    this.stats.failedRequests++;
  }

  getOrCreateCircuitBreaker(url) {
    const domain = this.extractDomain(url);
    
    if (!this.circuitBreakers.has(domain)) {
      this.circuitBreakers.set(domain, new CircuitBreaker({
        name: `${this.name}-${domain}`,
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        expectedResponseTime: this.baseTimeout
      }));
    }
    
    return this.circuitBreakers.get(domain);
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  async get(url, config = {}) {
    return this.requestWithRetry('GET', url, { ...config });
  }

  async post(url, data, config = {}) {
    return this.requestWithRetry('POST', url, { ...config, data });
  }

  async requestWithRetry(method, url, config = {}, attempt = 1) {
    const circuitBreaker = this.getOrCreateCircuitBreaker(url);
    
    try {
      const response = await circuitBreaker.execute(async () => {
        return await this.axiosInstance.request({
          method,
          url,
          ...config,
          timeout: this.calculateTimeout(attempt)
        });
      });

      return response;

    } catch (error) {
      // Check if we should retry
      if (this.shouldRetry(error, attempt)) {
        this.stats.retriedRequests++;
        const delay = this.calculateRetryDelay(attempt);
        
        console.warn(`🔄 Retrying ${method} ${url} (attempt ${attempt + 1}/${this.maxRetries + 1}) after ${delay}ms`);
        
        await this.sleep(delay);
        return this.requestWithRetry(method, url, config, attempt + 1);
      }

      // Convert axios errors to our error types
      throw this.convertError(error, url);
    }
  }

  shouldRetry(error, attempt) {
    if (attempt >= this.maxRetries) {
      return false;
    }

    // Retry on network errors, timeouts, and 5xx server errors
    if (error.code === 'ECONNABORTED' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET' ||
        error.name === ErrorTypes.TIMEOUT_ERROR ||
        (error.response && error.response.status >= 500)) {
      return true;
    }

    // Don't retry on 4xx client errors (except 429 rate limit)
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return error.response.status === 429;
    }

    return false;
  }

  calculateTimeout(attempt) {
    // Increase timeout with each retry
    return Math.min(this.baseTimeout * attempt, this.baseTimeout * 3);
  }

  calculateRetryDelay(attempt) {
    // Exponential backoff with jitter
    const exponentialDelay = this.retryDelay * Math.pow(this.retryMultiplier, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1s of jitter
    return Math.min(exponentialDelay + jitter, this.maxRetryDelay);
  }

  convertError(error, url) {
    if (error.name === ErrorTypes.CIRCUIT_BREAKER_OPEN) {
      return error;
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return createOperationalError(
        ErrorTypes.TIMEOUT_ERROR,
        `Request to ${url} timed out after ${this.baseTimeout}ms`
      );
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
      return createOperationalError(
        ErrorTypes.NETWORK_ERROR,
        `Network error accessing ${url}: ${error.message}`
      );
    }

    if (error.response) {
      if (error.response.status === 429) {
        return createOperationalError(
          ErrorTypes.RATE_LIMIT_ERROR,
          `Rate limited by ${url}: ${error.response.statusText}`
        );
      }

      if (error.response.status >= 500) {
        return createOperationalError(
          ErrorTypes.NETWORK_ERROR,
          `Server error from ${url}: ${error.response.status} ${error.response.statusText}`
        );
      }
    }

    return createOperationalError(
      ErrorTypes.NETWORK_ERROR,
      `HTTP error for ${url}: ${error.message}`
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const circuitBreakerStats = Array.from(this.circuitBreakers.entries()).map(([domain, cb]) => ({
      domain,
      ...cb.getStats()
    }));

    const successRate = this.stats.totalRequests > 0 ? 
      (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 100;

    return {
      client: this.name,
      successRate: successRate.toFixed(1),
      ...this.stats,
      circuitBreakers: circuitBreakerStats
    };
  }

  async healthCheck() {
    const allHealthy = Array.from(this.circuitBreakers.values()).every(cb => cb.isHealthy());
    const successRate = this.stats.totalRequests > 0 ? 
      (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 100;

    return {
      healthy: allHealthy && successRate > 70,
      successRate,
      circuitBreakersHealthy: allHealthy,
      stats: this.getStats()
    };
  }

  destroy() {
    // Clean up resources
    this.circuitBreakers.clear();
    if (this.axiosInstance.defaults.httpAgent) {
      this.axiosInstance.defaults.httpAgent.destroy();
    }
    if (this.axiosInstance.defaults.httpsAgent) {
      this.axiosInstance.defaults.httpsAgent.destroy();
    }
  }
}

module.exports = { RobustHttpClient };