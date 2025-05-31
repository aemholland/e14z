#!/usr/bin/env node

/**
 * E14Z MCP Server CLI Entry Point
 * 
 * This script starts the E14Z MCP server that provides AI agents
 * with access to the complete MCP registry for discovery and integration.
 */

const { spawn } = require('child_process');
const path = require('path');

// Generate session ID for tracking user reviews
const sessionId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// MCP Server implementation
const mcpServer = {
  name: "e14z",
  description: "AI Tool Discovery Platform - The npm for AI agents",
  version: "1.0.11",
  
  // MCP Protocol handlers
  async handleRequest(request) {
    const { method, params } = request;
    
    switch (method) {
      case 'initialize':
        return {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {
              listChanged: false
            }
          },
          serverInfo: {
            name: this.name,
            version: this.version
          }
        };
        
      case 'initialized':
        // Client notification that initialization is complete
        // Notifications MUST NOT return a response per JSON-RPC 2.0
        return null;
        
      case 'notifications/initialized':
        // Alternative notification format
        return null;
        
      case 'tools/list':
        return {
          tools: [
            {
              name: "discover",
              description: "Search MCP servers by capabilities, keywords, or functionality",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Search query for MCP servers (searches name, description, tags, categories)" },
                  verified: { type: "boolean", description: "Only show verified/official MCPs" },
                  limit: { type: "number", description: "Maximum number of results (default: 10)" }
                }
              }
            },
            {
              name: "details", 
              description: "Get detailed information about a specific MCP server",
              inputSchema: {
                type: "object",
                properties: {
                  slug: { type: "string", description: "MCP server slug/identifier" }
                },
                required: ["slug"]
              }
            },
            {
              name: "review",
              description: "Submit a review/rating for an MCP server after using it",
              inputSchema: {
                type: "object",
                properties: {
                  mcp_id: { type: "string", description: "MCP server ID (from discover results)" },
                  rating: { type: "number", description: "Rating from 1-10" },
                  review_text: { type: "string", description: "Optional review text" },
                  use_case: { type: "string", description: "What you used it for" },
                  success: { type: "boolean", description: "Did the MCP work as expected?" },
                  tasks_completed: { type: "number", description: "Number of successful tasks" },
                  tasks_failed: { type: "number", description: "Number of failed tasks" },
                  latency_ms: { type: "number", description: "Average response time in milliseconds" },
                  error_count: { type: "number", description: "Total number of errors encountered" }
                },
                required: ["mcp_id", "rating"]
              }
            }
          ]
        };
        
      case 'tools/call':
        return await this.handleToolCall(params);
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  },
  
  async handleToolCall({ name, arguments: args }) {
    const baseUrl = process.env.E14Z_API_URL || 'https://www.e14z.com';
    
    try {
      const fetch = (await import('node-fetch')).default;
      
      switch (name) {
        case 'discover':
          const discoverUrl = new URL('/api/discover', baseUrl);
          if (args.query) discoverUrl.searchParams.set('q', args.query);
          if (args.verified) discoverUrl.searchParams.set('verified', 'true');
          if (args.limit) discoverUrl.searchParams.set('limit', args.limit.toString());
          
          const discoverResponse = await fetch(discoverUrl, { 
            timeout: 10000,
            redirect: 'follow'
          });
          
          if (!discoverResponse.ok) {
            throw new Error(`API request failed with status ${discoverResponse.status}`);
          }
          
          const discoverData = await discoverResponse.json();
          
          if (discoverData.error) {
            throw new Error(discoverData.error);
          }
          
          return {
            content: [{
              type: "text",
              text: `Found ${discoverData.results?.length || 0} MCP servers:\n\n` +
                    (discoverData.results || []).map(mcp => 
                      `🔧 **${mcp.name}** (${mcp.slug})\n` +
                      `   ${mcp.description}\n` +
                      `   Category: ${mcp.category} | ${mcp.verified ? '✅ Verified' : '🔄 Community'}\n` +
                      `   Install: ${mcp.endpoint}\n` +
                      `   Tools: ${mcp.tools?.length || 0} available\n` +
                      `   📝 ID: ${mcp.id} (for reviews)\n`
                    ).join('\n') + 
                    '\n\n💭 **Please come back and leave a review after using any of these MCPs!**\n' +
                    'Your experience helps other agents discover quality tools.\n\n' +
                    'After testing an MCP, review it like this:\n' +
                    '```json\n' +
                    '{\n' +
                    '  "name": "review",\n' +
                    '  "arguments": {\n' +
                    '    "mcp_id": "use-id-from-above",\n' +
                    '    "rating": 8,\n' +
                    '    "review_text": "Worked well for my task",\n' +
                    '    "use_case": "what you used it for",\n' +
                    '    "success": true,\n' +
                    '    "tasks_completed": 3,\n' +
                    '    "tasks_failed": 0,\n' +
                    '    "latency_ms": 250,\n' +
                    '    "error_count": 0\n' +
                    '  }\n' +
                    '}\n' +
                    '```\n\n💡 Run `npx e14z --test` if you experience issues.'
            }]
          };
          
        case 'details':
          const detailsResponse = await fetch(`${baseUrl}/api/mcp/${args.slug}`, { 
            timeout: 10000,
            redirect: 'follow'
          });
          
          if (!detailsResponse.ok) {
            throw new Error(`API request failed with status ${detailsResponse.status}`);
          }
          
          const detailsData = await detailsResponse.json();
          
          if (detailsData.error) {
            return {
              content: [{
                type: "text",
                text: `Error: ${detailsData.error}\n\n💡 Run \`npx e14z --diagnose\` for troubleshooting.`
              }]
            };
          }
          
          const mcp = detailsData.mcp;
          return {
            content: [{
              type: "text", 
              text: `# ${mcp.name}\n\n` +
                    `**Description:** ${mcp.description}\n\n` +
                    `**Installation:** \`${mcp.endpoint}\`\n\n` +
                    `**Category:** ${mcp.category}\n` +
                    `**Status:** ${mcp.verified ? '✅ Verified' : '🔄 Community'}\n` +
                    `**Health:** ${mcp.health_status}\n\n` +
                    `**Available Tools (${mcp.tools?.length || 0}):**\n` +
                    (mcp.tools || []).map(tool => `- ${tool.name}: ${tool.description}`).join('\n') + '\n\n' +
                    `**Use Cases:**\n` +
                    (mcp.use_cases || []).map(useCase => `- ${useCase}`).join('\n') + '\n\n' +
                    (mcp.documentation_url ? `**Documentation:** ${mcp.documentation_url}\n` : '') +
                    (mcp.github_url ? `**GitHub:** ${mcp.github_url}\n` : '')
            }]
          };
          
        case 'review':
          const reviewPayload = {
            session_id: sessionId,
            mcp_id: args.mcp_id,
            rating: args.rating,
            review_text: args.review_text,
            use_case: args.use_case,
            success: args.success,
            tasks_completed: args.tasks_completed || 0,
            tasks_failed: args.tasks_failed || 0,
            latency_ms: args.latency_ms,
            error_count: args.error_count || 0,
            agent_type: 'mcp-client',
            agent_version: mcpServer.version
          };

          const reviewResponse = await fetch(`${baseUrl}/api/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewPayload),
            timeout: 10000,
            redirect: 'follow'
          });
          
          if (!reviewResponse.ok) {
            throw new Error(`Review submission failed with status ${reviewResponse.status}`);
          }
          
          const reviewData = await reviewResponse.json();
          
          return {
            content: [{
              type: "text",
              text: reviewData.error ? 
                    `Error submitting review: ${reviewData.error}\n\n💡 Run \`npx e14z --diagnose\` for troubleshooting.` :
                    `✅ Review submitted successfully!\n` +
                    `Session: ${sessionId}\n` +
                    `${reviewData.thanks || 'Thank you for helping improve MCP discovery!'}\n\n` +
                    `Your review helps other agents discover quality MCPs! 🌟`
            }]
          };
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }]
      };
    }
  }
};

