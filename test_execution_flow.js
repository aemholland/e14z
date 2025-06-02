#!/usr/bin/env node

/**
 * Test the execution flow specifically
 */

const { AutoInstaller } = require('./lib/execution/auto-installer.js');

async function testExecutionFlow() {
  console.log('🧪 Testing Auto-Installation Execution Flow\n');
  
  const installer = new AutoInstaller({
    securityLevel: 'minimal',
    timeout: 30000
  });
  
  try {
    await installer.initialize();
    
    // Get MCP details
    const mcp = await installer.getMCPDetails('notion');
    const installMethod = installer.selectInstallMethod(mcp);
    const packageManager = installer.packageFactory.getManager(mcp, installMethod);
    const packageInfo = packageManager.parseInstallCommand(installMethod);
    
    console.log('🔄 Testing package manager findExecutable...');
    
    // Get cache location
    const cacheLocation = installer.cacheManager.getCacheLocation('notion', packageInfo.version);
    console.log(`   Cache location: ${cacheLocation.packageDir}`);
    
    // Test findExecutable
    const execCommand = await packageManager.findExecutable(packageInfo, cacheLocation.packageDir);
    
    if (execCommand) {
      console.log('✅ Executable found:');
      console.log(`   Command: ${execCommand.command}`);
      console.log(`   Args: ${JSON.stringify(execCommand.args)}`);
      console.log(`   Type: ${execCommand.type}`);
      console.log(`   Is MCP Server: ${execCommand.isMCPServer || false}`);
      console.log(`   Original Command: ${execCommand.originalCommand || 'none'}`);
    } else {
      console.log('❌ No executable found');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

if (require.main === module) {
  testExecutionFlow().catch(error => {
    console.error('Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testExecutionFlow };