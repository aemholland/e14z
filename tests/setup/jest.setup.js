/**
 * Jest Setup for E14Z Testing
 * Global test configuration, mocks, and utilities
 */

import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'stream/web'

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.ReadableStream = ReadableStream

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.E14Z_API_URL = 'http://localhost:3000'
process.env.ADMIN_API_KEY = 'test-admin-key'

// Mock fetch globally
global.fetch = jest.fn()

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}))

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    pop: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }),
}))

// Mock Next.js navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock logging
jest.mock('@/lib/logging/config', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
  performanceLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  securityLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  apiLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock analytics collector
jest.mock('@/lib/analytics/comprehensive-collector', () => ({
  analyticsCollector: {
    startExecutionTracking: jest.fn().mockResolvedValue('test-execution-id'),
    trackInstallation: jest.fn().mockResolvedValue(undefined),
    trackExecution: jest.fn().mockResolvedValue(undefined),
    completeExecutionTracking: jest.fn().mockResolvedValue(undefined),
    getMCPAnalytics: jest.fn().mockResolvedValue({
      summary: {
        total_executions: 100,
        unique_users: 50,
        success_rate: 0.95,
        avg_execution_time: 850,
      },
    }),
  },
}))

// Mock alert manager
jest.mock('@/lib/alerting/alert-manager', () => ({
  alertManager: {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    evaluateAllRules: jest.fn().mockResolvedValue(undefined),
    fireAlert: jest.fn().mockResolvedValue(undefined),
  },
}))

// Mock rate limiting
jest.mock('@/lib/rate-limiting/config', () => ({
  getRateLimiter: jest.fn().mockReturnValue({
    limiter: {
      limit: jest.fn().mockResolvedValue({
        success: true,
        remaining: 99,
        reset: new Date(Date.now() + 60000),
      }),
    },
    rule: {
      requests: 100,
      window: '1 m',
      description: 'Test rate limit',
    },
    type: 'default',
  }),
  getUserTier: jest.fn().mockReturnValue('community'),
  getRateLimitIdentifier: jest.fn().mockReturnValue('test-user'),
  getEffectiveLimit: jest.fn().mockReturnValue(100),
}))

// Mock child process for CLI testing
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn(),
  execSync: jest.fn(),
}))

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
    rm: jest.fn(),
  },
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
}))

// Mock crypto for deterministic tests
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('test-random-bytes')),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('test-hash'),
  })),
}))

// Custom test utilities
global.testUtils = {
  // Create mock MCP data
  createMockMCP: (overrides = {}) => ({
    id: 'test-mcp-id',
    name: 'Test MCP',
    slug: 'test-mcp',
    description: 'A test MCP for unit tests',
    category: 'testing',
    verified: false,
    clean_command: 'npx test-mcp',
    auto_install_command: 'npx test-mcp@latest',
    auth_method: 'none',
    tools: [
      {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {},
      },
    ],
    ...overrides,
  }),

  // Create mock execution result
  createMockExecutionResult: (overrides = {}) => ({
    success: true,
    output: 'Test execution completed',
    error: null,
    duration: 1000,
    command: 'npx test-mcp',
    slug: 'test-mcp',
    autoInstalled: false,
    cachePath: '/test/cache/path',
    ...overrides,
  }),

  // Create mock analytics data
  createMockAnalytics: (overrides = {}) => ({
    session_id: 'test-session',
    execution_id: 'test-execution',
    mcp_id: 'test-mcp-id',
    mcp_slug: 'test-mcp',
    user_tier: 'community',
    execution_success: true,
    execution_duration_ms: 1000,
    installation_method: 'npm',
    cache_hit: false,
    ...overrides,
  }),

  // Create mock alert
  createMockAlert: (overrides = {}) => ({
    id: 'test-alert-id',
    rule_id: 'test-rule-id',
    rule_name: 'Test Alert Rule',
    severity: 'warning',
    message: 'Test alert message',
    current_value: 50,
    threshold: 100,
    status: 'firing',
    fired_at: new Date().toISOString(),
    notification_sent: false,
    metadata: {},
    ...overrides,
  }),

  // Wait for async operations
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock API response
  mockAPIResponse: (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  }),
}

// Global test cleanup
afterEach(() => {
  // Clear all mocks after each test
  jest.clearAllMocks()
  
  // Reset fetch mock
  if (global.fetch.mockClear) {
    global.fetch.mockClear()
  }
})

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit in tests, just log
})

// Increase timeout for integration tests
jest.setTimeout(10000)

// Console suppression for cleaner test output
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args) => {
    if (args[0]?.includes && args[0].includes('Warning:')) {
      return
    }
    originalError.call(console, ...args)
  }
  
  console.warn = (...args) => {
    if (args[0]?.includes && args[0].includes('Warning:')) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})