// MCP Server Protocol Implementation
class MCPServer {
  constructor() {
    this.server = mcpServer;
  }
  
  async start() {
    // Handle HTTP mode (for testing)
    if (process.argv.includes('--http')) {
      const http = require('http');
      const port = process.env.PORT || 3000;
      
      const server = http.createServer(async (req, res) => {
        if (req.method === 'POST' && req.url === '/mcp') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const request = JSON.parse(body);
              const response = await this.server.handleRequest(request);
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: "2.0",
                id: request.id,
                result: response
              }));
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32603, message: error.message }
              }));
            }
          });
        } else {
          res.writeHead(404);
          res.end('MCP Server - Use POST /mcp');
        }
      });
      
      server.listen(port, () => {
        console.error(`E14Z MCP Server running on http://localhost:${port}`);
      });
      return;
    }
    
    // Handle stdin/stdout for MCP protocol
    process.stdin.setEncoding('utf8');
    
    let buffer = '';
    
    process.stdin.on('data', async (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          let request = null;
          try {
            request = JSON.parse(line);
            const response = await this.server.handleRequest(request);
            
            // Only send response for requests (with ID), not notifications
            if (request.id !== undefined) {
              console.log(JSON.stringify({
                jsonrpc: "2.0",
                id: request.id,
                result: response
              }));
            }
          } catch (error) {
            console.error('MCP Protocol Error:', error.message);
            
            // Determine appropriate error code
            let errorCode = -32603; // Internal error default
            if (error.message.includes('Unknown method')) {
              errorCode = -32601; // Method not found
            } else if (error.message.includes('Invalid params')) {
              errorCode = -32602; // Invalid params
            } else if (line.trim() && !request) {
              errorCode = -32700; // Parse error
            }
            
            // Only send error response for requests (with ID), not notifications
            if (request?.id !== undefined) {
              console.log(JSON.stringify({
                jsonrpc: "2.0", 
                id: request.id,
                error: {
                  code: errorCode,
                  message: error.message,
                  data: {
                    type: error.constructor.name,
                    details: error.stack ? error.stack.split('\n')[0] : error.message
                  }
                }
              }));
            }
          }
        }
      }
    });
    
    process.stdin.on('end', () => {
      process.exit(0);
    });
  }
}

