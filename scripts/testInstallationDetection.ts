#!/usr/bin/env node

/**
 * Test Installation Detection
 * 
 * Tests the installation method detection with various README examples
 */

import { detectInstallationMethod, extractInstallationFromSection, cleanInstallationCommand } from '../lib/mcp/installationDetector'

// Test cases with different installation methods
const testCases = [
  {
    name: 'NPM Package',
    content: `
# Installation

\`\`\`bash
npx @stripe/mcp --api-key=your_key
\`\`\`
    `,
    expected: 'npm'
  },
  {
    name: 'Docker Container',
    content: `
## Getting Started

Run the MCP server with Docker:

\`\`\`bash
docker run -p 3000:3000 -e API_KEY=your_key mcphub/postgres-mcp
\`\`\`
    `,
    expected: 'docker'
  },
  {
    name: 'Git Clone + Python',
    content: `
# Setup

1. Clone the repository
\`\`\`bash
git clone https://github.com/user/repo
cd repo
pip install -r requirements.txt
python server.py
\`\`\`
    `,
    expected: 'git'
  },
  {
    name: 'Python UV',
    content: `
# Installation

\`\`\`bash
uvx elevenlabs-mcp
\`\`\`
    `,
    expected: 'pip'
  },
  {
    name: 'Binary Download',
    content: `
# Quick Install

\`\`\`bash
curl -L https://example.com/install.sh | sh
\`\`\`
    `,
    expected: 'binary'
  },
  {
    name: 'Complex Git Setup',
    content: `
## Installation

\`\`\`bash
git clone https://github.com/box-community/mcp-server-box
cd mcp-server-box
npm install
npm run build
node dist/server.js
\`\`\`
    `,
    expected: 'git'
  }
]

async function main() {
  console.log('🧪 Testing Installation Detection\n')

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`)
    
    const result = extractInstallationFromSection(testCase.content, 'https://github.com/test/repo')
    const cleanedCommand = cleanInstallationCommand(result.endpoint, result.install_type)
    
    console.log(`  Detected: ${result.install_type} (confidence: ${result.confidence})`)
    console.log(`  Command: ${cleanedCommand}`)
    
    if (result.install_type === testCase.expected) {
      console.log('  ✅ PASSED\n')
      passed++
    } else {
      console.log(`  ❌ FAILED - Expected ${testCase.expected}, got ${result.install_type}\n`)
      failed++
    }
  }

  console.log('📊 Test Results:')
  console.log(`  ✅ Passed: ${passed}`)
  console.log(`  ❌ Failed: ${failed}`)
  console.log(`  📈 Success Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`)

  // Test edge cases
  console.log('\n🔍 Testing Edge Cases:')
  
  // Empty content
  const emptyResult = detectInstallationMethod('', 'https://github.com/test/repo')
  console.log(`Empty content: ${emptyResult.install_type} - ${emptyResult.endpoint}`)
  
  // No GitHub URL
  const noUrlResult = detectInstallationMethod('npm install something')
  console.log(`No GitHub URL: ${noUrlResult.install_type} - ${noUrlResult.endpoint}`)
  
  // Multiple patterns
  const multipleResult = detectInstallationMethod(`
    npm install
    docker run something
    git clone repo
  `, 'https://github.com/test/repo')
  console.log(`Multiple patterns: ${multipleResult.install_type} - ${multipleResult.endpoint}`)

  console.log('\n✅ Installation detection testing completed!')
}

// Run if called directly
main().catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})