/**
 * E14Z Security Components Integration Tests (2025)
 * Testing individual security components integration
 */

import { describe, test, expect, beforeAll } from 'vitest'

// Set up environment for testing
beforeAll(() => {
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true })
  process.env.JWT_SECRET_KEY = 'test-jwt-secret-key-for-testing-only-123456789012345678901234567890123456789012345678901234567890'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only-123456789012345678901234567890123456789012345678901234567890'
  process.env.ENCRYPTION_KEY = 'a'.repeat(128)
  process.env.IDOR_ENCRYPTION_KEY = 'b'.repeat(128)
  process.env.SESSION_SECRET = 'test-session-secret-for-testing-only-123456789012345678901234567890'
  process.env.COOKIE_SECRET = 'test-cookie-secret-for-testing-only-123456789012345678901234567890'
  process.env.CSRF_SECRET = 'test-csrf-secret-for-testing-only-1234567890'
})

describe('Security Components Integration', () => {
  describe('JWT Security System', () => {
    test('should generate and validate JWT tokens', async () => {
      const { jwtSecurity } = await import('../../lib/security/jwt-security')
      
      const userClaims = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'verified' as const,
        roles: ['user'],
        sessionId: 'session-123',
        permissions: ['read', 'write']
      }

      // Generate token pair
      const tokenPair = await jwtSecurity.generateTokenPair(userClaims)
      
      expect(tokenPair).toHaveProperty('accessToken')
      expect(tokenPair).toHaveProperty('refreshToken')
      expect(tokenPair.accessToken).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/)

      // Validate the token
      const validation = await jwtSecurity.validateToken(tokenPair.accessToken)
      
      expect(validation.valid).toBe(true)
      expect(validation.claims?.id).toBe('user-123')
      expect(validation.claims?.email).toBe('test@example.com')
      expect(validation.claims?.tier).toBe('verified')
    })

    test('should reject invalid tokens', async () => {
      const { jwtSecurity } = await import('../../lib/security/jwt-security')
      
      const validation = await jwtSecurity.validateToken('invalid.jwt.token')
      
      expect(validation.valid).toBe(false)
      expect(validation.error).toBeDefined()
    })

    test('should handle token refresh', async () => {
      const { jwtSecurity } = await import('../../lib/security/jwt-security')
      
      const userClaims = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'verified' as const,
        roles: ['user'],
        sessionId: 'session-123',
        permissions: ['read', 'write']
      }

      // Generate initial token pair
      const initialTokens = await jwtSecurity.generateTokenPair(userClaims)
      
      // Refresh tokens
      const refreshResult = await jwtSecurity.refreshToken(initialTokens.refreshToken)
      
      expect(refreshResult).toBeDefined()
      expect(refreshResult).not.toBeNull()
      expect(refreshResult?.accessToken).toBeDefined()
      expect(refreshResult?.refreshToken).toBeDefined()
      
      // New tokens should be different
      expect(refreshResult?.accessToken).not.toBe(initialTokens.accessToken)
    })
  })

  describe('XSS Protection System', () => {
    test('should detect XSS attacks', async () => {
      const { detectXSS } = await import('../../lib/security/advanced-xss-protection')
      
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<svg onload=alert("xss")>',
        'expression(alert("xss"))'
      ]

      for (const payload of xssPayloads) {
        const result = detectXSS(payload)
        expect(result.isXSS).toBe(true)
        expect(result.threats.length).toBeGreaterThan(0)
        expect(['medium', 'high', 'critical']).toContain(result.riskLevel)
      }
    })

    test('should allow safe content', async () => {
      const { detectXSS } = await import('../../lib/security/advanced-xss-protection')
      
      const safeInputs = [
        'Hello world',
        'This is a normal string',
        'react components',
        'database queries',
        'API endpoints'
      ]

      for (const input of safeInputs) {
        const result = detectXSS(input)
        expect(result.isXSS).toBe(false)
        expect(result.threats).toHaveLength(0)
        expect(result.riskLevel).toBe('low')
      }
    })

    test('should sanitize XSS content', async () => {
      const { sanitizeForXSS } = await import('../../lib/security/advanced-xss-protection')
      
      const testCases = [
        {
          input: '<script>alert("xss")</script>',
          expected: ''
        },
        {
          input: 'Hello <b>world</b>',
          expected: 'Hello world'
        },
        {
          input: 'Test "quotes" and \'single quotes\'',
          expected: 'Test &quot;quotes&quot; and &#x27;single quotes&#x27;'
        }
      ]

      for (const testCase of testCases) {
        const result = sanitizeForXSS(testCase.input)
        expect(result).toBe(testCase.expected)
      }
    })
  })

  describe('RBAC System', () => {
    test('should check user permissions correctly', async () => {
      const { rbacManager } = await import('../../lib/security/rbac-system')
      
      const userContext = {
        userId: 'user-123',
        userTier: 'verified' as const,
        sessionId: 'session-123',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        timestamp: new Date(),
        resource: {
          type: 'mcp',
          id: 'mcp-123',
          metadata: {}
        },
        action: {
          type: 'execute',
          intent: 'execute',
          riskLevel: 'medium' as const
        }
      }

      const permission = {
        resource: 'mcp',
        action: 'execute',
        scope: 'public'
      }

      const result = await rbacManager.checkAccess(userContext, permission)
      
      expect(result).toHaveProperty('allowed')
      expect(result).toHaveProperty('reason')
      expect(typeof result.allowed).toBe('boolean')
    })

    test('should deny access to admin resources for regular users', async () => {
      const { rbacManager } = await import('../../lib/security/rbac-system')
      
      const userContext = {
        userId: 'user-123',
        userTier: 'verified' as const,
        sessionId: 'session-123',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        timestamp: new Date(),
        resource: {
          type: 'admin',
          id: 'admin-panel',
          metadata: {}
        },
        action: {
          type: 'read',
          intent: 'read',
          riskLevel: 'high' as const
        }
      }

      const permission = {
        resource: 'admin',
        action: 'read',
        scope: 'global'
      }

      const result = await rbacManager.checkAccess(userContext, permission)
      
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('admin')
    })
  })

  describe('IDOR Prevention System', () => {
    test('should generate secure resource references', async () => {
      const { idorPrevention } = await import('../../lib/security/idor-prevention')
      
      const secureRef = await idorPrevention.generateSecureReference(
        'mcp',
        'mcp-123',
        'user-123',
        'read'
      )
      
      expect(secureRef).toBeDefined()
      expect(typeof secureRef).toBe('object')
      expect(secureRef.token.length).toBeGreaterThan(10)
    })

    test('should validate secure references', async () => {
      const { idorPrevention } = await import('../../lib/security/idor-prevention')
      
      // Generate a secure reference
      const secureRef = await idorPrevention.generateSecureReference(
        'mcp',
        'mcp-123',
        'user-123',
        'read'
      )
      
      // Validate it
      const validation = await idorPrevention.validateSecureReference(
        secureRef.token,
        {
          userId: 'user-123',
          resourceType: 'mcp',
          resourceId: 'mcp-123',
          requestedAccess: 'read'
        }
      )
      
      expect(validation.allowed).toBe(true)
      expect(validation.auditData.resourceId).toBe('mcp-123')
    })

    test('should reject invalid secure references', async () => {
      const { idorPrevention } = await import('../../lib/security/idor-prevention')
      
      const validation = await idorPrevention.validateSecureReference(
        'invalid-reference',
        {
          userId: 'user-123',
          resourceType: 'mcp',
          resourceId: 'mcp-123',
          requestedAccess: 'read'
        }
      )
      
      expect(validation.allowed).toBe(false)
      expect(validation.reason).toBeDefined()
    })
  })

  describe('Threat Detection System', () => {
    test('should analyze normal session activity as safe', async () => {
      const { threatDetection } = await import('../../lib/security/threat-detection')
      
      const normalActivity = {
        userId: 'user-123',
        sessionId: 'session-123',
        timestamp: new Date(),
        endpoint: '/api/discover',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        country: 'US',
        resourcesAccessed: ['discover'],
        dataVolume: 0,
        authenticationMethod: 'jwt',
        privileges: ['user'],
        sensitiveOperations: []
      }

      const result = await threatDetection.analyzeSessionActivity(normalActivity)
      
      expect(result.threatDetected).toBe(false)
      expect(result.riskScore).toBeLessThan(0.5)
      expect(result.severity).toBe('low')
    })

    test('should detect suspicious activity patterns', async () => {
      const { threatDetection } = await import('../../lib/security/threat-detection')
      
      const suspiciousActivity = {
        userId: 'anonymous',
        sessionId: 'session-bot-123',
        timestamp: new Date(),
        endpoint: '/api/admin/delete-all',
        method: 'DELETE',
        statusCode: 403,
        responseTime: 50, // Very fast, automated
        ipAddress: '203.0.113.999',
        userAgent: 'curl/7.68.0',
        country: 'unknown',
        resourcesAccessed: ['admin', 'delete-all'],
        dataVolume: 0,
        authenticationMethod: 'none',
        privileges: [],
        sensitiveOperations: ['admin_access', 'deletion']
      }

      const result = await threatDetection.analyzeSessionActivity(suspiciousActivity)
      
      expect(result.riskScore).toBeGreaterThan(0.5)
      expect(['medium', 'high', 'critical']).toContain(result.severity)
    })
  })

  describe('Request Validation System', () => {
    test('should validate MCP discovery requests', async () => {
      const { validator, Schemas } = await import('../../lib/security/validation-schemas')
      
      const validDiscoverData = {
        query: 'react',
        limit: 10,
        verified: true
      }

      const result = await validator.validateRequest(
        Schemas.MCP.discover,
        validDiscoverData
      )
      
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject(validDiscoverData)
    })

    test('should reject invalid MCP submission data', async () => {
      const { validator, Schemas } = await import('../../lib/security/validation-schemas')
      
      const invalidSubmissionData = {
        name: '', // Too short
        description: 'A'.repeat(2000), // Too long
        repository_url: 'not-a-url',
        categories: [] // Empty array
      }

      const result = await validator.validateRequest(
        Schemas.MCP.submit,
        invalidSubmissionData
      )
      
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.errors.length).toBeGreaterThan(0)
    })

    test('should sanitize input during validation', async () => {
      const { validator, Schemas } = await import('../../lib/security/validation-schemas')
      
      const dataWithXSS = {
        query: 'react<script>alert("xss")</script>',
        limit: 5
      }

      const result = await validator.validateRequest(
        Schemas.MCP.discover,
        dataWithXSS
      )
      
      if (result.success) {
        expect(result.data?.query).not.toContain('<script>')
        expect(result.sanitized?.query).not.toContain('<script>')
      }
    })
  })

  describe('Security System Integration', () => {
    test('should work together in a realistic workflow', async () => {
      // Import all security components
      const { jwtSecurity } = await import('../../lib/security/jwt-security')
      const { rbacManager } = await import('../../lib/security/rbac-system')
      const { idorPrevention } = await import('../../lib/security/idor-prevention')
      const { detectXSS } = await import('../../lib/security/advanced-xss-protection')
      
      // Step 1: User authenticates
      const userClaims = {
        id: 'user-123',
        email: 'test@example.com',
        tier: 'verified' as const,
        roles: ['user'],
        sessionId: 'session-123',
        permissions: ['read', 'write']
      }
      
      const tokens = await jwtSecurity.generateTokenPair(userClaims)
      expect(tokens.accessToken).toBeDefined()
      
      // Step 2: Validate the token
      const tokenValidation = await jwtSecurity.validateToken(tokens.accessToken)
      expect(tokenValidation.valid).toBe(true)
      
      // Step 3: Check user input for XSS
      const userInput = 'I want to search for React components'
      const xssCheck = detectXSS(userInput)
      expect(xssCheck.isXSS).toBe(false)
      
      // Step 4: Check RBAC permissions
      const accessContext = {
        userId: userClaims.id,
        userTier: userClaims.tier,
        sessionId: userClaims.sessionId,
        ipAddress: '127.0.0.1',
        userAgent: 'test-browser',
        timestamp: new Date(),
        resource: {
          type: 'mcp',
          id: 'mcp-456',
          metadata: {}
        },
        action: {
          type: 'execute',
          intent: 'execute',
          riskLevel: 'medium' as const
        }
      }
      
      const permission = {
        resource: 'mcp',
        action: 'execute',
        scope: 'public'
      }
      
      const rbacResult = await rbacManager.checkAccess(accessContext, permission)
      expect(rbacResult.allowed).toBe(true)
      
      // Step 5: Generate secure reference for the resource
      const secureRef = await idorPrevention.generateSecureReference(
        'mcp',
        'mcp-456',
        userClaims.id,
        'execute'
      )
      expect(secureRef).toBeDefined()
      
      // Step 6: Validate the secure reference
      const refValidation = await idorPrevention.validateSecureReference(
        secureRef,
        userClaims.id,
        {
          resourceType: 'mcp',
          resourceId: 'mcp-456',
          requiredAccess: 'execute'
        }
      )
      expect(refValidation.valid).toBe(true)
      
      console.log('✅ Complete security workflow test passed!')
    })
  })
})

describe('Environment Configuration', () => {
  test('should load environment configuration correctly', async () => {
    const { env } = await import('../../lib/config/environment')
    
    const config = env.getConfig()
    
    expect(config.NODE_ENV).toBe('test')
    expect(config.JWT_SECRET_KEY).toBeDefined()
    expect(config.ENCRYPTION_KEY).toBeDefined()
    expect(config.ENABLE_RBAC).toBe(true)
    expect(config.ENABLE_XSS_PROTECTION).toBe(true)
  })

  test('should validate security secrets', async () => {
    const { env } = await import('../../lib/config/environment')
    
    const isValid = env.validateSecrets()
    expect(isValid).toBe(true)
  })
})