#!/usr/bin/env node

/**
 * Test the new slug generation logic
 */

// Standalone generateSlug function for testing
function generateSlug(name: string, author?: string, verified?: boolean): string {
  // Clean the base name
  let cleanName = name
    .replace(/\s+(Official|Community)$/i, '') // Remove Official/Community suffix
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens

  // For official MCPs, just return the clean name
  if (verified) {
    return cleanName
  }

  // For community MCPs, append author if available
  if (author) {
    const cleanAuthor = author
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens

    return `${cleanName}-${cleanAuthor}`
  }

  // Fallback to just the clean name
  return cleanName
}

// Test cases
const testCases = [
  // Official MCPs - should remove "Official" and use clean name
  { name: 'GitHub Official', author: 'github', verified: true, expected: 'github' },
  { name: 'Notion Official', author: 'notionhq', verified: true, expected: 'notion' },
  { name: 'Stripe Official', author: 'stripe', verified: true, expected: 'stripe' },
  
  // Community MCPs - should use name-author format
  { name: 'Slack Community', author: 'slack-user', verified: false, expected: 'slack-slack-user' },
  { name: 'Custom Tool', author: 'john-doe', verified: false, expected: 'custom-tool-john-doe' },
  { name: 'MongoDB Helper', author: 'mongo-team', verified: false, expected: 'mongodb-helper-mongo-team' },
  
  // Edge cases
  { name: 'Test Official', author: undefined, verified: true, expected: 'test' },
  { name: 'Test Community', author: undefined, verified: false, expected: 'test' },
  { name: 'Test@#$%^&*()Tool', author: 'test_user', verified: false, expected: 'testtool-testuser' },
]

function runTests() {
  console.log('🧪 Testing new slug generation logic\n')
  
  let passed = 0
  let failed = 0
  
  testCases.forEach((testCase, index) => {
    const result = generateSlug(testCase.name, testCase.author, testCase.verified)
    const success = result === testCase.expected
    
    if (success) {
      console.log(`✅ Test ${index + 1}: PASS`)
      console.log(`   ${testCase.name} (${testCase.verified ? 'official' : 'community'}) → ${result}`)
      passed++
    } else {
      console.log(`❌ Test ${index + 1}: FAIL`)
      console.log(`   ${testCase.name} (${testCase.verified ? 'official' : 'community'})`)
      console.log(`   Expected: ${testCase.expected}`)
      console.log(`   Got:      ${result}`)
      failed++
    }
    console.log('')
  })
  
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Slug generation is working correctly.')
  } else {
    console.log('❌ Some tests failed. Please check the logic.')
    process.exit(1)
  }
}

runTests()