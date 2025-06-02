/**
 * Playwright Configuration for E14Z Testing (2025 Best Practices)
 * Comprehensive end-to-end testing setup with modern browser support
 */
import { defineConfig, devices } from '@playwright/test'
import path from 'path'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Global test timeout
  timeout: 30000,
  
  // Global setup and teardown
  globalSetup: require.resolve('./tests/setup/global-setup.ts'),
  globalTeardown: require.resolve('./tests/setup/global-teardown.ts'),
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI for stability
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration for multiple output formats
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Global test configuration
  use: {
    // Base URL for the application
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Ignore HTTPS errors in test environment
    ignoreHTTPSErrors: true,
    
    // Context options for better testing
    extraHTTPHeaders: {
      'X-Test-Environment': 'playwright',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    
    // Test fixtures and utilities
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:3000',
          localStorage: [
            {
              name: 'e14z-test-mode',
              value: 'true'
            }
          ]
        }
      ]
    }
  },
  
  // Project configurations for different browsers and scenarios
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    
    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
    },
    
    // Tablet devices
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
      dependencies: ['setup'],
    },
    
    // Authentication scenarios
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/auth/authenticated.json'
      },
      dependencies: ['setup'],
      testMatch: /.*auth.*\.test\.ts/
    },
    
    // Admin scenarios
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/auth/admin.json'
      },
      dependencies: ['setup'],
      testMatch: /.*admin.*\.test\.ts/
    },
    
    // Performance testing
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        trace: 'on',
        video: 'on'
      },
      dependencies: ['setup'],
      testMatch: /.*performance.*\.test\.ts/
    },
    
    // API testing
    {
      name: 'api',
      use: {
        // Use request context for API testing
        baseURL: process.env.API_BASE_URL || 'http://localhost:3000/api',
      },
      testMatch: /.*api.*\.test\.ts/
    }
  ],
  
  // Web server configuration for development testing
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe'
  },
  
  // Test output directory
  outputDir: 'test-results/',
  
  // Expect configuration
  expect: {
    // Maximum time expect() should wait for the condition to be met
    timeout: 10000,
    
    // Custom matchers timeout
    toHaveScreenshot: {
      threshold: 0.3,
      maxDiffPixels: 100
    },
    
    toMatchSnapshot: {
      threshold: 0.3
    }
  },
  
  // Test metadata
  metadata: {
    'test-environment': process.env.NODE_ENV || 'test',
    'app-version': process.env.npm_package_version || '1.0.0',
    'test-suite': 'E14Z MCP Registry E2E Tests'
  }
})