/**
 * Production Circuit Breaker Implementation
 * Prevents cascade failures by breaking circuits when services are unhealthy
 */

const { createOperationalError, ErrorTypes } = require('./error-manager');

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'unnamed';
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.expectedResponseTime = options.expectedResponseTime || 5000; // 5 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      circuitOpenEvents: 0,
      lastStateChange: Date.now()
    };

    this.setupMonitoring();
  }

  setupMonitoring() {
    setInterval(() => {
      this.logStats();
      this.evaluateCircuitHealth();
    }, this.monitoringPeriod);
  }

  async execute(asyncFunction, ...args) {
    this.stats.totalRequests++;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw createOperationalError(
          ErrorTypes.CIRCUIT_BREAKER_OPEN, 
          `Circuit breaker ${this.name} is OPEN. Next attempt in ${Math.round((this.nextAttempt - Date.now()) / 1000)}s`
        );
      } else {
        this.state = 'HALF_OPEN';
        console.log(`⚡ Circuit breaker ${this.name} entering HALF_OPEN state`);
      }
    }

    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        asyncFunction(...args),
        this.createTimeoutPromise()
      ]);

      const responseTime = Date.now() - startTime;
      this.onSuccess(responseTime);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.onFailure(error, responseTime);
      throw error;
    }
  }

  createTimeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(createOperationalError(
          ErrorTypes.TIMEOUT_ERROR,
          `Circuit breaker ${this.name} timeout after ${this.expectedResponseTime}ms`
        ));
      }, this.expectedResponseTime);
    });
  }

  onSuccess(responseTime) {
    this.stats.successfulRequests++;
    this.failureCount = 0;
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.stats.lastStateChange = Date.now();
      console.log(`✅ Circuit breaker ${this.name} recovered to CLOSED state`);
    }

    if (responseTime > this.expectedResponseTime) {
      console.warn(`⚠️ Circuit breaker ${this.name} slow response: ${responseTime}ms`);
    }
  }

  onFailure(error, responseTime) {
    this.stats.failedRequests++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (error.name === ErrorTypes.TIMEOUT_ERROR) {
      this.stats.timeouts++;
    }

    console.warn(`❌ Circuit breaker ${this.name} failure ${this.failureCount}/${this.failureThreshold}: ${error.message}`);

    if (this.failureCount >= this.failureThreshold) {
      this.openCircuit();
    }
  }

  openCircuit() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.recoveryTimeout;
    this.stats.circuitOpenEvents++;
    this.stats.lastStateChange = Date.now();
    
    console.error(`🔴 Circuit breaker ${this.name} OPENED! Next attempt: ${new Date(this.nextAttempt).toISOString()}`);
  }

  evaluateCircuitHealth() {
    const successRate = this.stats.totalRequests > 0 ? 
      (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 100;

    if (successRate < 50 && this.state === 'CLOSED' && this.stats.totalRequests > 10) {
      console.warn(`⚠️ Circuit breaker ${this.name} health degraded: ${successRate.toFixed(1)}% success rate`);
    }
  }

  logStats() {
    const successRate = this.stats.totalRequests > 0 ? 
      (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 100;

    console.log(`📊 Circuit breaker ${this.name}: ${this.state} | Success: ${successRate.toFixed(1)}% | Total: ${this.stats.totalRequests} | Failures: ${this.failureCount}`);
  }

  getStats() {
    const successRate = this.stats.totalRequests > 0 ? 
      (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 100;

    return {
      name: this.name,
      state: this.state,
      successRate: successRate.toFixed(1),
      ...this.stats,
      currentFailures: this.failureCount,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    console.log(`🔄 Circuit breaker ${this.name} manually reset`);
  }

  isHealthy() {
    return this.state === 'CLOSED' && this.failureCount < this.failureThreshold / 2;
  }
}

module.exports = { CircuitBreaker };