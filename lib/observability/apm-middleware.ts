/**
 * APM Middleware for E14Z
 * Enhanced application performance monitoring with detailed metrics collection
 */

import { NextRequest, NextResponse } from 'next/server'
import { telemetry } from './telemetry'
import { logger, performanceLogger } from '@/lib/logging/config'
import { supabase } from '@/lib/supabase/client'

interface RequestMetrics {
  requestId: string
  method: string
  url: string
  userAgent?: string
  startTime: number
  endTime?: number
  duration?: number
  statusCode?: number
  responseSize?: number
  dbQueries?: QueryMetric[]
  cacheHits?: number
  cacheMisses?: number
  userId?: string
  sessionId?: string
  errors?: ErrorMetric[]
}

interface QueryMetric {
  query: string
  duration: number
  table: string
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  rowsAffected?: number
  success: boolean
}

interface ErrorMetric {
  type: string
  message: string
  stack?: string
  timestamp: number
}

class APMMiddleware {
  private requestMetrics = new Map<string, RequestMetrics>()
  private readonly MAX_STORED_REQUESTS = 1000

  /**
   * Create APM middleware wrapper for API routes
   */
  withAPM<T extends (...args: any[]) => Promise<NextResponse>>(
    handler: T,
    options?: {
      trackQueries?: boolean
      trackCache?: boolean
      sampleRate?: number
    }
  ): T {
    const { trackQueries = true, trackCache = true, sampleRate = 1.0 } = options || {}

    return (async (request: NextRequest, ...args: any[]) => {
      const requestId = this.generateRequestId()
      const startTime = Date.now()

      // Sample requests based on rate
      const shouldTrack = Math.random() < sampleRate

      if (!shouldTrack) {
        return await handler(request, ...args)
      }

      // Initialize request metrics
      const metrics: RequestMetrics = {
        requestId,
        method: request.method,
        url: this.sanitizeUrl(request.url),
        userAgent: request.headers.get('user-agent') || undefined,
        startTime,
        dbQueries: [],
        cacheHits: 0,
        cacheMisses: 0,
        errors: []
      }

      this.requestMetrics.set(requestId, metrics)

      try {
        // Wrap the handler with performance tracking
        const response = await this.trackPerformance(
          () => handler(request, ...args),
          metrics,
          { trackQueries, trackCache }
        )

        // Record successful completion
        metrics.endTime = Date.now()
        metrics.duration = metrics.endTime - metrics.startTime
        metrics.statusCode = response.status

        // Estimate response size
        const responseText = await response.clone().text()
        metrics.responseSize = new Blob([responseText]).size

        // Record telemetry (temporarily disabled)
        // telemetry.recordHttpRequest(
        //   metrics.method,
        //   this.getRoutePattern(metrics.url),
        //   metrics.statusCode,
        //   metrics.duration
        // )

        // Store metrics for analysis
        await this.storeRequestMetrics(metrics)

        return response

      } catch (error) {
        // Record error
        metrics.endTime = Date.now()
        metrics.duration = metrics.endTime - metrics.startTime
        metrics.statusCode = 500

        const errorMetric: ErrorMetric = {
          type: error instanceof Error ? error.constructor.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now()
        }
        metrics.errors!.push(errorMetric)

        // Record error telemetry (temporarily disabled)
        // telemetry.recordHttpRequest(
        //   metrics.method,
        //   this.getRoutePattern(metrics.url),
        //   500,
        //   metrics.duration
        // )

        // Store error metrics
        await this.storeRequestMetrics(metrics)

        throw error

      } finally {
        // Cleanup old metrics to prevent memory leaks
        this.cleanupOldMetrics()
      }
    }) as T
  }

