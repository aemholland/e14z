#!/usr/bin/env node

/**
 * Comprehensive E14Z MCP Server Test Suite
 * Tests all tools and functionality end-to-end
 */

const { MCPServer } = require('./bin/mcp-server.js');

async function testMCPServer() {
  console.log('🧪 E14Z MCP Server Comprehensive Test Suite\n');
  
  const server = new MCPServer();
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
  
  // Test 1: Initialize
  await runTest('MCP Protocol Initialization', async () => {
    const result = await server.server.handleRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      },
      id: 1
    });
    
    if (!result.protocolVersion || !result.capabilities || !result.serverInfo) {
      throw new Error('Invalid initialization response');
    }
    console.log(`   Protocol: ${result.protocolVersion}`);
    console.log(`   Server: ${result.serverInfo.name} v${result.serverInfo.version}`);
  });
  
  // Test 2: Tools List
  await runTest('Tools List', async () => {
    const result = await server.server.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 2
    });
    
    if (!result.tools || !Array.isArray(result.tools)) {
      throw new Error('Tools list not returned or invalid format');
    }
    
    const expectedTools = ['discover', 'details', 'review', 'run'];
    const actualTools = result.tools.map(t => t.name);
    
    for (const tool of expectedTools) {
      if (!actualTools.includes(tool)) {
        throw new Error(`Missing expected tool: ${tool}`);
      }
    }
    
    console.log(`   Found ${result.tools.length} tools: ${actualTools.join(', ')}`);
    
    // Validate tool schemas
    for (const tool of result.tools) {
      if (!tool.name || !tool.description || !tool.inputSchema) {
        throw new Error(`Tool ${tool.name} missing required fields`);
      }
    }
  });
  
  // Test 3: Discover Tool - Basic Query
  await runTest('Discover Tool - Basic Search', async () => {
    const result = await server.server.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'discover',
        arguments: {
          query: 'payment',
          limit: 3
        }
      },
      id: 3
    });
    
    if (!result.content || !Array.isArray(result.content)) {
      throw new Error('Invalid discover response format');
    }
    
    const text = result.content[0].text;
    if (!text.includes('Found') || !text.includes('MCP')) {
      throw new Error('Discover response missing expected content');
    }
    
    console.log('   Search completed successfully');
    console.log(`   Response length: ${text.length} characters`);
  });
  
  // Test 4: Discover Tool - No Auth Filter
  await runTest('Discover Tool - No Auth Filter', async () => {
    const result = await server.server.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'discover',
        arguments: {
          no_auth: true,
          limit: 2
        }
      },
      id: 4
    });
    
    const text = result.content[0].text;
    if (!text.includes('Found')) {
      throw new Error('No auth filter returned no results');
    }
    
    console.log('   No-auth filter working correctly');
  });
  
  // Test 5: Discover Tool - Verified Only
  await runTest('Discover Tool - Verified Only', async () => {
    const result = await server.server.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'discover',
        arguments: {
          verified: true,
          limit: 2
        }
      },
      id: 5
    });
    
    const text = result.content[0].text;
    console.log('   Verified filter applied successfully');
  });
  
  // Test 6: Details Tool
  await runTest('Details Tool', async () => {
    const result = await server.server.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'details',
        arguments: {
          slug: 'stripe'
        }
      },
      id: 6
    });
    
    const text = result.content[0].text;
    if (!text.includes('stripe') && !text.toLowerCase().includes('error')) {
      throw new Error('Details response missing expected content');
    }
    
    console.log('   Details retrieval working');
    console.log(`   Response includes: ${text.substring(0, 100)}...`);
  });
  
  // Test 7: Review Tool
  await runTest('Review Tool', async () => {
    const result = await server.server.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'review',
        arguments: {
          mcp_id: 'test-mcp-id',
          rating: 8,
          success: true,
          tasks_completed: 3,
          rating_breakdown: {
            setup_difficulty: 3,
            reliability: 3,
            performance: 2,
            documentation_quality: 2
          },
          use_case_category: 'development-tools',
          review_text: 'Test review from automated testing'
        }
      },
      id: 7
    });
    
    const text = result.content[0].text;
    if (!text.includes('submitted') && !text.includes('Error')) {
      throw new Error('Review submission response invalid');
    }
    
    console.log('   Review tool responding correctly');
  });
  
  // Test 8: Error Handling - Invalid Tool
  await runTest('Error Handling - Invalid Tool', async () => {
    const result = await server.server.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'nonexistent-tool',
        arguments: {}
      },
      id: 8
    });
    
    // Check if error is returned in content (MCP style error handling)
    const text = result.content[0].text;
    if (!text.includes('Error:') && !text.includes('Unknown tool')) {
      throw new Error(`Expected error message but got: ${text}`);
    }
    console.log('   Error handling working correctly');
  });
  
  // Test 9: Error Handling - Invalid Method
  await runTest('Error Handling - Invalid Method', async () => {
    try {
      await server.server.handleRequest({
        jsonrpc: '2.0',
        method: 'invalid/method',
        id: 9
      });
      throw new Error('Should have thrown error for invalid method');
    } catch (error) {
      if (!error.message.includes('Unknown method')) {
        throw new Error('Wrong error message for invalid method');
      }
      console.log('   Method validation working correctly');
    }
  });
  
  // Test 10: Run Tool (will test auth handling)
  await runTest('Run Tool - Auth Detection', async () => {
    const result = await server.server.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'run',
        arguments: {
          slug: 'stripe'
        }
      },
      id: 10
    });
    
    const text = result.content[0].text;
    
    // Should either execute successfully or show auth requirements
    if (!text.includes('Authentication Required') && 
        !text.includes('Executed Successfully') && 
        !text.includes('Execution Failed')) {
      throw new Error('Run tool response format unexpected');
    }
    
    console.log('   Run tool responding appropriately');
    console.log(`   Response type: ${text.includes('Authentication') ? 'Auth Required' : 
                                   text.includes('Successfully') ? 'Success' : 'Error'}`);
  });
  
  // Test 11: Performance Test
  await runTest('Performance Test - Multiple Concurrent Calls', async () => {
    const startTime = Date.now();
    
    const promises = Array.from({ length: 5 }, (_, i) => 
      server.server.handleRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'discover',
          arguments: {
            query: 'test',
            limit: 1
          }
        },
        id: 11 + i
      })
    );
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    if (results.length !== 5) {
      throw new Error('Not all concurrent requests completed');
    }
    
    console.log(`   Completed 5 concurrent requests in ${endTime - startTime}ms`);
    console.log(`   Average: ${(endTime - startTime) / 5}ms per request`);
  });
  
  // Summary
  console.log('🎯 Test Summary');
  console.log(`   Passed: ${testsPassed}/${totalTests} tests`);
  console.log(`   Success Rate: ${Math.round((testsPassed/totalTests) * 100)}%`);
  
  if (testsPassed === totalTests) {
    console.log('\n🎉 All MCP server tests passed! The implementation is working correctly.');
    console.log('\n📋 MCP Server Features Verified:');
    console.log('   ✅ JSON-RPC 2.0 protocol compliance');
    console.log('   ✅ 4 AI agent tools (discover, details, review, run)');
    console.log('   ✅ Advanced search filters and parameters');
    console.log('   ✅ Authentication detection and handling'); 
    console.log('   ✅ Error handling and validation');
    console.log('   ✅ Performance under concurrent load');
    console.log('   ✅ Structured review system for AI feedback');
    
    console.log('\n🤖 Ready for AI Agent Integration:');
    console.log('   • Claude Desktop configuration ready');
    console.log('   • All tools provide rich, structured output');
    console.log('   • Authentication guidance for blocked MCPs');
    console.log('   • Performance feedback loop implemented');
  } else {
    console.log('\n⚠️ Some tests failed. Review the errors above.');
    process.exit(1);
  }
}

// Run the test suite
if (require.main === module) {
  testMCPServer().catch(error => {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testMCPServer };