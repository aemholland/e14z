/**
 * Vitest Configuration for E14Z Testing (2025 Best Practices)
 * Modern unit and integration testing setup
 */
import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Global setup and teardown
    globalSetup: ['tests/setup/vitest-global-setup.ts'],
    setupFiles: ['tests/setup/vitest-setup.ts'],
    
    // Enable globals for better DX
    globals: true,
    
    // Include source files for coverage
    includeSource: ['src/**/*.{js,ts,jsx,tsx}'],
    
    // Test file patterns
    include: [
      'tests/unit/**/*.test.{js,ts,jsx,tsx}',
      'tests/integration/**/*.test.{js,ts,jsx,tsx}'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      'tests/e2e/**/*',
      'tests/setup/**/*'
    ],
    
    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: 'test-results/coverage',
      include: [
        'app/**/*',
        'lib/**/*',
        'components/**/*'
      ],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts'
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80
        },
        // Stricter thresholds for critical modules
        './lib/analytics/**': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90
        },
        './lib/execution/**': {
          statements: 85,
          branches: 80,
          functions: 85,
          lines: 85
        }
      }
    },
    
    // Reporter configuration
    reporters: [
      'verbose',
      'json',
      'html'
    ],
    
    outputFile: {
      json: 'test-results/vitest-results.json',
      html: 'test-results/vitest-report.html'
    },
    
    // Pool configuration for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: process.env.CI ? 2 : undefined,
        useAtomics: true
      }
    },
    
    // Retry configuration
    retry: process.env.CI ? 2 : 0,
    
    // Watch configuration
    watch: false,
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    
    // Custom test utilities
    provide: {
      TEST_ENV: 'vitest',
      API_BASE_URL: 'http://localhost:3000/api',
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key'
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/app': path.resolve(__dirname, 'app'),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/components': path.resolve(__dirname, 'components'),
      '@/types': path.resolve(__dirname, 'types'),
      '@/tests': path.resolve(__dirname, 'tests')
    }
  },
  
  // Define configuration
  define: {
    'import.meta.vitest': undefined
  }
})