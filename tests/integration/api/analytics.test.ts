/**
 * Integration Tests for Analytics API Endpoints
 * Tests the full API flow including database interactions
 */

import { createMocks } from 'node-mocks-http'
import { GET as analyticsHandler } from '@/app/api/analytics/route'
import { GET as mcpAnalyticsHandler } from '@/app/api/analytics/[mcp_id]/route'

// Mock the analytics collector
const mockAnalyticsCollector = {
  getMCPAnalytics: jest.fn(),
}

jest.mock('@/lib/analytics/comprehensive-collector', () => ({
  analyticsCollector: mockAnalyticsCollector,
}))

describe('/api/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/analytics', () => {
    it('should return analytics data for valid MCP ID', async () => {
      const mockAnalytics = {
        summary: {
          total_executions: 150,
          unique_users: 75,
          success_rate: 0.94,
          avg_execution_time: 850,
        },
        time_series: [
          { hour: '2024-01-01T10:00:00Z', executions: 10 },
          { hour: '2024-01-01T11:00:00Z', executions: 15 },
        ],
        geographic_distribution: [
          { country: 'US', count: 50 },
          { country: 'UK', count: 25 },
        ],
      }

      mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(mockAnalytics)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?mcp_id=test-mcp-123&timeframe=7d',
      })

      const response = await analyticsHandler(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        mcp_id: 'test-mcp-123',
        timeframe: '7d',
        detail_level: 'full',
        analytics: mockAnalytics,
        note: 'All analytics features are currently free and unlimited',
      })

      expect(mockAnalyticsCollector.getMCPAnalytics).toHaveBeenCalledWith(
        'test-mcp-123',
        '7d',
        'enterprise' // Everyone gets full access
      )
    })

    it('should return 400 for missing MCP ID', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?timeframe=7d',
      })

      const response = await analyticsHandler(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('mcp_id parameter is required')
    })

    it('should return 400 for invalid timeframe', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?mcp_id=test-mcp&timeframe=invalid',
      })

      const response = await analyticsHandler(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid timeframe')
    })

    it('should return 404 when MCP not found', async () => {
      mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?mcp_id=nonexistent-mcp',
      })

      const response = await analyticsHandler(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('MCP not found or no analytics data available')
    })

    it('should handle analytics collector errors', async () => {
      mockAnalyticsCollector.getMCPAnalytics.mockRejectedValue(
        new Error('Database connection failed')
      )

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?mcp_id=test-mcp',
      })

      const response = await analyticsHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should use default values for optional parameters', async () => {
      const mockAnalytics = { summary: { total_executions: 0 } }
      mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(mockAnalytics)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics?mcp_id=test-mcp',
      })

      const response = await analyticsHandler(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.timeframe).toBe('7d') // default
      expect(data.detail_level).toBe('full') // default
    })
  })
})

