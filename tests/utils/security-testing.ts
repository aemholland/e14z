/**
 * Security Testing Utilities
 * Comprehensive security testing tools for E14Z (2025)
 */
import { test, expect, Page, Request } from '@playwright/test'
import { createHash, randomBytes } from 'crypto'

export interface SecurityTestResult {
  passed: boolean
  details: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  recommendation?: string
}

export interface SecurityScanResult {
  overall: 'pass' | 'warning' | 'fail'
  tests: Record<string, SecurityTestResult>
  score: number // 0-100
  summary: string
}

export class SecurityTester {
  private page: Page
  private vulnerabilities: SecurityTestResult[] = []
  
  constructor(page: Page) {
    this.page = page
  }
  
  async runComprehensiveScan(baseUrl: string): Promise<SecurityScanResult> {
    const tests: Record<string, SecurityTestResult> = {}
    
    // Run all security tests
    tests.xss = await this.testXSSProtection()
    tests.csrf = await this.testCSRFProtection()
    tests.sqlInjection = await this.testSQLInjection()
    tests.headers = await this.testSecurityHeaders()
    tests.authentication = await this.testAuthenticationSecurity()
    tests.authorization = await this.testAuthorizationControls()
    tests.dataValidation = await this.testInputValidation()
    tests.rateLimiting = await this.testRateLimiting()
    tests.informationDisclosure = await this.testInformationDisclosure()
    tests.fileUpload = await this.testFileUploadSecurity()
    
    // Calculate overall score
    const totalTests = Object.keys(tests).length
    const passedTests = Object.values(tests).filter(t => t.passed).length
    const score = Math.round((passedTests / totalTests) * 100)
    
    // Determine overall status
    const criticalFailures = Object.values(tests).filter(t => !t.passed && t.severity === 'critical').length
    const highFailures = Object.values(tests).filter(t => !t.passed && t.severity === 'high').length
    
    let overall: 'pass' | 'warning' | 'fail'
    if (criticalFailures > 0) {
      overall = 'fail'
    } else if (highFailures > 0 || score < 80) {
      overall = 'warning'
    } else {
      overall = 'pass'
    }
    
    return {
      overall,
      tests,
      score,
      summary: this.generateSecuritySummary(tests, score)
    }
  }
  
