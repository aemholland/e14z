/**
 * Simplified Telemetry for E14Z APM
 * Basic logging-based metrics collection for build compatibility
 */

import { logger } from '@/lib/logging/config'

class SimpleTelemetry {
  private initialized = false

  async initialize() {
    if (this.initialized) return
    
    logger.info({
      event: 'telemetry_initialized',
      service: 'e14z-registry',
      version: '4.1.1'
    }, 'Telemetry system initialized')
    
    this.initialized = true
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    logger.info({
      event: 'http_request',
      method,
      route,
      status_code: statusCode,
      duration_ms: duration,
      status_class: this.getStatusClass(statusCode)
    }, 'HTTP request completed')
  }

  /**
   * Record database query metrics
   */
  recordDbQuery(operation: string, table: string, duration: number, success: boolean) {
    logger.info({
      event: 'db_query',
      operation,
      table,
      duration_ms: duration,
      success
    }, 'Database query completed')
  }

  /**
   * Record MCP discovery metrics
   */
  recordMcpDiscovery(query: string, resultCount: number, duration: number, cacheHit: boolean) {
    logger.info({
      event: 'mcp_discovery',
      query,
      result_count: resultCount,
      duration_ms: duration,
      cache_hit: cacheHit
    }, 'MCP discovery completed')
  }

  /**
   * Start a span (simplified)
   */
  startSpan(name: string, attributes?: Record<string, string | number | boolean>) {
    return {
      setAttributes: (attrs: Record<string, any>) => {},
      recordException: (error: Error) => {
        logger.error({ 
          event: 'span_exception', 
          span_name: name, 
          error: error.message 
        }, 'Exception in span')
      },
      end: () => {}
    }
  }

  /**
   * Get metrics snapshot
   */
  async getMetricsSnapshot() {
    return {
      metrics_available: true,
      collection_type: 'logging_based',
      initialized: this.initialized
    }
  }

  /**
   * Helper to get status class
   */
  private getStatusClass(statusCode: number): string {
    if (statusCode < 300) return '2xx'
    if (statusCode < 400) return '3xx'
    if (statusCode < 500) return '4xx'
    return '5xx'
  }
}

// Export singleton instance
export const telemetry = new SimpleTelemetry()
export default telemetry