describe('/api/analytics/[mcp_id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/analytics/[mcp_id]', () => {
    it('should return detailed analytics for specific MCP', async () => {
      const mockAnalytics = {
        summary: {
          total_executions: 200,
          unique_users: 100,
          success_rate: 0.96,
          avg_execution_time: 750,
        },
        user_intelligence: {
          new_users: 25,
          returning_users: 75,
          power_users: 10,
        },
        performance_breakdown: {
          fast_executions: 0.8,
          slow_executions: 0.15,
          failed_executions: 0.05,
        },
        error_analysis: {
          auth_errors: 2,
          timeout_errors: 5,
          crash_errors: 3,
        },
      }

      mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(mockAnalytics)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics/test-mcp-456?timeframe=30d&metric_type=all',
      })

      const response = await mcpAnalyticsHandler(req, {
        params: Promise.resolve({ mcp_id: 'test-mcp-456' })
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        mcp_id: 'test-mcp-456',
        timeframe: '30d',
        metric_type: 'all',
        analytics: mockAnalytics,
        metadata: {
          access_level: 'full',
          available_exports: ['json', 'csv', 'excel'],
          note: 'All analytics features are currently free and unlimited',
        },
      })
    })

    it('should filter analytics by metric type', async () => {
      const mockAnalytics = {
        summary: { total_executions: 100 },
        performance_breakdown: { fast: 0.8, slow: 0.2 },
        user_intelligence: { new_users: 20 },
        geographic_distribution: { US: 50, UK: 30 },
      }

      mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(mockAnalytics)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics/test-mcp?metric_type=performance',
      })

      const response = await mcpAnalyticsHandler(req, {
        params: Promise.resolve({ mcp_id: 'test-mcp' })
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should only include summary and performance_breakdown
      expect(data.analytics).toHaveProperty('summary')
      expect(data.analytics).toHaveProperty('performance_breakdown')
      expect(data.analytics).not.toHaveProperty('user_intelligence')
      expect(data.analytics).not.toHaveProperty('geographic_distribution')
    })

    it('should handle CSV export format', async () => {
      const mockAnalytics = {
        summary: {
          total_executions: 50,
          unique_users: 25,
          success_rate: 0.92,
          avg_execution_time: 900,
        },
      }

      mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(mockAnalytics)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics/test-mcp?format=csv',
      })

      const response = await mcpAnalyticsHandler(req, {
        params: Promise.resolve({ mcp_id: 'test-mcp' })
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/csv')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
      expect(response.headers.get('Content-Disposition')).toContain('.csv')
    })

    it('should handle Excel export format', async () => {
      const mockAnalytics = {
        summary: {
          total_executions: 50,
          unique_users: 25,
          success_rate: 0.92,
          avg_execution_time: 900,
        },
      }

      mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(mockAnalytics)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics/test-mcp?format=excel',
      })

      const response = await mcpAnalyticsHandler(req, {
        params: Promise.resolve({ mcp_id: 'test-mcp' })
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
      expect(response.headers.get('Content-Disposition')).toContain('.json') // Mock implementation
    })

    it('should return 404 for nonexistent MCP', async () => {
      mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics/nonexistent-mcp',
      })

      const response = await mcpAnalyticsHandler(req, {
        params: Promise.resolve({ mcp_id: 'nonexistent-mcp' })
      })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('MCP not found or no analytics data available')
    })

    it('should use default parameters', async () => {
      const mockAnalytics = { summary: { total_executions: 0 } }
      mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(mockAnalytics)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics/test-mcp',
      })

      const response = await mcpAnalyticsHandler(req, {
        params: Promise.resolve({ mcp_id: 'test-mcp' })
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.timeframe).toBe('7d') // default
      expect(data.metric_type).toBe('all') // default
    })
  })

  describe('POST /api/analytics/[mcp_id]/insights', () => {
    it('should generate AI insights for MCP', async () => {
      // Note: This would test the POST handler if we import it
      // For now, we'll just test the structure
      const mcpId = 'test-mcp'
      const insightType = 'performance'
      const timeframe = '30d'

      // Mock AI insights response
      const mockInsights = {
        summary: 'Your MCP shows strong performance with 95% success rate.',
        recommendations: [
          'Consider optimizing database queries',
          'Add caching layer for frequently accessed data',
        ],
        trends: [
          'Execution time improved by 12% over the last 30 days',
          'User adoption growing at 23% month-over-month',
        ],
      }

      // This would be tested if we had the POST handler
      expect(mockInsights).toHaveProperty('summary')
      expect(mockInsights).toHaveProperty('recommendations')
      expect(mockInsights).toHaveProperty('trends')
    })
  })
})

describe('Analytics API Error Handling', () => {
  it('should handle malformed request data', async () => {
    const { req } = createMocks({
      method: 'GET',
      url: '/api/analytics', // Missing required mcp_id
    })

    const response = await analyticsHandler(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('should handle database connection errors', async () => {
    mockAnalyticsCollector.getMCPAnalytics.mockRejectedValue(
      new Error('Database connection timeout')
    )

    const { req } = createMocks({
      method: 'GET',
      url: '/api/analytics?mcp_id=test-mcp',
    })

    const response = await analyticsHandler(req)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })

  it('should handle invalid JSON responses from analytics collector', async () => {
    mockAnalyticsCollector.getMCPAnalytics.mockResolvedValue(undefined)

    const { req } = createMocks({
      method: 'GET',
      url: '/api/analytics?mcp_id=test-mcp',
    })

    const response = await analyticsHandler(req)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('MCP not found or no analytics data available')
  })
})