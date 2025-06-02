/**
 * End-to-End Tests for MCP Execution Flow
 * Tests the complete MCP discovery, installation, and execution process
 */

import { test, expect } from '@playwright/test'

test.describe('MCP Execution Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto('/')
  })

  test('should discover MCPs through search', async ({ page }) => {
    // Navigate to discovery page
    await page.click('text=Discover MCPs')
    
    // Search for MCPs
    await page.fill('[data-testid="search-input"]', 'payment')
    await page.click('[data-testid="search-button"]')
    
    // Wait for search results
    await page.waitForSelector('[data-testid="search-results"]')
    
    // Verify search results are displayed
    const results = await page.locator('[data-testid="mcp-card"]').count()
    expect(results).toBeGreaterThan(0)
    
    // Check that MCP cards contain required information
    const firstMCP = page.locator('[data-testid="mcp-card"]').first()
    await expect(firstMCP.locator('[data-testid="mcp-name"]')).toBeVisible()
    await expect(firstMCP.locator('[data-testid="mcp-description"]')).toBeVisible()
    await expect(firstMCP.locator('[data-testid="mcp-category"]')).toBeVisible()
  })

  test('should show MCP details page', async ({ page }) => {
    // Navigate to a specific MCP
    await page.goto('/mcp/stripe-mcp')
    
    // Verify MCP details are displayed
    await expect(page.locator('[data-testid="mcp-title"]')).toBeVisible()
    await expect(page.locator('[data-testid="mcp-description"]')).toBeVisible()
    await expect(page.locator('[data-testid="mcp-category"]')).toBeVisible()
    await expect(page.locator('[data-testid="mcp-tools"]')).toBeVisible()
    
    // Check for execution button if MCP is executable
    const executeButton = page.locator('[data-testid="execute-mcp-button"]')
    if (await executeButton.isVisible()) {
      await expect(executeButton).toContainText('Run MCP')
    }
    
    // Check for installation instructions
    await expect(page.locator('[data-testid="installation-info"]')).toBeVisible()
  })

  test('should handle MCP execution via web interface', async ({ page }) => {
    // Mock API responses
    await page.route('/api/mcp/test-mcp', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testUtils.createMockMCP({
          slug: 'test-mcp',
          clean_command: 'npx test-mcp@latest',
          auth_method: 'none'
        }))
      })
    })

    await page.route('/api/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          output: 'MCP executed successfully',
          duration: 1500,
          command: 'npx test-mcp@latest'
        })
      })
    })

    // Navigate to MCP page
    await page.goto('/mcp/test-mcp')
    
    // Click execute button
    await page.click('[data-testid="execute-mcp-button"]')
    
    // Wait for execution modal or results
    await page.waitForSelector('[data-testid="execution-modal"]')
    
    // Verify execution starts
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('Running')
    
    // Wait for execution to complete
    await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 10000 })
    
    // Verify execution results
    await expect(page.locator('[data-testid="execution-output"]')).toContainText('MCP executed successfully')
    await expect(page.locator('[data-testid="execution-duration"]')).toContainText('1.5s')
  })

  test('should show authentication requirements', async ({ page }) => {
    // Mock MCP that requires authentication
    await page.route('/api/mcp/auth-required-mcp', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testUtils.createMockMCP({
          slug: 'auth-required-mcp',
          auth_method: 'api_key',
        }))
      })
    })

    await page.goto('/mcp/auth-required-mcp')
    
    // Verify authentication warning is shown
    await expect(page.locator('[data-testid="auth-warning"]')).toBeVisible()
    await expect(page.locator('[data-testid="auth-warning"]')).toContainText('Authentication Required')
    
    // Verify auth setup instructions
    await expect(page.locator('[data-testid="auth-instructions"]')).toBeVisible()
    
    // Execute button should be disabled or show warning
    const executeButton = page.locator('[data-testid="execute-mcp-button"]')
    if (await executeButton.isVisible()) {
      await expect(executeButton).toBeDisabled()
    }
  })

  test('should handle execution errors gracefully', async ({ page }) => {
    // Mock MCP execution failure
    await page.route('/api/mcp/failing-mcp', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testUtils.createMockMCP({
          slug: 'failing-mcp',
          clean_command: 'npx failing-mcp@latest',
        }))
      })
    })

    await page.route('/api/run', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Package not found: failing-mcp',
          suggestions: ['Check package name', 'Verify network connection']
        })
      })
    })

    await page.goto('/mcp/failing-mcp')
    
    // Click execute button
    await page.click('[data-testid="execute-mcp-button"]')
    
    // Wait for error to be displayed
    await page.waitForSelector('[data-testid="execution-error"]')
    
    // Verify error message is shown
    await expect(page.locator('[data-testid="execution-error"]')).toContainText('Package not found')
    
    // Verify suggestions are shown
    await expect(page.locator('[data-testid="error-suggestions"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-suggestions"]')).toContainText('Check package name')
  })

  test('should show analytics for MCP developers', async ({ page }) => {
    // Mock analytics data
    await page.route('/api/analytics/**', async route => {
      const url = route.request().url()
      
      if (url.includes('/analytics/test-mcp')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            mcp_id: 'test-mcp',
            timeframe: '7d',
            analytics: {
              summary: {
                total_executions: 150,
                unique_users: 75,
                success_rate: 0.94,
                avg_execution_time: 850
              },
              time_series: [
                { date: '2024-01-01', executions: 20 },
                { date: '2024-01-02', executions: 25 },
              ]
            }
          })
        })
      }
    })

    // Navigate to analytics page
    await page.goto('/analytics/test-mcp')
    
    // Verify analytics dashboard loads
    await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible()
    
    // Check key metrics are displayed
    await expect(page.locator('[data-testid="total-executions"]')).toContainText('150')
    await expect(page.locator('[data-testid="unique-users"]')).toContainText('75')
    await expect(page.locator('[data-testid="success-rate"]')).toContainText('94%')
    
    // Verify time series chart is present
    await expect(page.locator('[data-testid="time-series-chart"]')).toBeVisible()
  })

  test('should handle rate limiting gracefully', async ({ page }) => {
    // Mock rate limit exceeded response
    await page.route('/api/**', async route => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retry_after: 60
        })
      })
    })

    await page.goto('/mcp/test-mcp')
    
    // Try to execute MCP
    await page.click('[data-testid="execute-mcp-button"]')
    
    // Verify rate limit message is shown
    await page.waitForSelector('[data-testid="rate-limit-error"]')
    await expect(page.locator('[data-testid="rate-limit-error"]')).toContainText('Rate limit exceeded')
    await expect(page.locator('[data-testid="retry-after"]')).toContainText('60')
  })

  test('should support filtering and sorting MCPs', async ({ page }) => {
    // Mock MCP list with different categories
    await page.route('/api/discover**', async route => {
      const url = new URL(route.request().url())
      const category = url.searchParams.get('category')
      const verified = url.searchParams.get('verified')
      
      let mockMCPs = [
        testUtils.createMockMCP({ name: 'Payment MCP', category: 'payments', verified: true }),
        testUtils.createMockMCP({ name: 'Database MCP', category: 'databases', verified: false }),
        testUtils.createMockMCP({ name: 'AI MCP', category: 'ai-tools', verified: true }),
      ]
      
      // Apply filters
      if (category) {
        mockMCPs = mockMCPs.filter(mcp => mcp.category === category)
      }
      
      if (verified === 'true') {
        mockMCPs = mockMCPs.filter(mcp => mcp.verified === true)
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: mockMCPs,
          total: mockMCPs.length
        })
      })
    })

    await page.goto('/browse')
    
    // Test category filtering
    await page.selectOption('[data-testid="category-filter"]', 'payments')
    await page.waitForLoadState('networkidle')
    
    // Verify only payment MCPs are shown
    const mcpCards = page.locator('[data-testid="mcp-card"]')
    await expect(mcpCards).toHaveCount(1)
    await expect(mcpCards.first().locator('[data-testid="mcp-name"]')).toContainText('Payment MCP')
    
    // Test verified filter
    await page.check('[data-testid="verified-filter"]')
    await page.waitForLoadState('networkidle')
    
    // All shown MCPs should be verified
    const verifiedBadges = page.locator('[data-testid="verified-badge"]')
    expect(await verifiedBadges.count()).toBeGreaterThan(0)
  })

  test('should provide helpful error messages for network issues', async ({ page }) => {
    // Mock network failure
    await page.route('/api/discover**', async route => {
      await route.abort('failed')
    })

    await page.goto('/browse')
    
    // Verify network error message
    await page.waitForSelector('[data-testid="network-error"]')
    await expect(page.locator('[data-testid="network-error"]')).toContainText('Unable to connect')
    
    // Verify retry button is available
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  })
})