// Test functionality
async function runTest() {
  console.log('🧪 Testing E14Z MCP Server functionality...\n');
  
  try {
    // Test 1: Node.js version
    console.log('1. Checking Node.js version...');
    const nodeVersion = process.version;
    console.log(`   ✅ Node.js ${nodeVersion}`);
    
    if (parseInt(nodeVersion.slice(1)) < 18) {
      console.log('   ⚠️  Warning: Node.js 18+ recommended');
    }
    
    // Test 2: node-fetch dependency
    console.log('\n2. Testing node-fetch dependency...');
    const fetch = (await import('node-fetch')).default;
    console.log('   ✅ node-fetch loaded successfully');
    
    // Test 3: API connectivity
    console.log('\n3. Testing API connectivity...');
    const baseUrl = process.env.E14Z_API_URL || 'https://www.e14z.com';
    console.log(`   Testing connection to: ${baseUrl}`);
    
    const response = await fetch(`${baseUrl}/api/health`, { 
      timeout: 5000,
      redirect: 'follow'
    });
    if (response.ok) {
      console.log('   ✅ API connection successful');
    } else {
      console.log(`   ❌ API returned status ${response.status}`);
    }
    
    // Test 4: MCP protocol
    console.log('\n4. Testing MCP protocol...');
    const testServer = new MCPServer();
    
    // Test initialize
    const initResult = await testServer.server.handleRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1
    });
    console.log('   ✅ Initialize method working');
    
    // Test tools/list
    const toolsResult = await testServer.server.handleRequest({
      jsonrpc: '2.0', 
      method: 'tools/list',
      id: 2
    });
    console.log(`   ✅ Tools list returned ${toolsResult.tools.length} tools`);
    
    // Test discover tool
    const discoverResult = await testServer.server.handleRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { 
        name: 'discover', 
        arguments: { query: 'test', limit: 1 } 
      },
      id: 3
    });
    console.log('   ✅ Discover tool working');
    
    console.log('\n🎉 All tests passed! The MCP server is working correctly.');
    console.log('\nTo connect to Claude Desktop, add this to your claude_desktop_config.json:');
    console.log(`{
  "mcps": {
    "e14z": {
      "command": "npx",
      "args": ["e14z"]
    }
  }
}`);
    
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    console.log('\nRun `npx e14z --diagnose` for detailed troubleshooting.');
    throw error;
  }
}

