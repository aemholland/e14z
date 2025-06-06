/**
 * Simplified APM Middleware for E14Z
 * Basic performance monitoring without OpenTelemetry dependencies
 */

import { NextRequest, NextResponse } from 'next/server'

interface RequestMetrics {
  requestId: string
  method: string
  url: string
  startTime: number
  duration?: number
  statusCode?: number
}

export function withAPM<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  options: {
    trackQueries?: boolean
    trackCache?: boolean
    sampleRate?: number
  } = {}
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const response = await handler(request, ...args)
      
      const duration = Date.now() - startTime
      const metrics: RequestMetrics = {
        requestId,
        method: request.method,
        url: request.url,
        startTime,
        duration,
        statusCode: response.status
      }
      
      // Log slow requests
      if (duration > 1000) {
        console.warn(`Slow request: ${request.method} ${request.url} took ${duration}ms`)
      }
      
      return response
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`Request failed: ${request.method} ${request.url} after ${duration}ms`, error)
      throw error
    }
  }
}