/**
 * Unit Tests for Comprehensive Analytics Collector
 * Tests the core analytics tracking and data collection functionality
 */

import { ComprehensiveAnalyticsCollector } from '@/lib/analytics/comprehensive-collector'

// Mock the supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
}

jest.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabase,
}))

describe('ComprehensiveAnalyticsCollector', () => {
  let collector: ComprehensiveAnalyticsCollector
  
  beforeEach(() => {
    collector = new ComprehensiveAnalyticsCollector()
    jest.clearAllMocks()
  })

  describe('startExecutionTracking', () => {
    it('should start tracking an MCP execution session', async () => {
      const sessionId = 'test-session-123'
      const mcpSlug = 'test-mcp'
      const mcpId = 'mcp-456'
      const userContext = {
        userId: 'user-789',
        tier: 'community',
        userAgent: 'E14Z CLI/4.1.1',
        ipAddress: '192.168.1.1',
        timezone: 'America/New_York',
        source: 'cli',
        os: 'darwin',
        arch: 'arm64',
      }
      const discoveryContext = {
        sessionId: 'discovery-123',
        query: 'payment processing',
        rank: 1,
        timeSinceDiscovery: 5000,
      }

      const executionId = await collector.startExecutionTracking(
        sessionId,
        mcpSlug,
        mcpId,
        userContext,
        discoveryContext
      )

      expect(executionId).toMatch(/^exec_\d+_[a-z0-9]+$/)
      
      // Check that analytics data structure is correctly created
      const sessionMetrics = collector['sessionMetrics']
      expect(sessionMetrics.has(executionId)).toBe(true)
      
      const analytics = sessionMetrics.get(executionId)
      expect(analytics).toMatchObject({
        session_id: sessionId,
        execution_id: executionId,
        mcp_id: mcpId,
        mcp_slug: mcpSlug,
        user_id: userContext.userId,
        user_tier: userContext.tier,
        user_agent: userContext.userAgent,
        ip_address: userContext.ipAddress,
        discovery_session_id: discoveryContext.sessionId,
        discovery_query: discoveryContext.query,
        discovery_rank: discoveryContext.rank,
        time_from_discovery_to_execution: discoveryContext.timeSinceDiscovery,
        operating_system: userContext.os,
        architecture: userContext.arch,
      })
      
      expect(analytics?.execution_start_time).toBeDefined()
      expect(analytics?.time_of_day).toBeDefined()
      expect(analytics?.day_of_week).toBeDefined()
    })

    it('should handle missing user context gracefully', async () => {
      const userContext = {
        tier: 'anonymous',
        userAgent: 'E14Z CLI/4.1.1',
        ipAddress: '127.0.0.1',
        source: 'cli',
      }

      const executionId = await collector.startExecutionTracking(
        'session-123',
        'test-mcp',
        'mcp-456',
        userContext
      )

      expect(executionId).toBeDefined()
      
      const analytics = collector['sessionMetrics'].get(executionId)
      expect(analytics?.user_id).toBeNull()
      expect(analytics?.user_tier).toBe('anonymous')
    })
  })

  describe('trackInstallation', () => {
    it('should track successful installation', async () => {
      const executionId = 'exec_123_abc'
      const installationData = {
        method: 'npm',
        success: true,
        duration: 5000,
        cacheHit: false,
        dependencies: ['dependency1', 'dependency2'],
      }

      // Setup session metrics
      collector['sessionMetrics'].set(executionId, {
        session_id: 'test-session',
        execution_id: executionId,
      })

      await collector.trackInstallation(executionId, installationData)

      const analytics = collector['sessionMetrics'].get(executionId)
      expect(analytics).toMatchObject({
        installation_method: 'npm',
        installation_success: true,
        installation_duration_ms: 5000,
        cache_hit: false,
        dependencies_installed: ['dependency1', 'dependency2'],
      })
    })

    it('should track failed installation with error', async () => {
      const executionId = 'exec_123_abc'
      const installationData = {
        method: 'pip',
        success: false,
        duration: 2000,
        cacheHit: false,
        error: 'Package not found',
      }

      collector['sessionMetrics'].set(executionId, {
        session_id: 'test-session',
        execution_id: executionId,
      })

      await collector.trackInstallation(executionId, installationData)

      const analytics = collector['sessionMetrics'].get(executionId)
      expect(analytics).toMatchObject({
        installation_method: 'pip',
        installation_success: false,
        installation_error: 'Package not found',
      })
    })

    it('should handle missing execution ID gracefully', async () => {
      const installationData = {
        method: 'npm',
        success: true,
        duration: 1000,
        cacheHit: true,
      }

      // Should not throw error
      await expect(
        collector.trackInstallation('nonexistent-id', installationData)
      ).resolves.toBeUndefined()
    })
  })

  describe('trackExecution', () => {
    it('should track successful execution with resource usage', async () => {
      const executionId = 'exec_123_abc'
      const executionData = {
        success: true,
        duration: 3000,
        resourceUsage: {
          peakMemoryMB: 128,
          cpuPercent: 45,
          networkRequests: 5,
          fileOperations: 10,
        },
        toolsUsed: ['tool1', 'tool2', 'tool1'],
        outputSize: 1024,
        outputType: 'json',
      }

      collector['sessionMetrics'].set(executionId, {
        session_id: 'test-session',
        execution_id: executionId,
      })

      await collector.trackExecution(executionId, executionData)

      const analytics = collector['sessionMetrics'].get(executionId)
      expect(analytics).toMatchObject({
        execution_success: true,
        execution_duration_ms: 3000,
        peak_memory_usage_mb: 128,
        cpu_usage_percent: 45,
        network_requests_count: 5,
        file_operations_count: 10,
        tools_used: ['tool1', 'tool2', 'tool1'],
        tool_call_count: 3,
        most_used_tool: 'tool1',
        output_size_bytes: 1024,
        output_type: 'json',
      })
      
      expect(analytics?.execution_end_time).toBeDefined()
      expect(analytics?.execution_quality_score).toBeGreaterThan(0)
      expect(analytics?.user_experience_score).toBeGreaterThan(0)
    })

    it('should track failed execution with error details', async () => {
      const executionId = 'exec_123_abc'
      const executionData = {
        success: false,
        duration: 1500,
        error: 'Authentication failed',
        errorType: 'auth',
      }

      collector['sessionMetrics'].set(executionId, {
        session_id: 'test-session',
        execution_id: executionId,
      })

      await collector.trackExecution(executionId, executionData)

      const analytics = collector['sessionMetrics'].get(executionId)
      expect(analytics).toMatchObject({
        execution_success: false,
        execution_error: 'Authentication failed',
        execution_error_type: 'auth',
        output_contains_errors: true,
      })
    })
  })

  describe('completeExecutionTracking', () => {
    it('should complete tracking and persist to database', async () => {
      const executionId = 'exec_123_abc'
      const mockAnalytics = testUtils.createMockAnalytics({
        execution_id: executionId,
      })

      collector['sessionMetrics'].set(executionId, mockAnalytics)

      // Mock database insertion
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      })

      await collector.completeExecutionTracking(executionId)

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          execution_id: executionId,
          complexity_score: expect.any(Number),
          user_satisfaction_inferred: expect.any(Number),
        })
      )

      // Check that session metrics are cleaned up
      expect(collector['sessionMetrics'].has(executionId)).toBe(false)
    })

    it('should handle database errors gracefully', async () => {
      const executionId = 'exec_123_abc'
      collector['sessionMetrics'].set(executionId, testUtils.createMockAnalytics())

      // Mock database error
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ 
          data: null, 
          error: new Error('Database connection failed') 
        }),
      })

      // Should not throw error
      await expect(
        collector.completeExecutionTracking(executionId)
      ).resolves.toBeUndefined()

      // Session should still be cleaned up
      expect(collector['sessionMetrics'].has(executionId)).toBe(false)
    })
  })

  describe('getMCPAnalytics', () => {
    it('should return comprehensive analytics for enterprise tier', async () => {
      const mcpId = 'test-mcp-id'
      const timeframe = '7d'
      const userTier = 'enterprise'

      // Mock database response
      const mockExecutions = [
        testUtils.createMockAnalytics({ mcp_id: mcpId, execution_success: true }),
        testUtils.createMockAnalytics({ mcp_id: mcpId, execution_success: false }),
        testUtils.createMockAnalytics({ mcp_id: mcpId, execution_success: true }),
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({ 
          data: mockExecutions, 
          error: null 
        }),
      })

      const analytics = await collector.getMCPAnalytics(mcpId, timeframe, userTier)

      expect(analytics).toHaveProperty('summary')
      expect(analytics.summary).toMatchObject({
        total_executions: 3,
        unique_users: expect.any(Number),
        success_rate: expect.any(Number),
        avg_execution_time: expect.any(Number),
      })

      // Enterprise tier should have all features
      expect(analytics).toHaveProperty('time_series')
      expect(analytics).toHaveProperty('geographic_distribution')
      expect(analytics).toHaveProperty('user_intelligence')
      expect(analytics).toHaveProperty('performance_breakdown')
      expect(analytics).toHaveProperty('competitive_intelligence')
      expect(analytics).toHaveProperty('revenue_optimization')
    })

    it('should return limited analytics for anonymous tier', async () => {
      const mcpId = 'test-mcp-id'
      const userTier = 'anonymous'

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({ 
          data: [testUtils.createMockAnalytics()], 
          error: null 
        }),
      })

      const analytics = await collector.getMCPAnalytics(mcpId, '24h', userTier)

      expect(analytics).toHaveProperty('summary')
      expect(analytics).not.toHaveProperty('competitive_intelligence')
      expect(analytics).not.toHaveProperty('revenue_optimization')
    })

    it('should handle missing MCP gracefully', async () => {
      const mcpId = 'nonexistent-mcp'

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({ 
          data: null, 
          error: new Error('Not found') 
        }),
      })

      const analytics = await collector.getMCPAnalytics(mcpId, '7d', 'enterprise')
      expect(analytics).toBeNull()
    })
  })

  describe('helper methods', () => {
    describe('calculateQualityScore', () => {
      it('should return high score for successful execution', () => {
        const executionData = {
          success: true,
          duration: 1000,
          resourceUsage: {
            peakMemoryMB: 100,
            cpuPercent: 30,
          },
        }

        const score = collector['calculateQualityScore'](executionData)
        expect(score).toBeGreaterThan(80)
      })

      it('should return low score for failed execution', () => {
        const executionData = {
          success: false,
          duration: 30000,
          resourceUsage: {
            peakMemoryMB: 1000,
            cpuPercent: 95,
          },
        }

        const score = collector['calculateQualityScore'](executionData)
        expect(score).toBeLessThan(50)
      })
    })

    describe('getMostUsedTool', () => {
      it('should identify most frequently used tool', () => {
        const tools = ['tool1', 'tool2', 'tool1', 'tool3', 'tool1']
        const mostUsed = collector['getMostUsedTool'](tools)
        expect(mostUsed).toBe('tool1')
      })

      it('should handle empty tools array', () => {
        const mostUsed = collector['getMostUsedTool']([])
        expect(mostUsed).toBeUndefined()
      })

      it('should handle undefined tools', () => {
        const mostUsed = collector['getMostUsedTool'](undefined)
        expect(mostUsed).toBeUndefined()
      })
    })

    describe('categorizeError', () => {
      it('should categorize authentication errors', () => {
        const error = new Error('Authentication failed')
        const category = collector['categorizeError'](error)
        expect(category).toBe('auth')
      })

      it('should categorize timeout errors', () => {
        const error = new Error('Request timed out')
        const category = collector['categorizeError'](error)
        expect(category).toBe('timeout')
      })

      it('should categorize network errors', () => {
        const error = new Error('Network connection failed')
        const category = collector['categorizeError'](error)
        expect(category).toBe('network')
      })

      it('should default to crash for unknown errors', () => {
        const error = new Error('Unknown error occurred')
        const category = collector['categorizeError'](error)
        expect(category).toBe('crash')
      })
    })
  })
})