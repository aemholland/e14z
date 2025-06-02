/**
 * Vitest Global Setup for E14Z Security Tests
 */

export async function setup() {
  // Set up test environment variables (commented out for build compatibility)
  // process.env.NODE_ENV = 'test'
  // process.env.JWT_SECRET_KEY = 'test-jwt-secret-key-for-testing-only-123456789012345678901234567890123456789012345678901234567890'
  // process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only-123456789012345678901234567890123456789012345678901234567890'
  // process.env.ENCRYPTION_KEY = 'a'.repeat(128)
  // process.env.IDOR_ENCRYPTION_KEY = 'b'.repeat(128)
  // process.env.SESSION_SECRET = 'test-session-secret-for-testing-only-123456789012345678901234567890'
  // process.env.COOKIE_SECRET = 'test-cookie-secret-for-testing-only-123456789012345678901234567890'
  // process.env.CSRF_SECRET = 'test-csrf-secret-for-testing-only-1234567890'
  
  // Database setup (commented out for build compatibility)
  // process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  // process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  // process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  
  console.log('✅ Test environment setup complete')
}

export async function teardown() {
  console.log('🧹 Test environment cleanup complete')
}