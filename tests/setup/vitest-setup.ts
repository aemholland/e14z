/**
 * Vitest Test Setup File
 * Global configuration and utilities for unit and integration tests
 */
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream, WritableStream, TransformStream } from 'stream/web'
import { fetch, Headers, Request, Response } from 'undici'

// Polyfills for Node.js environment
Object.assign(global, {
  TextEncoder,
  TextDecoder,
  ReadableStream,
  WritableStream,
  TransformStream,
  fetch,
  Headers,
  Request,
  Response
})

// React Testing Library cleanup
afterEach(() => {
  cleanup()
})

// Mock Next.js modules
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/'
  })
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn()
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams()
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        gte: vi.fn(() => ({ data: [], error: null })),
        lte: vi.fn(() => ({ data: [], error: null })),
        order: vi.fn(() => ({ data: [], error: null })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => Promise.resolve({ data: null, error: null })),
      delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signIn: vi.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null }))
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        download: vi.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://test.com/file.png' } }))
      }))
    }
  }
}))

// Mock analytics collector
vi.mock('@/lib/analytics/comprehensive-collector', () => ({
  analyticsCollector: {
    collectExecution: vi.fn(),
    collectUserInteraction: vi.fn(),
    collectPerformanceMetric: vi.fn(),
    collectError: vi.fn(),
    getMCPAnalytics: vi.fn(() => Promise.resolve({
      summary: {
        total_executions: 0,
        unique_users: 0,
        success_rate: 1.0,
        avg_execution_time: 100
      },
      time_series: [],
      geographic_distribution: []
    }))
  }
}))

// Mock MCP execution engine
vi.mock('@/lib/execution/enhanced-engine', () => ({
  MCPExecutionEngine: vi.fn().mockImplementation(() => ({
    execute: vi.fn(() => Promise.resolve({
      success: true,
      result: 'Mock execution result',
      executionTime: 100,
      metadata: {}
    })),
    validate: vi.fn(() => ({ valid: true, errors: [] })),
    getCapabilities: vi.fn(() => ({ features: ['mock'] }))
  }))
}))

// Mock search engine
vi.mock('@/lib/search/engine', () => ({
  searchMCPs: vi.fn(() => Promise.resolve({
    results: [],
    total: 0,
    suggestions: []
  })),
  indexMCP: vi.fn(() => Promise.resolve()),
  deleteMCPIndex: vi.fn(() => Promise.resolve())
}))

// Mock rate limiting
vi.mock('@/lib/rate-limiting/config', () => ({
  rateLimiter: {
    check: vi.fn(() => Promise.resolve({ allowed: true, remaining: 100 })),
    reset: vi.fn(() => Promise.resolve())
  }
}))

// Mock logging
vi.mock('@/lib/logging/config', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock environment variables (commented out for build compatibility)
beforeAll(() => {
  // process.env.NODE_ENV = 'test'
  // process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
  // process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  // process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
})

// Global test utilities (commented out for build compatibility)
// global.testUtils = {
  /*
  // Create mock MCP data
  createMockMCP: (overrides = {}) => ({
    id: 'test-mcp-123',
    name: 'Test MCP',
    slug: 'test-mcp',
    description: 'A test MCP for unit testing',
    category: 'testing',
    verified: true,
    avg_rating: 4.5,
    review_count: 10,
    usage_count: 100,
    clean_command: 'npx test-mcp@latest',
    auth_method: 'none',
    tools: ['test-tool'],
    parameters: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),
  
  // Create mock user data
  createMockUser: (overrides = {}) => ({
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: null,
    created_at: new Date().toISOString(),
    ...overrides
  }),
  
  // Create mock analytics data
  createMockAnalytics: (overrides = {}) => ({
    summary: {
      total_executions: 100,
      unique_users: 50,
      success_rate: 0.95,
      avg_execution_time: 250
    },
    time_series: [
      { timestamp: new Date().toISOString(), executions: 10 }
    ],
    geographic_distribution: [
      { country: 'US', count: 30 },
      { country: 'UK', count: 20 }
    ],
    ...overrides
  }),
  
  // Wait for async operations
  waitFor: async (fn: () => boolean, timeout = 5000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (fn()) return
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`)
  },
  
  // Create mock API response
  createMockResponse: (data: any, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  })
}
*/

// Extend expect with custom matchers (commented out for build compatibility)
/*
expect.extend({
  toBeValidMCP(received) {
    const requiredFields = ['id', 'name', 'slug', 'category']
    const missing = requiredFields.filter(field => !(field in received))
    
    if (missing.length > 0) {
      return {
        message: () => `Expected MCP to have required fields: ${missing.join(', ')}`,
        pass: false
      }
    }
    
    return {
      message: () => 'Expected MCP to be invalid',
      pass: true
    }
  },
  
  toHaveValidAnalytics(received) {
    const hasValidSummary = received.summary && 
                          typeof received.summary.total_executions === 'number' &&
                          typeof received.summary.success_rate === 'number'
    
    if (!hasValidSummary) {
      return {
        message: () => 'Expected analytics to have valid summary with total_executions and success_rate',
        pass: false
      }
    }
    
    return {
      message: () => 'Expected analytics to be invalid',
      pass: true
    }
  }
})
*/

// Configure fake timers
vi.useFakeTimers()

// Console suppression for cleaner test output
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

// Type augmentation for global test utilities
declare global {
  const testUtils: {
    createMockMCP: (overrides?: any) => any
    createMockUser: (overrides?: any) => any
    createMockAnalytics: (overrides?: any) => any
    waitFor: (fn: () => boolean, timeout?: number) => Promise<void>
    createMockResponse: (data: any, status?: number) => any
  }
  
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeValidMCP(): T
      toHaveValidAnalytics(): T
    }
  }
}