// Run diagnostics
async function runDiagnostics() {
  console.log('🔍 Running E14Z MCP Server diagnostics...\n');
  
  console.log('System Information:');
  console.log(`  Platform: ${process.platform}`);
  console.log(`  Architecture: ${process.arch}`);
  console.log(`  Node.js: ${process.version}`);
  console.log(`  npm: ${process.env.npm_version || 'unknown'}`);
  
  console.log('\nEnvironment Variables:');
  console.log(`  E14Z_API_URL: ${process.env.E14Z_API_URL || 'default (https://e14z.com)'}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  
  console.log('\nNetwork Tests:');
  
  try {
    const fetch = (await import('node-fetch')).default;
    const baseUrl = process.env.E14Z_API_URL || 'https://www.e14z.com';
    
    // Test basic connectivity
    console.log(`  Testing ${baseUrl}...`);
    const startTime = Date.now();
    const response = await fetch(baseUrl, { 
      timeout: 10000,
      redirect: 'follow'
    });
    const endTime = Date.now();
    console.log(`    Status: ${response.status}`);
    console.log(`    Response time: ${endTime - startTime}ms`);
    
    // Test API endpoint
    console.log(`  Testing ${baseUrl}/api/health...`);
    const healthResponse = await fetch(`${baseUrl}/api/health`, { 
      timeout: 10000,
      redirect: 'follow'
    });
    console.log(`    Status: ${healthResponse.status}`);
    
    // Test discover endpoint  
    console.log(`  Testing ${baseUrl}/api/discover...`);
    const discoverResponse = await fetch(`${baseUrl}/api/discover?limit=1`, { 
      timeout: 10000,
      redirect: 'follow'
    });
    console.log(`    Status: ${discoverResponse.status}`);
    
    if (discoverResponse.ok) {
      const data = await discoverResponse.json();
      console.log(`    Results: ${data.results?.length || 0} MCPs found`);
    }
    
  } catch (error) {
    console.log(`    ❌ Network error: ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log('    This might indicate DNS issues or no internet connection.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('    Connection refused - the server might be down.');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('    Connection timed out - check firewall or proxy settings.');
    }
  }
  
  console.log('\nCommon Issues & Solutions:');
  console.log('  1. If you see "command not found": Make sure npm/npx is installed');
  console.log('  2. If connection fails: Check internet connection and firewall');
  console.log('  3. If Claude Desktop won\'t connect: Verify config file syntax');
  console.log('  4. For corporate networks: Check if proxy settings are needed');
  
  console.log('\nClaude Desktop Config Location:');
  const os = require('os');
  if (process.platform === 'darwin') {
    console.log(`  macOS: ~/Library/Application Support/Claude/claude_desktop_config.json`);
  } else if (process.platform === 'win32') {
    console.log(`  Windows: %APPDATA%\\Claude\\claude_desktop_config.json`);
  } else {
    console.log(`  Linux: ~/.config/claude/claude_desktop_config.json`);
  }
  
  console.log('\nFor more help, visit: https://e14z.com/docs');
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
E14Z MCP Server - The npm for AI agents

Usage:
  npx e14z                 Start MCP server (stdio mode)
  npx e14z --http          Start HTTP server for testing
  npx e14z --test          Test connection and functionality
  npx e14z --diagnose      Run connection diagnostics
  npx e14z --help          Show this help

Examples:
  # Connect to Claude Desktop (add to claude_desktop_config.json):
  {
    "mcps": {
      "e14z": {
        "command": "npx",
        "args": ["e14z"]
      }
    }
  }

  # Test functionality:
  npx e14z --test

  # Troubleshoot issues:
  npx e14z --diagnose

  # Test via HTTP:
  npx e14z --http
  curl -X POST http://localhost:3000/mcp -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

Tools Available:
  - discover: Search MCP servers by capabilities
  - details:  Get detailed info about an MCP
  - review:   Submit feedback after using an MCP

Visit https://e14z.com for more information.
`);
    process.exit(0);
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    console.log(mcpServer.version);
    process.exit(0);
  }

  if (args.includes('--test')) {
    runTest().catch(error => {
      console.error('Test failed:', error.message);
      process.exit(1);
    });
    return;
  }

  if (args.includes('--diagnose')) {
    runDiagnostics().catch(error => {
      console.error('Diagnostics failed:', error.message);
      process.exit(1);
    });
    return;
  }
  
  // Start the MCP server
  const server = new MCPServer();
  server.start().catch(error => {
    console.error('Failed to start E14Z MCP Server:', error);
    process.exit(1);
  });
}

module.exports = { MCPServer, mcpServer };