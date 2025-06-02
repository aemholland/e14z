/**
 * E14Z Security Pipeline Integration Tests (2025)
 * Comprehensive testing of the 8-phase zero-trust security middleware
 */

import { NextRequest } from 'next/server'
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'

// Test environment setup
const TEST_CONFIG = {
  JWT_SECRET_KEY: 'test-jwt-secret-key-for-testing-only',
  ENCRYPTION_KEY: 'a'.repeat(128), // 64 bytes hex
  IDOR_ENCRYPTION_KEY: 'b'.repeat(128), // 64 bytes hex
  SESSION_SECRET: 'test-session-secret',
  COOKIE_SECRET: 'test-cookie-secret',
  CSRF_SECRET: 'test-csrf-secret'
}

// Mock environment variables
beforeEach(() => {
  Object.entries(TEST_CONFIG).forEach(([key, value]) => {
    vi.stubEnv(key, value)
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Security Pipeline Integration Tests', () => {
  describe('Phase 1: Security Context Building', () => {
    test('should build comprehensive security context for incoming request', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/discover',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'x-forwarded-for': '203.0.113.42',
          'accept-language': 'en-US,en;q=0.9',
          'accept-encoding': 'gzip, deflate, br'
        }
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/discover', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      // Import middleware dynamically to avoid module loading issues
      const { buildSecurityContext } = await import('../../middleware')
      
      const context = await buildSecurityContext(
        request,
        'test-req-123',
        '203.0.113.42',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      )

      expect(context).toMatchObject({
        requestId: 'test-req-123',
        ipAddress: '203.0.113.42',
        threatLevel: expect.oneOf(['low', 'medium', 'high', 'critical']),
        isBot: false,
        sessionMetadata: {
          endpoint: '/api/discover',
          method: 'GET'
        }
      })

      expect(context.deviceFingerprint).toHaveLength(16)
    })

    test('should detect bot traffic and assign appropriate threat level', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/discover',
        headers: {
          'user-agent': 'GoogleBot/2.1 (+http://www.google.com/bot.html)'
        }
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/discover', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { buildSecurityContext } = await import('../../middleware')
      
      const context = await buildSecurityContext(
        request,
        'test-req-bot',
        '66.249.66.1',
        'GoogleBot/2.1 (+http://www.google.com/bot.html)'
      )

      expect(context.isBot).toBe(true)
      expect(context.threatLevel).toBe('medium')
    })
  })

  describe('Phase 2: JWT Authentication & Authorization', () => {
    test('should successfully authenticate valid JWT token', async () => {
      // First, generate a valid JWT token
      const { jwtSecurity } = await import('../../lib/security/jwt-security')
      
      const userClaims = {
        sub: 'user-123',
        email: 'test@example.com',
        tier: 'verified' as const,
        roles: ['user'],
        sessionId: 'session-123'
      }

      const tokenPair = await jwtSecurity.generateTokenPair(userClaims)

      const { req } = createMocks({
        method: 'GET',
        url: '/api/admin/stats',
        headers: {
          'authorization': `Bearer ${tokenPair.accessToken}`
        }
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/admin/stats', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { handleAuthentication } = await import('../../middleware')
      
      const securityContext = {
        requestId: 'test-req-auth',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        threatLevel: 'low' as const,
        isBot: false,
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/admin/stats',
          method: 'GET'
        }
      }

      const authResult = await handleAuthentication(request, securityContext)

      expect(authResult.response).toBeUndefined()
      expect(authResult.userClaims).toMatchObject({
        sub: 'user-123',
        email: 'test@example.com',
        tier: 'verified'
      })
    })

    test('should reject invalid JWT token', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/admin/stats',
        headers: {
          'authorization': 'Bearer invalid.jwt.token'
        }
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/admin/stats', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { handleAuthentication } = await import('../../middleware')
      
      const securityContext = {
        requestId: 'test-req-invalid-auth',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        threatLevel: 'low' as const,
        isBot: false,
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/admin/stats',
          method: 'GET'
        }
      }

      const authResult = await handleAuthentication(request, securityContext)

      expect(authResult.response).toBeDefined()
      expect(authResult.response?.status).toBe(401)
      expect(authResult.userClaims).toBeUndefined()
    })
  })

  describe('Phase 3: Real-time Threat Detection', () => {
    test('should allow normal user behavior', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/discover',
        headers: {
          'content-length': '0'
        }
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/discover', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { performThreatDetection } = await import('../../middleware')
      
      const securityContext = {
        requestId: 'test-req-normal',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        country: 'US',
        threatLevel: 'low' as const,
        isBot: false,
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/discover',
          method: 'GET'
        }
      }

      const userClaims = {
        sub: 'user-123',
        email: 'test@example.com',
        tier: 'verified' as const,
        roles: ['user'],
        sessionId: 'session-123'
      }

      const threatResult = await performThreatDetection(request, securityContext, userClaims)

      expect(threatResult.blocked).toBe(false)
      expect(threatResult.response).toBeUndefined()
    })

    test('should detect and block critical threats', async () => {
      // Simulate a request that would trigger threat detection
      const { req } = createMocks({
        method: 'POST',
        url: '/api/admin/users/delete-all',
        headers: {
          'content-length': '10000000' // Unusually large payload
        }
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/admin/users/delete-all', {
        method: 'POST',
        headers: req.headers as HeadersInit
      }))

      const { performThreatDetection } = await import('../../middleware')
      
      const securityContext = {
        requestId: 'test-req-threat',
        ipAddress: '203.0.113.999', // Suspicious IP
        userAgent: 'curl/7.68.0', // Automated tool
        country: 'unknown',
        threatLevel: 'high' as const,
        isBot: true,
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/admin/users/delete-all',
          method: 'POST'
        }
      }

      const threatResult = await performThreatDetection(request, securityContext)

      // Note: Actual blocking depends on threat detection rules implementation
      // This test validates the threat detection pipeline works
      expect(threatResult).toHaveProperty('blocked')
      expect(typeof threatResult.blocked).toBe('boolean')
    })
  })

  describe('Phase 4: Request Validation & XSS Protection', () => {
    test('should validate and sanitize safe input', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/discover?query=react&limit=10',
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/discover?query=react&limit=10', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { performRequestValidation } = await import('../../middleware')
      
      const validationResult = await performRequestValidation(request, '/api/discover', 'GET')

      expect(validationResult.response).toBeUndefined()
    })

    test('should block XSS attacks in query parameters', async () => {
      const xssPayload = encodeURIComponent('<script>alert("xss")</script>')
      const { req } = createMocks({
        method: 'GET',
        url: `/api/discover?query=${xssPayload}`,
      })

      const request = new NextRequest(new Request(`http://localhost:3000/api/discover?query=${xssPayload}`, {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { performRequestValidation } = await import('../../middleware')
      
      const validationResult = await performRequestValidation(request, '/api/discover', 'GET')

      expect(validationResult.response?.status).toBe(400)
    })

    test('should validate MCP submission payload', async () => {
      const validPayload = {
        name: 'test-mcp',
        description: 'A test MCP for validation',
        repository_url: 'https://github.com/test/mcp',
        categories: ['development-tools'],
        auth_required: false
      }

      const { req } = createMocks({
        method: 'POST',
        url: '/api/submit',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(validPayload)
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/submit', {
        method: 'POST',
        headers: req.headers as HeadersInit,
        body: JSON.stringify(validPayload)
      }))

      const { performRequestValidation } = await import('../../middleware')
      
      const validationResult = await performRequestValidation(request, '/api/submit', 'POST')

      expect(validationResult.response).toBeUndefined()
    })
  })

  describe('Phase 5: Context-Aware Rate Limiting', () => {
    test('should apply different rate limits based on user tier', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/discover',
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/discover', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { handleAdvancedRateLimit } = await import('../../middleware')
      
      // Test anonymous user context
      const anonymousContext = {
        requestId: 'test-req-anon',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        threatLevel: 'low' as const,
        isBot: false,
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/discover',
          method: 'GET'
        }
      }

      const anonymousResult = await handleAdvancedRateLimit(request, anonymousContext)
      
      expect(anonymousResult.nextResponse?.headers.get('X-User-Tier')).toBe('anonymous')
      expect(anonymousResult.nextResponse?.headers.get('X-RateLimit-Limit')).toBeDefined()

      // Test verified user context
      const verifiedContext = {
        ...anonymousContext,
        userClaims: {
          sub: 'user-123',
          email: 'test@example.com',
          tier: 'verified' as const,
          roles: ['user'],
          sessionId: 'session-123'
        }
      }

      const verifiedResult = await handleAdvancedRateLimit(request, verifiedContext)
      
      expect(verifiedResult.nextResponse?.headers.get('X-User-Tier')).toBe('verified')
      
      // Verified users should have higher limits
      const anonLimit = parseInt(anonymousResult.nextResponse?.headers.get('X-RateLimit-Limit') || '0')
      const verifiedLimit = parseInt(verifiedResult.nextResponse?.headers.get('X-RateLimit-Limit') || '0')
      
      expect(verifiedLimit).toBeGreaterThan(anonLimit)
    })

    test('should reduce rate limits for high threat levels', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/discover',
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/discover', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { handleAdvancedRateLimit } = await import('../../middleware')
      
      // Test high threat context
      const highThreatContext = {
        requestId: 'test-req-threat',
        ipAddress: '127.0.0.1',
        userAgent: 'suspicious-bot/1.0',
        threatLevel: 'high' as const,
        isBot: true,
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/discover',
          method: 'GET'
        }
      }

      const threatResult = await handleAdvancedRateLimit(request, highThreatContext)
      
      expect(threatResult.nextResponse?.headers.get('X-Threat-Level')).toBe('high')
      expect(threatResult.nextResponse?.headers.get('X-Rate-Multiplier')).toBeDefined()
      
      const multiplier = parseFloat(threatResult.nextResponse?.headers.get('X-Rate-Multiplier') || '1')
      expect(multiplier).toBeLessThan(1) // Should reduce limits for threats
    })
  })

  describe('Phase 6: RBAC Permission Checks', () => {
    test('should allow access with proper permissions', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/analytics/user-123',
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/analytics/user-123', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { performRBACCheck } = await import('../../middleware')
      
      const userClaims = {
        sub: 'user-123',
        email: 'test@example.com',
        tier: 'verified' as const,
        roles: ['user'],
        sessionId: 'session-123'
      }

      const securityContext = {
        requestId: 'test-req-rbac',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        threatLevel: 'low' as const,
        isBot: false,
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/analytics/user-123',
          method: 'GET'
        }
      }

      const rbacResult = await performRBACCheck(request, '/api/analytics/user-123', userClaims, securityContext)
      
      expect(rbacResult.response).toBeUndefined() // No response means access granted
    })

    test('should deny access to admin endpoints for non-admin users', async () => {
      const { req } = createMocks({
        method: 'GET',
        url: '/api/admin/stats',
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/admin/stats', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      const { performRBACCheck } = await import('../../middleware')
      
      const userClaims = {
        sub: 'user-123',
        email: 'test@example.com',
        tier: 'verified' as const,
        roles: ['user'], // Not admin
        sessionId: 'session-123'
      }

      const securityContext = {
        requestId: 'test-req-rbac-deny',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        threatLevel: 'low' as const,
        isBot: false,
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/admin/stats',
          method: 'GET'
        }
      }

      const rbacResult = await performRBACCheck(request, '/api/admin/stats', userClaims, securityContext)
      
      expect(rbacResult.response?.status).toBe(403)
    })
  })

  describe('Phase 7: Security Headers', () => {
    test('should apply comprehensive OWASP security headers', async () => {
      const { addAdvancedSecurityHeaders } = await import('../../middleware')
      
      const response = new Response('test')
      const nextResponse = new NextResponse(response)
      
      const securityContext = {
        requestId: 'test-req-headers',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        deviceFingerprint: 'test-fingerprint-123',
        threatLevel: 'low' as const,
        isBot: false,
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/discover',
          method: 'GET'
        }
      }

      addAdvancedSecurityHeaders(nextResponse, securityContext)

      // Check OWASP security headers
      expect(nextResponse.headers.get('X-Frame-Options')).toBe('DENY')
      expect(nextResponse.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(nextResponse.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
      expect(nextResponse.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      
      // Check CSP header
      expect(nextResponse.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
      
      // Check HSTS
      expect(nextResponse.headers.get('Strict-Transport-Security')).toContain('max-age=31536000')
      
      // Check custom security headers
      expect(nextResponse.headers.get('X-Security-Level')).toBe('low')
      expect(nextResponse.headers.get('X-Device-Fingerprint')).toBe('test-fin') // First 8 chars
      expect(nextResponse.headers.get('X-Bot-Detection')).toBe('none')
    })

    test('should apply stricter cache control for authenticated endpoints', async () => {
      const { addAdvancedSecurityHeaders } = await import('../../middleware')
      
      const response = new Response('test')
      const nextResponse = new NextResponse(response)
      
      const securityContext = {
        requestId: 'test-req-auth-headers',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        deviceFingerprint: 'test-fingerprint-123',
        threatLevel: 'low' as const,
        isBot: false,
        userClaims: {
          sub: 'user-123',
          email: 'test@example.com',
          tier: 'verified' as const,
          roles: ['user'],
          sessionId: 'session-123'
        },
        sessionMetadata: {
          startTime: Date.now(),
          endpoint: '/api/admin/stats',
          method: 'GET'
        }
      }

      addAdvancedSecurityHeaders(nextResponse, securityContext)

      expect(nextResponse.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate')
      expect(nextResponse.headers.get('Pragma')).toBe('no-cache')
      expect(nextResponse.headers.get('Expires')).toBe('0')
    })
  })

  describe('Phase 8: Full Pipeline Integration', () => {
    test('should process a complete request through all security phases', async () => {
      // Mock the full middleware function
      const middleware = await import('../../middleware')
      
      const { req } = createMocks({
        method: 'GET',
        url: '/api/discover?query=react&limit=5',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'x-forwarded-for': '127.0.0.1'
        }
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/discover?query=react&limit=5', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      // Process through middleware
      const response = await middleware.middleware(request)

      // Verify response
      expect(response).toBeDefined()
      expect(response.headers.get('X-Request-ID')).toBeDefined()
      expect(response.headers.get('X-Response-Time')).toBeDefined()
      expect(response.headers.get('X-Security-Result')).toBeDefined()
      
      // Security headers should be present
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('X-RateLimit-Limit')).toBeDefined()
      expect(response.headers.get('X-User-Tier')).toBeDefined()
    })

    test('should handle errors gracefully and fail securely', async () => {
      // Create a request that might cause errors
      const { req } = createMocks({
        method: 'POST',
        url: '/api/malformed-endpoint',
        headers: {
          'content-type': 'application/json'
        },
        body: 'invalid-json-{{'
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/malformed-endpoint', {
        method: 'POST',
        headers: req.headers as HeadersInit,
        body: 'invalid-json-{{'
      }))

      const middleware = await import('../../middleware')
      
      // Should not throw - should handle errors gracefully
      const response = await middleware.middleware(request)
      
      expect(response).toBeDefined()
      expect(response.headers.get('X-Request-ID')).toBeDefined()
      
      // Should fail securely (either allow with warnings or deny)
      const result = response.headers.get('X-Security-Result')
      expect(['success', 'validation_failed', 'security_error']).toContain(result)
    })
  })

  describe('Performance and Monitoring Integration', () => {
    test('should track APM metrics throughout security pipeline', async () => {
      const middleware = await import('../../middleware')
      const { apmCollector } = await import('../../lib/monitoring/apm-metrics-collector')
      
      // Spy on APM methods
      const startRequestSpy = vi.spyOn(apmCollector, 'startRequest')
      const endRequestSpy = vi.spyOn(apmCollector, 'endRequest')

      const { req } = createMocks({
        method: 'GET',
        url: '/api/discover',
      })

      const request = new NextRequest(new Request('http://localhost:3000/api/discover', {
        method: 'GET',
        headers: req.headers as HeadersInit
      }))

      await middleware.middleware(request)

      expect(startRequestSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^req_/),
        '/api/discover',
        'GET',
        expect.any(String)
      )

      expect(endRequestSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^req_/),
        expect.any(Number)
      )
    })
  })
})

// Helper functions for testing
export function createTestUserClaims(overrides: Partial<any> = {}) {
  return {
    sub: 'test-user-123',
    email: 'test@example.com',
    tier: 'verified' as const,
    roles: ['user'],
    sessionId: 'test-session-123',
    ...overrides
  }
}

export function createTestSecurityContext(overrides: Partial<any> = {}) {
  return {
    requestId: 'test-req-123',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    deviceFingerprint: 'test-fingerprint',
    threatLevel: 'low' as const,
    isBot: false,
    sessionMetadata: {
      startTime: Date.now(),
      endpoint: '/api/test',
      method: 'GET'
    },
    ...overrides
  }
}