  /**
   * Track performance of the handler execution
   */
  private async trackPerformance<T>(
    handler: () => Promise<T>,
    metrics: RequestMetrics,
    options: { trackQueries: boolean; trackCache: boolean }
  ): Promise<T> {
    const span = telemetry.startSpan(`http_request_${metrics.method}`, {
      'http.method': metrics.method,
      'http.url': metrics.url,
      'http.user_agent': metrics.userAgent || 'unknown'
    })

    try {
      // Start database query tracking if enabled
      if (options.trackQueries) {
        this.startQueryTracking(metrics)
      }

      // Execute the handler
      const result = await handler()

      span.setAttributes({
        'http.status_code': 200,
        'http.response_size': metrics.responseSize || 0,
        'db.query_count': metrics.dbQueries?.length || 0
      })

      return result

    } catch (error) {
      span.recordException(error as Error)
      span.setAttributes({
        'http.status_code': 500,
        'error.type': error instanceof Error ? error.constructor.name : 'unknown'
      })
      throw error

    } finally {
      span.end()
    }
  }

  /**
   * Start tracking database queries for this request
   * Note: Simplified version - full query tracking requires more complex instrumentation
   */
  private startQueryTracking(metrics: RequestMetrics) {
    // For now, we'll just set up basic tracking
    // A production implementation would use database instrumentation or 
    // a more sophisticated approach to track Supabase queries
    
    // This is a placeholder that logs when query tracking starts
    const queryStartTime = Date.now()
    
    // In a real implementation, this would intercept database calls
    // For now, we'll just log that tracking is enabled
    console.debug(`Database query tracking enabled for request ${metrics.requestId}`)
    
    // Store a basic query metric as placeholder
    const placeholderMetric: QueryMetric = {
      query: 'API_REQUEST_DATABASE_ACCESS',
      duration: 0, // Will be updated when request completes
      table: 'tracked_via_middleware',
      operation: 'SELECT',
      success: true
    }
    
    metrics.dbQueries?.push(placeholderMetric)
  }

  /**
   * Store request metrics for analysis
   */
  private async storeRequestMetrics(metrics: RequestMetrics) {
    try {
      // Store in api_calls table (reuse existing analytics infrastructure)
      await supabase.from('api_calls').insert({
        endpoint: this.getRoutePattern(metrics.url),
        method: metrics.method,
        query: metrics.url.split('?')[1] || '', // Query parameters
        filters: {
          apm_tracking: true,
          db_queries: metrics.dbQueries?.length || 0,
          errors: metrics.errors?.length || 0
        },
        results_count: 1,
        results_mcp_ids: [], // Not applicable for API calls
        user_agent: metrics.userAgent?.substring(0, 255),
        agent_type: this.extractAgentType(metrics.userAgent || ''),
        session_id: metrics.sessionId || metrics.requestId,
        response_time_ms: metrics.duration,
        created_at: new Date(metrics.startTime).toISOString()
      })

      // Also store detailed performance metrics in database_metrics if available
      try {
        await supabase.from('database_metrics').insert({
          collected_at: new Date(metrics.startTime).toISOString(),
          active_connections: 1, // Placeholder
          query_count: metrics.dbQueries?.length || 0,
          avg_query_time_ms: metrics.dbQueries?.length ? 
            (metrics.dbQueries.reduce((sum, q) => sum + q.duration, 0) / metrics.dbQueries.length) : 0,
          query_error_rate: metrics.errors?.length ? (metrics.errors.length / (metrics.dbQueries?.length || 1)) : 0,
          metadata: {
            request_id: metrics.requestId,
            endpoint: this.getRoutePattern(metrics.url),
            method: metrics.method,
            status_code: metrics.statusCode,
            response_size_bytes: metrics.responseSize,
            cache_hits: metrics.cacheHits || 0,
            cache_misses: metrics.cacheMisses || 0,
            queries: metrics.dbQueries?.slice(0, 5), // Store first 5 queries
            errors: metrics.errors?.slice(0, 3) // Store first 3 errors
          }
        })
      } catch (dbMetricsError) {
        // Silently fail if database_metrics table doesn't exist
        console.debug('Failed to store database metrics:', dbMetricsError)
      }

      // Log performance summary
      performanceLogger.info({
        event: 'request_completed',
        request_id: metrics.requestId,
        method: metrics.method,
        endpoint: this.getRoutePattern(metrics.url),
        duration_ms: metrics.duration,
        status_code: metrics.statusCode,
        db_queries: metrics.dbQueries?.length || 0,
        errors: metrics.errors?.length || 0
      }, 'Request performance metrics recorded')

    } catch (error) {
      logger.error({
        event: 'apm_metrics_storage_failed',
        request_id: metrics.requestId,
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to store APM metrics')
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Sanitize URL for logging (remove sensitive data)
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      
      // Remove sensitive query parameters
      const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth']
      sensitiveParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]')
        }
      })
      
