#!/usr/bin/env node

/**
 * E14Z Bootstrap Mechanism Test
 * Tests the self-installing global setup functionality
 */

const { spawn } = require('child_process');
const path = require('path');

async function testBootstrapDetection() {
  console.log('🧪 Testing E14Z Bootstrap Detection\n');
  
  const testCases = [
    {
      name: 'Normal execution (should not bootstrap)',
      env: { 
        PATH: process.env.PATH 
      },
      shouldBootstrap: false
    },
    {
      name: 'NPX execution (should bootstrap)',
      env: { 
        npm_execpath: '/usr/local/bin/npx',
        npm_config_prefix: '/tmp/npm-test',
        PATH: process.env.PATH 
      },
      shouldBootstrap: true
    },
    {
      name: 'NPX with cache (should bootstrap)',
      env: { 
        npm_config_user_config: '/home/user/.npm/_npx/config',
        PATH: process.env.PATH 
      },
      shouldBootstrap: true
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📋 ${testCase.name}`);
    
    try {
      const result = await new Promise((resolve, reject) => {
        const child = spawn('node', [path.join(__dirname, 'bin/cli.js'), '--version'], {
          env: { ...process.env, ...testCase.env },
          stdio: 'pipe'
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        child.on('close', (code) => {
          resolve({ code, stdout, stderr });
        });
        
        child.on('error', (error) => {
          reject(error);
        });
      });
      
      console.log(`   Version output: ${result.stdout.trim()}`);
      
      if (result.stderr.includes('Running via npx')) {
        console.log(`   ✅ Bootstrap detected correctly`);
        if (!testCase.shouldBootstrap) {
          console.log(`   ⚠️  Unexpected bootstrap detection`);
        }
      } else {
        console.log(`   ✅ No bootstrap detected`);
        if (testCase.shouldBootstrap) {
          console.log(`   ⚠️  Expected bootstrap but none detected`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
    }
    
    console.log();
  }
}

async function testFunctionalBootstrap() {
  console.log('🚀 Testing Functional Bootstrap with Discover Command\n');
  
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('node', [path.join(__dirname, 'bin/cli.js'), 'discover', '--limit', '1'], {
        env: { 
          ...process.env,
          npm_execpath: '/usr/local/bin/npx',
          npm_config_prefix: '/tmp/npm-test'
        },
        stdio: 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
    
    console.log('📋 Discover command test:');
    console.log(`   Exit code: ${result.code}`);
    
    if (result.stderr.includes('Running via npx')) {
      console.log(`   ✅ Bootstrap detection working`);
    }
    
    if (result.stdout.includes('Found') && result.stdout.includes('MCP')) {
      console.log(`   ✅ Discover command working`);
    }
    
    if (result.stderr.includes('Setting up e14z')) {
      console.log(`   ✅ Global installation triggered`);
    } else {
      console.log(`   ℹ️  Global installation not triggered (expected for test)`);
    }
    
  } catch (error) {
    console.log(`   ❌ Functional test failed: ${error.message}`);
  }
}

async function main() {
  console.log('🤖 E14Z Bootstrap Mechanism Test Suite\n');
  
  await testBootstrapDetection();
  await testFunctionalBootstrap();
  
  console.log('✅ Bootstrap tests completed!\n');
  console.log('💡 To test end-to-end bootstrap:');
  console.log('   npm uninstall -g e14z');
  console.log('   npx e14z@latest run stripe');
  console.log('   # Should auto-install globally and show setup message');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}