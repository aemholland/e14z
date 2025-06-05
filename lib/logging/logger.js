/**
 * Production Structured Logging with Pino
 * Provides JSON structured logs with OpenTelemetry correlation
 */

const pino = require('pino');
const { trace, context } = require('@opentelemetry/api');

class CrawlerLogger {
  constructor() {
    this.logger = this.createLogger();
  }

  /**
   * Create Pino logger with production configuration
   */
  createLogger() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

    const config = {
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        log: this.formatLogObject.bind(this),
      },
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
    };

    // In development, use pretty printing
    if (isDevelopment) {
      config.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'hostname,pid',
          messageFormat: '🤖 {msg}',
        },
      };
    }

    return pino(config);
  }

  /**
   * Format log object with OpenTelemetry correlation
   */
  formatLogObject(obj) {
    // Add OpenTelemetry trace correlation
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      obj.traceId = spanContext.traceId;
      obj.spanId = spanContext.spanId;
    }

    // Add service context
    obj.service = 'e14z-mcp-crawler';
    obj.environment = process.env.NODE_ENV || 'development';

    return obj;
  }

  /**
   * Package discovery logging
   */
  discovery = {
    started: (source, options = {}) => {
      this.logger.info({ 
        event: 'discovery_started',
        source,
        options,
      }, `🔍 Starting discovery from ${source}`);
    },

    packageFound: (packageName, source, discoveryMethod) => {
      this.logger.debug({
        event: 'package_discovered',
        package_name: packageName,
        source,
        discovery_method: discoveryMethod,
      }, `📦 Discovered package: ${packageName}`);
    },

    completed: (source, count, duration) => {
      this.logger.info({
        event: 'discovery_completed',
        source,
        packages_found: count,
        duration_ms: duration,
      }, `✅ Discovery completed: ${count} packages from ${source} in ${duration}ms`);
    },

    failed: (source, error, context = {}) => {
      this.logger.error({
        event: 'discovery_failed',
        source,
        error: error.message,
        stack: error.stack,
        ...context,
      }, `❌ Discovery failed for ${source}: ${error.message}`);
    },
  };

  /**
   * Package scraping logging
   */
  scraping = {
    started: (packageName, source) => {
      this.logger.debug({
        event: 'scraping_started',
        package_name: packageName,
        source,
      }, `🔍 Starting scraping: ${packageName}`);
    },

    npmDetails: (packageName, version, dependencies) => {
      this.logger.debug({
        event: 'npm_details_fetched',
        package_name: packageName,
        version,
        dependency_count: Object.keys(dependencies || {}).length,
      }, `📦 NPM details fetched for ${packageName}@${version}`);
    },

    githubInfo: (packageName, stars, lastUpdate) => {
      this.logger.debug({
        event: 'github_info_fetched',
        package_name: packageName,
        stars,
        last_update: lastUpdate,
      }, `🐙 GitHub info fetched for ${packageName}`);
    },

    webScraping: (packageName, urlCount, contentLength) => {
      this.logger.debug({
        event: 'web_scraping_completed',
        package_name: packageName,
        urls_scraped: urlCount,
        content_length: contentLength,
      }, `🌐 Web scraping completed for ${packageName}`);
    },

    aiAnalysis: (packageName, tagsGenerated, useCasesGenerated) => {
      this.logger.debug({
        event: 'ai_analysis_completed',
        package_name: packageName,
        tags_generated: tagsGenerated,
        use_cases_generated: useCasesGenerated,
      }, `🤖 AI analysis completed for ${packageName}`);
    },

    completed: (packageName, qualityScore, duration) => {
      this.logger.info({
        event: 'scraping_completed',
        package_name: packageName,
        quality_score: qualityScore,
        duration_ms: duration,
      }, `✅ Scraping completed: ${packageName} (score: ${qualityScore}) in ${duration}ms`);
    },

    failed: (packageName, error, phase = 'unknown') => {
      this.logger.error({
        event: 'scraping_failed',
        package_name: packageName,
        phase,
        error: error.message,
        stack: error.stack,
      }, `❌ Scraping failed for ${packageName} at ${phase}: ${error.message}`);
    },
  };

  /**
   * Validation logging
   */
  validation = {
    started: (packageName, validationId) => {
      this.logger.debug({
        event: 'validation_started',
        package_name: packageName,
        validation_id: validationId,
      }, `🔍 Starting validation: ${packageName}`);
    },

    installTest: (packageName, success, command) => {
      this.logger.debug({
        event: 'install_test_completed',
        package_name: packageName,
        success,
        install_command: command,
      }, `📦 Install test ${success ? 'passed' : 'failed'}: ${packageName}`);
    },

    connectionTest: (packageName, success, connectionType) => {
      this.logger.debug({
        event: 'connection_test_completed',
        package_name: packageName,
        success,
        connection_type: connectionType,
      }, `🔌 Connection test ${success ? 'passed' : 'failed'}: ${packageName}`);
    },

    toolsExtracted: (packageName, toolCount) => {
      this.logger.debug({
        event: 'tools_extracted',
        package_name: packageName,
        tool_count: toolCount,
      }, `🔧 Extracted ${toolCount} tools from ${packageName}`);
    },

    completed: (packageName, isValid, duration) => {
      this.logger.info({
        event: 'validation_completed',
        package_name: packageName,
        is_valid: isValid,
        duration_ms: duration,
      }, `${isValid ? '✅' : '⚠️'} Validation completed: ${packageName} in ${duration}ms`);
    },

    failed: (packageName, error, phase = 'unknown') => {
      this.logger.error({
        event: 'validation_failed',
        package_name: packageName,
        phase,
        error: error.message,
        stack: error.stack,
      }, `❌ Validation failed for ${packageName} at ${phase}: ${error.message}`);
    },
  };

  /**
   * Storage logging
   */
  storage = {
    started: (packageCount) => {
      this.logger.info({
        event: 'storage_started',
        package_count: packageCount,
      }, `💾 Starting storage of ${packageCount} packages`);
    },

    packageStored: (packageName, isUpdate = false) => {
      this.logger.debug({
        event: 'package_stored',
        package_name: packageName,
        is_update: isUpdate,
      }, `💾 ${isUpdate ? 'Updated' : 'Stored'} package: ${packageName}`);
    },

    completed: (storedCount, totalCount, duration) => {
      this.logger.info({
        event: 'storage_completed',
        stored_count: storedCount,
        total_count: totalCount,
        duration_ms: duration,
      }, `✅ Storage completed: ${storedCount}/${totalCount} packages in ${duration}ms`);
    },

    failed: (packageName, error) => {
      this.logger.error({
        event: 'storage_failed',
        package_name: packageName,
        error: error.message,
        stack: error.stack,
      }, `❌ Storage failed for ${packageName}: ${error.message}`);
    },
  };

  /**
   * System performance logging
   */
  performance = {
    memoryUsage: () => {
      const usage = process.memoryUsage();
      this.logger.debug({
        event: 'memory_usage',
        memory: {
          rss: Math.round(usage.rss / 1024 / 1024),
          heap_used: Math.round(usage.heapUsed / 1024 / 1024),
          heap_total: Math.round(usage.heapTotal / 1024 / 1024),
          external: Math.round(usage.external / 1024 / 1024),
        },
      }, `📊 Memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB heap`);
    },

    browserConnections: (active, total) => {
      this.logger.debug({
        event: 'browser_connections',
        active_connections: active,
        total_connections: total,
      }, `🌐 Browser connections: ${active} active, ${total} total`);
    },

    queueStatus: (queueName, depth, processing) => {
      this.logger.debug({
        event: 'queue_status',
        queue_name: queueName,
        queue_depth: depth,
        processing_count: processing,
      }, `📊 Queue ${queueName}: ${depth} queued, ${processing} processing`);
    },
  };

  /**
   * Rate limiting and anti-detection logging
   */
  rateLimit = {
    delayed: (domain, delayMs, reason) => {
      this.logger.debug({
        event: 'rate_limit_delay',
        domain,
        delay_ms: delayMs,
        reason,
      }, `⏱️ Rate limit delay: ${domain} delayed ${delayMs}ms (${reason})`);
    },

    blocked: (domain, retryAfter) => {
      this.logger.warn({
        event: 'rate_limit_blocked',
        domain,
        retry_after: retryAfter,
      }, `🚫 Rate limited: ${domain} blocked, retry after ${retryAfter}s`);
    },

    proxyRotated: (oldProxy, newProxy, reason) => {
      this.logger.debug({
        event: 'proxy_rotated',
        old_proxy: oldProxy,
        new_proxy: newProxy,
        reason,
      }, `🔄 Proxy rotated: ${reason}`);
    },
  };

  /**
   * Generic logging methods
   */
  info(message, extra = {}) {
    this.logger.info(extra, message);
  }

  warn(message, extra = {}) {
    this.logger.warn(extra, message);
  }

  error(message, error = null, extra = {}) {
    const logData = { ...extra };
    if (error) {
      logData.error = error.message;
      logData.stack = error.stack;
    }
    this.logger.error(logData, message);
  }

  debug(message, extra = {}) {
    this.logger.debug(extra, message);
  }

  /**
   * Create child logger with additional context
   */
  child(context) {
    return {
      logger: this.logger.child(context),
      ...this,
    };
  }
}

// Export singleton instance
const logger = new CrawlerLogger();

module.exports = { 
  logger,
  CrawlerLogger 
};