      return urlObj.pathname + (urlObj.search ? urlObj.search : '')
    } catch {
      return url.split('?')[0] // Return just the path if URL parsing fails
    }
  }

  /**
   * Extract route pattern from URL (e.g., /api/mcp/[slug] from /api/mcp/postgres)
   */
  private getRoutePattern(url: string): string {
    try {
      const urlObj = new URL(url)
      const path = urlObj.pathname
      
      // Common API patterns
      const patterns = [
        { regex: /^\/api\/mcp\/[^\/]+$/, pattern: '/api/mcp/[slug]' },
        { regex: /^\/api\/analytics\/[^\/]+$/, pattern: '/api/analytics/[mcp_id]' },
        { regex: /^\/api\/admin\/[^\/]+$/, pattern: '/api/admin/[resource]' },
        { regex: /^\/mcp\/[^\/]+$/, pattern: '/mcp/[slug]' }
      ]
      
      for (const { regex, pattern } of patterns) {
        if (regex.test(path)) {
          return pattern
        }
      }
      
      return path
    } catch {
      return url
    }
  }

  /**
   * Sanitize headers for logging
   */
  private sanitizeHeaders(url: string): Record<string, string> {
    // For now, just return basic info
    // In a real implementation, you'd extract and sanitize relevant headers
    return {
      url_info: 'basic_request_info'
    }
  }

  /**
   * Extract agent type from user agent string
   */
  private extractAgentType(userAgent: string): string {
    const ua = userAgent.toLowerCase()
    
    if (ua.includes('claude')) return 'claude'
    if (ua.includes('gpt') || ua.includes('openai')) return 'openai'
    if (ua.includes('gemini')) return 'gemini'
    if (ua.includes('anthropic')) return 'anthropic'
    if (ua.includes('python')) return 'python-script'
    if (ua.includes('curl')) return 'curl'
    if (ua.includes('postman')) return 'postman'
    if (ua.includes('bot')) return 'bot'
    
    return 'unknown'
  }

  /**
   * Cleanup old metrics to prevent memory leaks
   */
  private cleanupOldMetrics() {
    if (this.requestMetrics.size > this.MAX_STORED_REQUESTS) {
      const entries = Array.from(this.requestMetrics.entries())
      const sorted = entries.sort((a, b) => a[1].startTime - b[1].startTime)
      
      // Remove oldest 25% of entries
      const toRemove = sorted.slice(0, Math.floor(sorted.length * 0.25))
      toRemove.forEach(([requestId]) => {
        this.requestMetrics.delete(requestId)
      })
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetricsSnapshot() {
    const activeRequests = Array.from(this.requestMetrics.values())
      .filter(m => !m.endTime)
    
    const completedRequests = Array.from(this.requestMetrics.values())
      .filter(m => m.endTime)
      .slice(-100) // Last 100 completed requests
    
    return {
      active_requests: activeRequests.length,
      completed_requests_sample: completedRequests.length,
      avg_response_time: completedRequests.length > 0 
        ? completedRequests.reduce((sum, r) => sum + (r.duration || 0), 0) / completedRequests.length 
        : 0,
      error_rate: completedRequests.length > 0
        ? completedRequests.filter(r => (r.statusCode || 0) >= 400).length / completedRequests.length
        : 0,
      memory_usage: process.memoryUsage()
    }
  }
}

// Export singleton instance
export const apmMiddleware = new APMMiddleware()

// Export the wrapper function for easy use
export const withAPM = apmMiddleware.withAPM.bind(apmMiddleware)

export default apmMiddleware