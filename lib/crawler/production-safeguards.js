/**
 * Production Safeguards for MCP Crawler
 * Add these before going live
 */

class ProductionSafeguards {
  constructor(options = {}) {
    this.rateLimit = options.rateLimit || 1000; // ms between requests
    this.maxRetries = options.maxRetries || 3;
    this.errorThreshold = options.errorThreshold || 0.5; // Stop if >50% fail
  }

  // Add rate limiting between package processing
  async rateLimitedDelay() {
    await new Promise(resolve => setTimeout(resolve, this.rateLimit));
  }

  // Wrap package processing with error recovery
  async processPackageWithRetry(packageInfo, processor) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await processor(packageInfo);
        return { success: true, data: result };
      } catch (error) {
        lastError = error;
        console.warn(`   ⚠️ Attempt ${attempt}/${this.maxRetries} failed for ${packageInfo.name}: ${error.message}`);
        
        if (attempt < this.maxRetries) {
          await this.rateLimitedDelay();
        }
      }
    }
    
    return { 
      success: false, 
      error: lastError,
      package: packageInfo.name 
    };
  }

  // Monitor overall crawler health
  checkCrawlerHealth(stats) {
    const { processed, failed } = stats;
    const failureRate = failed / processed;
    
    if (failureRate > this.errorThreshold) {
      throw new Error(`Crawler failure rate too high: ${(failureRate * 100).toFixed(1)}%`);
    }
  }

  // Generate production summary
  generateProductionSummary(stats) {
    const successRate = ((stats.processed - stats.failed) / stats.processed * 100).toFixed(1);
    
    return {
      timestamp: new Date().toISOString(),
      totalProcessed: stats.processed,
      successful: stats.processed - stats.failed,
      failed: stats.failed,
      successRate: `${successRate}%`,
      avgTimePerPackage: stats.totalTime / stats.processed,
      errors: stats.errors.slice(0, 10) // Top 10 errors
    };
  }
}

module.exports = { ProductionSafeguards };