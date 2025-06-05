/**
 * OpenTelemetry Integration for Production Observability
 * Provides distributed tracing, metrics, and logging correlation
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { metrics, trace } = require('@opentelemetry/api');

class TelemetryManager {
  constructor(serviceName = 'e14z-mcp-crawler') {
    this.serviceName = serviceName;
    this.sdk = null;
    this.meter = null;
    this.tracer = null;
    this.metrics = {};
  }

  /**
   * Initialize OpenTelemetry SDK for production monitoring
   */
  initialize() {
    // Create resource with service information
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    });

    // Initialize SDK with auto-instrumentations
    this.sdk = new NodeSDK({
      resource,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable some instrumentations that might be noisy
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: this.httpRequestHook.bind(this),
          },
        }),
      ],
    });

    // Start the SDK
    this.sdk.start();

    // Get meter and tracer instances
    this.meter = metrics.getMeter(this.serviceName);
    this.tracer = trace.getTracer(this.serviceName);

    // Initialize custom metrics
    this.initializeCustomMetrics();

    console.log('📊 OpenTelemetry initialized for', this.serviceName);
  }

  /**
   * Initialize custom metrics for crawler operations
   */
  initializeCustomMetrics() {
    // Package discovery metrics
    this.metrics.packagesDiscovered = this.meter.createCounter('packages_discovered_total', {
      description: 'Total number of packages discovered',
    });

    this.metrics.packagesScraped = this.meter.createCounter('packages_scraped_total', {
      description: 'Total number of packages successfully scraped',
    });

    this.metrics.packagesValidated = this.meter.createCounter('packages_validated_total', {
      description: 'Total number of packages validated',
    });

    this.metrics.scrapingDuration = this.meter.createHistogram('scraping_duration_seconds', {
      description: 'Time taken to scrape a package',
      unit: 's',
    });

    this.metrics.validationDuration = this.meter.createHistogram('validation_duration_seconds', {
      description: 'Time taken to validate a package',
      unit: 's',
    });

    this.metrics.errorRate = this.meter.createCounter('errors_total', {
      description: 'Total number of errors by type',
    });

    this.metrics.queueDepth = this.meter.createUpDownCounter('queue_depth', {
      description: 'Current depth of processing queues',
    });

    this.metrics.activeConnections = this.meter.createUpDownCounter('active_connections', {
      description: 'Number of active browser connections',
    });
  }

  /**
   * Record package discovery event
   */
  recordPackageDiscovered(source, count = 1) {
    this.metrics.packagesDiscovered.add(count, { source });
  }

  /**
   * Record package scraping event
   */
  recordPackageScraped(packageName, source, success = true, duration = 0) {
    const labels = { package_name: packageName, source, success: success.toString() };
    
    this.metrics.packagesScraped.add(1, labels);
    
    if (duration > 0) {
      this.metrics.scrapingDuration.record(duration / 1000, labels);
    }
  }

  /**
   * Record package validation event
   */
  recordPackageValidated(packageName, success = true, duration = 0) {
    const labels = { package_name: packageName, success: success.toString() };
    
    this.metrics.packagesValidated.add(1, labels);
    
    if (duration > 0) {
      this.metrics.validationDuration.record(duration / 1000, labels);
    }
  }

  /**
   * Record error event
   */
  recordError(errorType, errorMessage, context = {}) {
    this.metrics.errorRate.add(1, { 
      error_type: errorType,
      ...context 
    });
  }

  /**
   * Update queue depth
   */
  updateQueueDepth(queueName, depth) {
    this.metrics.queueDepth.add(depth, { queue: queueName });
  }

  /**
   * Update active connections
   */
  updateActiveConnections(change) {
    this.metrics.activeConnections.add(change);
  }

  /**
   * Create a span for tracing operations
   */
  createSpan(name, attributes = {}) {
    return this.tracer.startSpan(name, {
      attributes: {
        service: this.serviceName,
        ...attributes,
      },
    });
  }

  /**
   * Wrap an async operation with tracing
   */
  async traceOperation(name, operation, attributes = {}) {
    const span = this.createSpan(name, attributes);
    
    try {
      const result = await operation();
      span.setStatus({ code: trace.SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ 
        code: trace.SpanStatusCode.ERROR, 
        message: error.message 
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * HTTP request hook for custom instrumentation
   */
  httpRequestHook(span, request) {
    // Add custom attributes to HTTP spans
    if (request.url) {
      const url = new URL(request.url);
      span.setAttributes({
        'http.host': url.hostname,
        'http.path': url.pathname,
        'crawler.component': 'web_scraper',
      });
    }
  }

  /**
   * Gracefully shutdown telemetry
   */
  async shutdown() {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('📊 OpenTelemetry shutdown complete');
    }
  }
}

// Export singleton instance
const telemetry = new TelemetryManager();

module.exports = { 
  telemetry,
  TelemetryManager 
};