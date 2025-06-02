#!/usr/bin/env node

/**
 * Test the simplified auto-installation system
 */

const { AutoInstaller } = require('./lib/execution/auto-installer.js');

async function testSimplifiedAutoInstaller() {
  console.log('🧪 Testing Simplified Auto-Installation System\n');
  
  const installer = new AutoInstaller({
    securityLevel: 'minimal',
    timeout: 30000
  });
  
  try {
    // Test 1: Get MCP details directly from API
    console.log('📋 Testing API response for Notion MCP...');
    const mcp = await installer.getMCPDetails('notion');
    
    console.log(`   Name: ${mcp.name}`);
    console.log(`   Slug: ${mcp.slug}`);
    console.log(`   Auto Install Command: ${mcp.auto_install_command || 'NOT FOUND'}`);
    console.log(`   Installation Methods: ${mcp.installation_methods ? mcp.installation_methods.length + ' methods' : 'none'}`);
    
    // Test 2: Test installation method selection
    console.log('\n📋 Testing installation method selection...');
    const installMethod = installer.selectInstallMethod(mcp);
    
    console.log(`   Type: ${installMethod.type}`);
    console.log(`   Command: ${installMethod.command}`);
    console.log(`   Description: ${installMethod.description}`);
    
    // Test 3: Test package manager selection and parsing
    console.log('\n📋 Testing package manager and parsing...');
    const packageManager = installer.packageFactory.getManager(mcp, installMethod);
    const packageInfo = packageManager.parseInstallCommand(installMethod);
    
    console.log(`   Package Manager: ${packageManager.type}`);
    console.log(`   Package Name: ${packageInfo.name}`);
    console.log(`   Package Version: ${packageInfo.version}`);
    console.log(`   Is NPX Command: ${packageInfo.isNpxCommand || false}`);
    console.log(`   Original Command: ${packageInfo.originalCommand || 'none'}`);
    
    console.log('\n✅ All parsing tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

if (require.main === module) {
  testSimplifiedAutoInstaller().catch(error => {
    console.error('Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testSimplifiedAutoInstaller };