test.describe('Admin Dashboard E2E', () => {
  test('should display system metrics to admin users', async ({ page }) => {
    // Mock admin authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('admin_token', 'test-admin-token')
    })

    // Mock admin stats API
    await page.route('/api/admin/stats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          uptime: '99.95%',
          total_requests_24h: 15420,
          error_rate_24h: 0.02,
          avg_response_time: 245,
          active_users: 890,
          total_mcps: 156,
          pending_reviews: 8,
          critical_alerts: 0
        })
      })
    })

    await page.goto('/admin')
    
    // Verify admin dashboard loads
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible()
    
    // Check system metrics
    await expect(page.locator('[data-testid="uptime-metric"]')).toContainText('99.95%')
    await expect(page.locator('[data-testid="requests-metric"]')).toContainText('15.4K')
    await expect(page.locator('[data-testid="error-rate-metric"]')).toContainText('2.00%')
    await expect(page.locator('[data-testid="response-time-metric"]')).toContainText('245ms')
  })

  test('should allow admin to manage alert rules', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('admin_token', 'test-admin-token')
    })

    // Mock alerts API
    await page.route('/api/admin/alerts', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            alerts: [],
            alert_rules: [
              {
                id: 1,
                name: 'High Error Rate',
                enabled: true,
                severity: 'critical',
                threshold: 0.1
              }
            ],
            notification_channels: []
          })
        })
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Alert rule created successfully'
          })
        })
      }
    })

    await page.goto('/admin?tab=alerts')
    
    // Verify alerts tab is active
    await expect(page.locator('[data-testid="alerts-tab"]')).toHaveClass(/active/)
    
    // Check existing alert rules
    await expect(page.locator('[data-testid="alert-rule"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="alert-rule"]').first()).toContainText('High Error Rate')
    
    // Test creating new alert rule
    await page.click('[data-testid="create-alert-rule-button"]')
    await page.fill('[data-testid="rule-name-input"]', 'Test Alert')
    await page.selectOption('[data-testid="severity-select"]', 'warning')
    await page.fill('[data-testid="threshold-input"]', '50')
    
    await page.click('[data-testid="save-alert-rule-button"]')
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Alert rule created')
  })
})

// Test utilities for E2E tests
test.beforeAll(async () => {
  // Set up test data or reset database state if needed
  console.log('Setting up E2E test environment')
})

test.afterAll(async () => {
  // Clean up test data
  console.log('Cleaning up E2E test environment')
})