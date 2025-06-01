#!/usr/bin/env node

/**
 * Test Auto-Installation Engine
 * Demonstrates NPX-like functionality for E14Z
 */

const { EnhancedExecutionEngine } = require('./lib/execution/enhanced-engine');

async function testAutoInstall() {
  console.log('🧪 Testing E14Z Auto-Installation Engine\n');
  
  const engine = new EnhancedExecutionEngine({
    enableAutoInstall: true,
    apiUrl: 'http://localhost:3000' // Use local API for testing
  });
  
  // Test 1: Check if auto-install is available for an MCP
  console.log('1. Checking auto-install availability...');
  const canInstall = await engine.canAutoInstall('stripe');
  console.log('   Result:', canInstall);
  
  // Test 2: List cached MCPs (should be empty initially)
  console.log('\n2. Listing cached MCPs...');
  const cached = await engine.listCached();
  console.log('   Cached MCPs:', cached.cached?.length || 0);
  
  // Test 3: Try to execute an MCP (should trigger auto-install)
  console.log('\n3. Attempting to execute Stripe MCP...');
  console.log('   This should auto-install since stripe command is not available locally');
  
  try {
    const result = await engine.executeMCP('stripe', {
      timeout: 120000, // 2 minutes for installation
      env: {
        STRIPE_API_KEY: 'sk_test_fake_key_for_testing'
      }
    });
    
    console.log('   Execution result:', {
      success: result.success,
      command: result.command,
      cacheDir: result.cacheDir,
      error: result.error
    });
    
  } catch (error) {
    console.log('   Error:', error.message);
  }
  
  // Test 4: List cached MCPs again (should show installed MCP)
  console.log('\n4. Listing cached MCPs after installation...');
  const cachedAfter = await engine.listCached();
  console.log('   Cached MCPs:', cachedAfter.cached?.map(c => ({
    slug: c.slug,
    installed_at: c.installed_at,
    method: c.method?.type
  })) || []);
  
  // Test 5: Run the same MCP again (should use cache)
  console.log('\n5. Running cached MCP (should be faster)...');
  const startTime = Date.now();
  
  try {
    const result = await engine.executeMCP('stripe', {
      timeout: 30000, // Should be much faster from cache
      env: {
        STRIPE_API_KEY: 'sk_test_fake_key_for_testing'
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`   Cached execution took ${duration}ms`);
    console.log('   Success:', result.success);
    
  } catch (error) {
    console.log('   Error:', error.message);
  }
  
  console.log('\n✅ Auto-installation test complete!');
  console.log('\n💡 Key Benefits Demonstrated:');
  console.log('   - Automatic package installation');
  console.log('   - Intelligent caching');
  console.log('   - Faster subsequent executions');
  console.log('   - No manual dependency management');
}

// Utility function to test specific scenarios
async function testSpecificMCP(slug) {
  console.log(`\n🎯 Testing specific MCP: ${slug}`);
  
  const engine = new EnhancedExecutionEngine({
    enableAutoInstall: true,
    apiUrl: process.env.E14Z_API_URL || 'https://e14z.com'
  });
  
  const result = await engine.executeMCP(slug, {
    timeout: 60000,
    stdio: 'inherit' // Show installation progress
  });
  
  console.log('\nResult:', {
    success: result.success,
    command: result.command,
    exitCode: result.exitCode,
    error: result.error?.substring(0, 200) + (result.error?.length > 200 ? '...' : '')
  });
  
  return result;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    testAutoInstall().catch(console.error);
  } else if (args[0] === 'test' && args[1]) {
    testSpecificMCP(args[1]).catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node test_auto_install.js           # Run full test suite');
    console.log('  node test_auto_install.js test <slug>  # Test specific MCP');
  }
}