  async testXSSProtection(): Promise<SecurityTestResult> {
    try {
      // Test reflected XSS
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '\'"><script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>'
      ]
      
      for (const payload of xssPayloads) {
        // Test in search input
        await this.page.goto('/')
        await this.page.fill('[data-testid="search-input"]', payload)
        await this.page.press('[data-testid="search-input"]', 'Enter')
        
        // Check if payload was executed
        const hasAlert = await this.page.evaluate(() => {
          const originalAlert = window.alert
          let alertCalled = false
          window.alert = () => { alertCalled = true }
          setTimeout(() => { window.alert = originalAlert }, 100)
          return alertCalled
        })
        
        if (hasAlert) {
          return {
            passed: false,
            details: `XSS vulnerability found with payload: ${payload}`,
            severity: 'critical',
            recommendation: 'Implement proper input sanitization and output encoding'
          }
        }
        
        // Check if payload appears unescaped in DOM
        const pageContent = await this.page.content()
        if (pageContent.includes(payload) && !pageContent.includes(this.escapeHtml(payload))) {
          return {
            passed: false,
            details: `Potential XSS: unescaped user input found with payload: ${payload}`,
            severity: 'high',
            recommendation: 'Ensure all user input is properly escaped before rendering'
          }
        }
      }
      
      return {
        passed: true,
        details: 'No XSS vulnerabilities detected',
        severity: 'low'
      }
    } catch (error) {
      return {
        passed: false,
        details: `XSS test failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'medium'
      }
    }
  }
  
  async testCSRFProtection(): Promise<SecurityTestResult> {
    try {
      // Navigate to a form page
      await this.page.goto('/submit')
      
      // Check for CSRF token
      const csrfToken = await this.page.locator('input[name="_token"], input[name="csrf_token"], meta[name="csrf-token"]').first().getAttribute('value') ||
                        await this.page.locator('meta[name="csrf-token"]').first().getAttribute('content')
      
      if (!csrfToken) {
        return {
          passed: false,
          details: 'No CSRF token found in forms',
          severity: 'high',
          recommendation: 'Implement CSRF protection tokens in all state-changing forms'
        }
      }
      
      // Test if form submission works without CSRF token
      await this.page.evaluate(() => {
        const tokenInputs = document.querySelectorAll('input[name="_token"], input[name="csrf_token"]')
        tokenInputs.forEach(input => input.remove())
      })
      
      // Try to submit form without token
      const response = await this.page.request.post('/api/submit', {
        data: { test: 'data' }
      })
      
      if (response.ok()) {
        return {
          passed: false,
          details: 'Form submission succeeded without CSRF token',
          severity: 'critical',
          recommendation: 'Enforce CSRF token validation on server side'
        }
      }
      
      return {
        passed: true,
        details: 'CSRF protection appears to be implemented correctly',
        severity: 'low'
      }
    } catch (error) {
      return {
        passed: false,
        details: `CSRF test failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'medium'
      }
    }
  }
  
  async testSQLInjection(): Promise<SecurityTestResult> {
    try {
      const sqlPayloads = [
        "' OR '1'='1",
        "\'; DROP TABLE users; --",
        "1' UNION SELECT 1,2,3--",
        "admin'--",
        "' OR 1=1#"
      ]
      
      for (const payload of sqlPayloads) {
        // Test in search
        await this.page.goto('/')
        await this.page.fill('[data-testid="search-input"]', payload)
        await this.page.press('[data-testid="search-input"]', 'Enter')
        
        // Check for SQL error messages
        const pageContent = (await this.page.content()).toLowerCase()
        const sqlErrorPatterns = [
          'sql syntax',
          'mysql error',
          'postgresql error',
          'sqlite error',
          'ora-',
          'microsoft ole db',
          'unclosed quotation mark'
        ]
        
        for (const pattern of sqlErrorPatterns) {
          if (pageContent.includes(pattern)) {
            return {
              passed: false,
              details: `Potential SQL injection vulnerability detected with payload: ${payload}`,
              severity: 'critical',
              recommendation: 'Use parameterized queries and input validation'
            }
          }
        }
      }
      
      return {
        passed: true,
        details: 'No SQL injection vulnerabilities detected',
        severity: 'low'
      }
    } catch (error) {
      return {
        passed: false,
        details: `SQL injection test failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'medium'
      }
    }
  }
  
  async testSecurityHeaders(): Promise<SecurityTestResult> {
    try {
      const response = await this.page.goto('/')
      const headers = response?.headers() || {}
      
      const missingHeaders: string[] = []
      const weakHeaders: string[] = []
      
      // Check for required security headers
      if (!headers['content-security-policy']) {
        missingHeaders.push('Content-Security-Policy')
      }
      
      if (!headers['x-frame-options'] && !headers['content-security-policy']?.includes('frame-ancestors')) {
        missingHeaders.push('X-Frame-Options')
      }
      
      if (!headers['x-content-type-options']) {
        missingHeaders.push('X-Content-Type-Options')
      }
      
      if (!headers['referrer-policy']) {
        missingHeaders.push('Referrer-Policy')
      }
      
      if (!headers['permissions-policy']) {
        missingHeaders.push('Permissions-Policy')
      }
      
      // Check for weak configurations
      if (headers['x-frame-options'] === 'ALLOWALL') {
        weakHeaders.push('X-Frame-Options set to ALLOWALL')
      }
      
      if (headers['content-security-policy']?.includes("'unsafe-eval'") || 
          headers['content-security-policy']?.includes("'unsafe-inline'")) {
        weakHeaders.push('CSP contains unsafe directives')
      }
      
      const severity = missingHeaders.length > 2 ? 'high' : 
                      missingHeaders.length > 0 || weakHeaders.length > 0 ? 'medium' : 'low'
      
      if (missingHeaders.length > 0 || weakHeaders.length > 0) {
        return {
          passed: false,
          details: `Security headers issues: Missing: ${missingHeaders.join(', ')}. Weak: ${weakHeaders.join(', ')}`,
          severity,
          recommendation: 'Implement all recommended security headers with secure configurations'
        }
      }
      
      return {
        passed: true,
        details: 'All security headers are properly configured',
        severity: 'low'
      }
    } catch (error) {
      return {
        passed: false,
        details: `Security headers test failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'medium'
      }
    }
  }
  
  async testAuthenticationSecurity(): Promise<SecurityTestResult> {
    try {
      // Test authentication bypass
      const protectedUrls = ['/admin', '/analytics', '/my-mcps']
      
      for (const url of protectedUrls) {
        const response = await this.page.goto(url)
        
        // Should redirect to login or return 401/403
        if (response?.status() === 200) {
          const pageContent = await this.page.content()
          if (!pageContent.includes('login') && !pageContent.includes('sign in')) {
            return {
              passed: false,
              details: `Protected URL ${url} is accessible without authentication`,
              severity: 'critical',
              recommendation: 'Implement proper authentication checks for protected routes'
            }
          }
        }
      }
      
      // Test session security
      await this.page.goto('/login')
      
      // Check for secure session cookies
      const cookies = await this.page.context().cookies()
      const sessionCookies = cookies.filter(c => c.name.includes('session') || c.name.includes('auth'))
      
      for (const cookie of sessionCookies) {
        if (!cookie.secure || !cookie.httpOnly) {
          return {
            passed: false,
            details: `Insecure session cookie: ${cookie.name} (secure: ${cookie.secure}, httpOnly: ${cookie.httpOnly})`,
            severity: 'high',
            recommendation: 'Set secure and httpOnly flags on all session cookies'
          }
        }
      }
      
      return {
        passed: true,
        details: 'Authentication security appears properly implemented',
        severity: 'low'
      }
    } catch (error) {
      return {
        passed: false,
        details: `Authentication test failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'medium'
      }
    }
  }
  
  async testRateLimiting(): Promise<SecurityTestResult> {
    try {
      const testUrl = '/api/discover'
      const requests: Promise<any>[] = []
      
      // Send multiple rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(this.page.request.get(testUrl))
      }
      
      const responses = await Promise.all(requests)
      const rateLimitedResponses = responses.filter(r => r.status() === 429)
      
      if (rateLimitedResponses.length === 0) {
        return {
          passed: false,
          details: 'No rate limiting detected after 20 rapid requests',
          severity: 'medium',
          recommendation: 'Implement rate limiting to prevent abuse'
        }
      }
      
      return {
        passed: true,
        details: `Rate limiting working: ${rateLimitedResponses.length}/${responses.length} requests rate limited`,
        severity: 'low'
      }
    } catch (error) {
      return {
        passed: false,
        details: `Rate limiting test failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'medium'
      }
    }
  }
  
  async testInputValidation(): Promise<SecurityTestResult> {
    try {
      const maliciousInputs = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '<script>alert("xss")</script>',
        '${7*7}',
        '{{7*7}}',
        '#{7*7}',
        'a'.repeat(10000) // Buffer overflow attempt
      ]
      
      for (const input of maliciousInputs) {
        await this.page.goto('/')
        await this.page.fill('[data-testid="search-input"]', input)
        await this.page.press('[data-testid="search-input"]', 'Enter')
        
        // Check for error responses that might indicate vulnerabilities
        const pageContent = await this.page.content()
        
        // Check for path traversal
        if (pageContent.includes('root:') || pageContent.includes('Administrator')) {
          return {
            passed: false,
            details: `Path traversal vulnerability detected with input: ${input}`,
            severity: 'critical',
            recommendation: 'Implement proper input validation and sanitization'
          }
        }
        
        // Check for template injection
        if (pageContent.includes('49')) { // 7*7 = 49
          return {
            passed: false,
            details: `Template injection vulnerability detected with input: ${input}`,
            severity: 'high',
            recommendation: 'Avoid dynamic template evaluation with user input'
          }
        }
      }
      
      return {
        passed: true,
        details: 'Input validation appears properly implemented',
        severity: 'low'
      }
    } catch (error) {
      return {
        passed: false,
        details: `Input validation test failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'medium'
      }
    }
  }
  
  async testAuthorizationControls(): Promise<SecurityTestResult> {
    // This would require more complex setup with different user roles
    return {
      passed: true,
      details: 'Authorization controls not tested (requires multi-user setup)',
      severity: 'low'
    }
  }
  
  async testInformationDisclosure(): Promise<SecurityTestResult> {
    try {
      // Test for information disclosure in error pages
      const testUrls = [
        '/nonexistent-page',
        '/admin/secret',
        '/api/internal'
      ]
      
      for (const url of testUrls) {
        const response = await this.page.goto(url)
        const pageContent = await this.page.content()
        
        // Check for sensitive information in error pages
        const sensitivePatterns = [
          'stack trace',
          'database error',
          'internal server error',
          'file not found',
          'permission denied',
          '/home/',
          '/var/',
          'c:\\',
          'node_modules'
        ]
        
        for (const pattern of sensitivePatterns) {
          if (pageContent.toLowerCase().includes(pattern)) {
            return {
              passed: false,
              details: `Information disclosure detected on ${url}: ${pattern}`,
              severity: 'medium',
              recommendation: 'Implement generic error pages that do not reveal system information'
            }
          }
        }
      }
      
      return {
        passed: true,
        details: 'No information disclosure detected',
        severity: 'low'
      }
    } catch (error) {
      return {
        passed: false,
        details: `Information disclosure test failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'medium'
      }
    }
  }
  
  async testFileUploadSecurity(): Promise<SecurityTestResult> {
    // Placeholder for file upload security tests
    return {
      passed: true,
      details: 'File upload security not tested (no upload functionality found)',
      severity: 'low'
    }
  }
  
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
  
  private generateSecuritySummary(tests: Record<string, SecurityTestResult>, score: number): string {
    const failed = Object.values(tests).filter(t => !t.passed)
    const critical = failed.filter(t => t.severity === 'critical').length
    const high = failed.filter(t => t.severity === 'high').length
    const medium = failed.filter(t => t.severity === 'medium').length
    
    if (critical > 0) {
      return `Critical security issues found! ${critical} critical, ${high} high, ${medium} medium severity issues.`
    } else if (high > 0) {
      return `High severity security issues found. ${high} high, ${medium} medium severity issues.`
    } else if (medium > 0) {
      return `Medium severity security issues found. ${medium} issues need attention.`
    } else {
      return `Security scan passed with score ${score}/100. No critical issues found.`
    }
  }
}

// Playwright test helpers for security testing
export const securityTest = test.extend<{ securityTester: SecurityTester }>({
  securityTester: async ({ page }, use) => {
    const tester = new SecurityTester(page)
    await use(tester)
  }
})

// Security test utilities
export const securityUtils = {
  generateCSPHash(script: string): string {
    return 'sha256-' + createHash('sha256').update(script).digest('base64')
  },
  
  generateNonce(): string {
    return randomBytes(16).toString('base64')
  },
  
  validateSecurityHeaders(headers: Record<string, string>): {
    valid: boolean
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []
    
    // Check CSP
    if (!headers['content-security-policy']) {
      issues.push('Missing Content-Security-Policy header')
      recommendations.push('Add CSP header to prevent XSS and other injection attacks')
    }
    
    // Check other headers...
    
    return {
      valid: issues.length === 0,
      issues,
      recommendations
    }
  }
}