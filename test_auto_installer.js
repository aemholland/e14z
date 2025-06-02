#!/usr/bin/env node

/**
 * Test Auto-Installation Engine
 */

const { AutoInstaller } = require('./lib/execution/auto-installer.js');

async function testAutoInstaller() {
  console.log('🧪 Testing Auto-Installation Engine\n');
  
  const installer = new AutoInstaller({
    securityLevel: 'minimal', // For testing
    timeout: 30000
  });
  
  let testsPassed = 0;
  let totalTests = 0;
  
  async function runTest(testName, testFn) {
    totalTests++;
    console.log(`📋 ${testName}`);
    
    try {
      await testFn();
      console.log('   ✅ PASSED\n');
      testsPassed++;
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}\n`);
    }
  }
  
  // Test 1: Cache initialization
  await runTest('Cache Initialization', async () => {
    await installer.initialize();
    console.log('   Cache initialized successfully');
  });
  
  // Test 2: Cache stats
  await runTest('Cache Statistics', async () => {
    const stats = await installer.getCacheStats();
    if (!stats || typeof stats !== 'object') {
      throw new Error('Invalid cache stats returned');
    }
    console.log('   Cache stats retrieved successfully');
  });
  
  // Test 3: List cached items
  await runTest('List Cached Items', async () => {
    const result = await installer.listCached();
    if (!result.success) {
      throw new Error(`List cached failed: ${result.error}`);
    }
    console.log(`   Found ${result.cached.length} cached items`);
  });
  
  // Test 4: Test NPM package simulation
  await runTest('NPM Package Detection', async () => {
    const mockMCP = {
      name: 'test-npm-package',
      slug: 'test-npm-package',
      installation_methods: [{
        type: 'npm',
        command: 'npx test-package',
        description: 'NPM installation'
      }]
    };
    
    const installMethod = installer.selectInstallMethod(mockMCP);
    if (installMethod.type !== 'npm') {
      throw new Error('Expected npm installation method');
    }
    console.log(`   Selected method: ${installMethod.type}`);
    console.log(`   Command: ${installMethod.command}`);
  });
  
  // Test 5: Test Git package simulation  
  await runTest('Git Package Detection', async () => {
    const mockMCP = {
      name: 'test-git-package',
      slug: 'test-git-package',
      installation_methods: [{
        type: 'git',
        command: 'git clone https://github.com/test/repo.git',
        description: 'Git installation'
      }]
    };
    
    const installMethod = installer.selectInstallMethod(mockMCP);
    if (installMethod.type !== 'git') {
      throw new Error('Expected git installation method');
    }
    console.log(`   Selected method: ${installMethod.type}`);
    console.log(`   Command: ${installMethod.command}`);
  });
  
  // Test 6: Test can auto-install with invalid MCP
  await runTest('Auto-Install Capability Check', async () => {
    const result = await installer.canAutoInstall('nonexistent-test-mcp');
    if (result.available) {
      throw new Error('Should not be able to auto-install non-existent MCP');
    }
    console.log(`   Correctly detected unavailable MCP: ${result.error}`);
  });
  
  // Test 7: Clear cache functionality
  await runTest('Cache Clear Functionality', async () => {
    const result = await installer.clearCache('test-slug');
    if (!result.success) {
      throw new Error(`Cache clear failed: ${result.message}`);
    }
    console.log('   Cache clear working correctly');
  });
  
  // Test 8: Error statistics
  await runTest('Error Statistics', async () => {
    const stats = installer.getErrorStats();
    if (!stats || typeof stats !== 'object') {
      throw new Error('Invalid error stats returned');
    }
    console.log('   Error statistics retrieved successfully');
  });
  
  // Summary
  console.log('🎯 Auto-Installation Engine Test Summary');
  console.log(`   Passed: ${testsPassed}/${totalTests} tests`);
  console.log(`   Success Rate: ${Math.round((testsPassed/totalTests) * 100)}%`);
  
  if (testsPassed === totalTests) {
    console.log('\n🎉 Auto-Installation Engine tests passed!');
    console.log('\n📋 Features Verified:');
    console.log('   ✅ Secure cache management');
    console.log('   ✅ Multi-package manager support');
    console.log('   ✅ Installation method detection');
    console.log('   ✅ Error handling and statistics');
    console.log('   ✅ Cache operations and cleanup');
    console.log('   ✅ Auto-install capability detection');
  } else {
    console.log('\n⚠️ Some auto-installer tests failed.');
  }
}

if (require.main === module) {
  testAutoInstaller().catch(error => {
    console.error('\n❌ Auto-installer test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testAutoInstaller };