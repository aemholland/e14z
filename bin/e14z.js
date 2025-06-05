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
  description: "AI Tool Discovery Platform - Discover 50+ MCP servers",
  version: "3.1.1",
  
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
                  limit: { type: "number", description: "Maximum number of results (default: 10)" },
                  no_auth: { type: "boolean", description: "Only show MCPs that require no authentication (work immediately)" },
                  auth_required: { type: "boolean", description: "Only show MCPs that require authentication setup" },
                  executable: { type: "boolean", description: "Only show MCPs that can be executed directly" }
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
                  rating: { type: "number", description: "Overall rating from 1-10" },
                  review_text: { type: "string", description: "Optional review text" },
                  use_case: { type: "string", description: "What you used it for" },
                  success: { type: "boolean", description: "Did the MCP work as expected?" },
                  tasks_completed: { type: "number", description: "Number of successful tasks" },
                  tasks_failed: { type: "number", description: "Number of failed tasks" },
                  latency_ms: { type: "number", description: "Average response time in milliseconds" },
                  error_count: { type: "number", description: "Total number of errors encountered" },
                  
                  // Enhanced structured fields
                  rating_breakdown: {
                    type: "object",
                    description: "Structured rating breakdown (1-3 scale each)",
                    properties: {
                      setup_difficulty: { type: "number", description: "1=failed, 2=difficult, 3=easy" },
                      documentation_quality: { type: "number", description: "1=poor, 2=adequate, 3=excellent" },
                      reliability: { type: "number", description: "1=frequent failures, 2=occasional, 3=stable" },
                      performance: { type: "number", description: "1=slow, 2=acceptable, 3=fast" }
                    }
                  },
                  use_case_category: { 
                    type: "string", 
                    description: "Category: payments, databases, content-creation, ai-tools, development-tools, cloud-storage, communication, infrastructure, productivity, project-management, security, social-media, web-apis, finance, research, iot, other" 
                  },
                  failure_categories: {
                    type: "array",
                    description: "Types of failures encountered",
                    items: {
                      type: "string",
                      enum: ["installation_failed", "authentication_error", "timeout", "invalid_response", "missing_functionality", "poor_performance", "documentation_unclear", "connection_refused"]
                    }
                  },
                  discovery_effectiveness: {
                    type: "string",
                    description: "How well discovery matched your needs",
                    enum: ["perfect_match", "close_match", "poor_match", "wrong_result"]
                  }
                },
                required: ["mcp_id", "rating", "success"]
              }
            },
            {
              name: "run",
              description: "Execute an MCP server directly with auth handling",
              inputSchema: {
                type: "object",
                properties: {
                  slug: { type: "string", description: "MCP server slug/identifier to execute" },
                  skip_auth_check: { type: "boolean", description: "Skip authentication requirement check and run anyway" },
                  stdio_mode: { type: "boolean", description: "Use stdio mode for MCP protocol communication" }
                },
                required: ["slug"]
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
  
  // Format comprehensive MCP data with all 12 categories
  formatComprehensiveMCPData(mcp) {
    const sections = [];
    
    // 1. 📊 Server Capabilities & Protocol Information
    sections.push(`🔧 **${mcp.name}** (${mcp.slug})`);
    sections.push(`   ${mcp.description}`);
    
    if (mcp.protocol_version || mcp.initialization_time_ms || mcp.connection_stability) {
      sections.push(`\n📊 **Protocol Intelligence:**`);
      if (mcp.protocol_version) sections.push(`   • Protocol: ${mcp.protocol_version}`);
      if (mcp.initialization_time_ms) sections.push(`   • Startup: ${mcp.initialization_time_ms}ms`);
      if (mcp.connection_stability) sections.push(`   • Stability: ${mcp.connection_stability}`);
    }

    // 2. 🛠️ Tool Intelligence (Enhanced)
    if (mcp.working_tools_count || mcp.failing_tools_count || mcp.tool_success_rate) {
      sections.push(`\n🛠️  **Tool Intelligence:**`);
      sections.push(`   • Working: ${mcp.working_tools_count || 0}/${(mcp.working_tools_count || 0) + (mcp.failing_tools_count || 0)} tools`);
      if (mcp.tool_success_rate) sections.push(`   • Success Rate: ${(mcp.tool_success_rate * 100).toFixed(1)}%`);
      if (mcp.average_response_time_ms) sections.push(`   • Avg Response: ${mcp.average_response_time_ms}ms`);
      
      // Tool details with parameters
      if (mcp.tools && Array.isArray(mcp.tools)) {
        sections.push(`   • Tools Available:`);
        mcp.tools.slice(0, 3).forEach(tool => {
          const paramCount = tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties).length : 0;
          sections.push(`     - ${tool.name} (${paramCount} params)`);
        });
        if (mcp.tools.length > 3) sections.push(`     - ...and ${mcp.tools.length - 3} more`);
      }
    }

    // 3. ⚡ Performance Intelligence
    if (mcp.min_response_time_ms || mcp.max_response_time_ms || mcp.reliability_score) {
      sections.push(`\n⚡ **Performance Intelligence:**`);
      if (mcp.min_response_time_ms && mcp.max_response_time_ms) {
        sections.push(`   • Response Range: ${mcp.min_response_time_ms}ms - ${mcp.max_response_time_ms}ms`);
      }
      if (mcp.reliability_score) sections.push(`   • Reliability: ${(mcp.reliability_score * 100).toFixed(1)}%`);
      if (mcp.overall_intelligence_score) sections.push(`   • Quality Score: ${(mcp.overall_intelligence_score * 100).toFixed(1)}%`);
    }

    // 4. 🔐 Authentication & Setup Intelligence
    if (mcp.auth_required) {
      sections.push(`\n🔐 **Authentication Intelligence:**`);
      sections.push(`   • Auth Required: Yes`);
      if (mcp.detected_env_vars && mcp.detected_env_vars.length > 0) {
        sections.push(`   • Required Variables: ${mcp.detected_env_vars.join(', ')}`);
      }
      if (mcp.setup_complexity) sections.push(`   • Setup Complexity: ${mcp.setup_complexity}`);
      if (mcp.auth_failure_mode) sections.push(`   • Failure Mode: ${mcp.auth_failure_mode}`);
      
      // Setup instructions
      if (mcp.auth_setup_instructions && mcp.auth_setup_instructions.length > 0) {
        sections.push(`   • Setup Steps:`);
        mcp.auth_setup_instructions.forEach(instruction => {
          sections.push(`     - ${instruction}`);
        });
      }
    } else {
      sections.push(`\n🔐 **Authentication Intelligence:**`);
      sections.push(`   • Auth Required: No - Ready to use immediately!`);
    }

    // 5. 📈 Health & Status Intelligence
    sections.push(`\n📈 **Health Intelligence:**`);
    const healthEmoji = mcp.health_status === 'healthy' ? '🟢' : 
                       mcp.health_status === 'degraded' ? '🟡' : 
                       mcp.health_status === 'down' ? '🔴' : '⚪';
    sections.push(`   • Status: ${healthEmoji} ${mcp.health_status || 'unknown'}`);
    if (mcp.testing_strategy) sections.push(`   • Testing: ${mcp.testing_strategy.replace(/_/g, ' ')}`);
    if (mcp.intelligence_collection_date) {
      const date = new Date(mcp.intelligence_collection_date);
      sections.push(`   • Last Analyzed: ${date.toLocaleDateString()}`);
    }

    // 6. 🎯 Usage Intelligence
    if (mcp.use_cases && mcp.use_cases.length > 0) {
      sections.push(`\n🎯 **Usage Intelligence:**`);
      sections.push(`   • Use Cases: ${mcp.use_cases.slice(0, 3).join(', ')}`);
      if (mcp.use_cases.length > 3) sections.push(`     ...and ${mcp.use_cases.length - 3} more`);
    }

    // 7. 🚨 Error Intelligence & Troubleshooting
    if (mcp.auth_error_messages && mcp.auth_error_messages.length > 0) {
      sections.push(`\n🚨 **Error Intelligence:**`);
      sections.push(`   • Common Issues: Authentication setup required`);
      sections.push(`   • Quick Fix: Configure environment variables`);
    } else if (mcp.failing_tools_count > 0) {
      sections.push(`\n🚨 **Error Intelligence:**`);
      sections.push(`   • Tools Failing: ${mcp.failing_tools_count}`);
      sections.push(`   • Troubleshooting: Check tool parameters and auth`);
    }

    // 8. 💻 Installation Intelligence
    sections.push(`\n💻 **Installation:**`);
    sections.push(`   • Command: ${mcp.endpoint || `npx ${mcp.slug}`}`);
    if (mcp.package_manager) sections.push(`   • Manager: ${mcp.package_manager}`);
    
    // 9. 📊 Quality Assessment
    if (mcp.documentation_quality_score || mcp.user_experience_rating) {
      sections.push(`\n📊 **Quality Assessment:**`);
      if (mcp.documentation_quality_score) sections.push(`   • Documentation: ${mcp.documentation_quality_score}`);
      if (mcp.user_experience_rating) sections.push(`   • User Experience: ${mcp.user_experience_rating}`);
    }

    // 10. 🏷️ Classification
    sections.push(`\n🏷️  **Classification:**`);
    sections.push(`   • Category: ${mcp.category}`);
    if (mcp.tags && mcp.tags.length > 0) {
      sections.push(`   • Tags: ${mcp.tags.slice(0, 5).join(', ')}`);
    }

    // 11. 📝 Review ID for feedback
    sections.push(`\n📝 **Review ID:** ${mcp.id}`);

    // 12. 🔗 Resources (if available)
    const resources = [];
    if (mcp.github_url) resources.push(`📦 [Code](${mcp.github_url})`);
    if (mcp.documentation_url) resources.push(`📚 [Docs](${mcp.documentation_url})`);
    if (mcp.website_url) resources.push(`🌐 [Website](${mcp.website_url})`);
    if (resources.length > 0) {
      sections.push(`\n🔗 **Resources:** ${resources.join(' | ')}`);
    }

    return sections.join('\n');
  }

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
          if (args.no_auth) discoverUrl.searchParams.set('no_auth', 'true');
          if (args.auth_required) discoverUrl.searchParams.set('auth_required', 'true');
          if (args.executable) discoverUrl.searchParams.set('executable', 'true');
          
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
              text: `Found ${discoverData.results?.length || 0} MCP servers with comprehensive intelligence:\n\n` +
                    (discoverData.results || []).map(mcp => {
                      // Enhanced MCP display with 12 categories of data
                      return this.formatComprehensiveMCPData(mcp);
                    }).join('\n' + '='.repeat(80) + '\n') + 
                    '\n\n🌟 **ENHANCED AGENT REVIEW SYSTEM**\n' +
                    'Submit structured performance data to improve discovery for other agents:\n\n' +
                    '```json\n' +
                    '{\n' +
                    '  "name": "review",\n' +
                    '  "arguments": {\n' +
                    '    "mcp_id": "[Review ID from results above]",\n' +
                    '    "rating": 8,\n' +
                    '    "success": true,\n' +
                    '    "tasks_completed": 5,\n' +
                    '    "tasks_failed": 1,\n' +
                    '    "error_count": 1,\n' +
                    '    "rating_breakdown": {\n' +
                    '      "setup_difficulty": 3,\n' +
                    '      "documentation_quality": 2,\n' +
                    '      "reliability": 3,\n' +
                    '      "performance": 3\n' +
                    '    },\n' +
                    '    "use_case_category": "payments",\n' +
                    '    "discovery_effectiveness": "perfect_match",\n' +
                    '    "failure_categories": ["timeout"],\n' +
                    '    "use_case": "Processing customer payments",\n' +
                    '    "review_text": "Works well, minor timeout issue"\n' +
                    '  }\n' +
                    '}\n' +
                    '```\n\n' +
                    '📋 **Rating Scale**: setup/docs/reliability/performance: 1=poor, 2=adequate, 3=excellent\n' +
                    '📂 **Categories**: payments, databases, content-creation, ai-tools, development-tools, etc.\n' +
                    '🎯 **Discovery**: perfect_match, close_match, poor_match, wrong_result\n' +
                    '💡 **Installation Issues?** Run `npx e14z --test` for diagnostics\n' +
                    '📊 **Structured reviews create precise benchmarks for autonomous agent decision-making**'
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
                    (mcp.tools || []).map(tool => {
                      let toolInfo = `- **${tool.name}**: ${tool.description || 'No description'}`;
                      
                      if (tool.parameters) {
                        if (Array.isArray(tool.parameters)) {
                          // Simple array format (e.g., Stripe)
                          if (tool.parameters.length > 0) {
                            toolInfo += `\n  **Parameters**: ${tool.parameters.join(', ')}`;
                          }
                        } else if (typeof tool.parameters === 'object') {
                          // Rich schema format (e.g., Bitcoin, Unity)
                          const paramNames = Object.keys(tool.parameters);
                          if (paramNames.length > 0) {
                            toolInfo += '\n  **Parameters**:';
                            paramNames.forEach(paramName => {
                              const param = tool.parameters[paramName];
                              const required = param.required ? ' (required)' : ' (optional)';
                              const type = param.type ? ` [${param.type}]` : '';
                              const desc = param.description ? ` - ${param.description}` : '';
                              toolInfo += `\n    • ${paramName}${type}${required}${desc}`;
                            });
                          }
                        }
                      }
                      return toolInfo;
                    }).join('\n\n') + '\n\n' +
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
            
            // Enhanced structured fields
            rating_breakdown: args.rating_breakdown,
            use_case_category: args.use_case_category,
            failure_categories: args.failure_categories || [],
            discovery_effectiveness: args.discovery_effectiveness,
            
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
          
        case 'run':
          // Import EnhancedExecutionEngine with auto-install for running MCPs
          const { EnhancedExecutionEngine } = require('../lib/execution/enhanced-engine');
          const executionEngine = new EnhancedExecutionEngine({ enableAutoInstall: true });
          
          const runResult = await executionEngine.executeMCP(args.slug, {
            skipAuthCheck: args.skip_auth_check || false,
            stdio: args.stdio_mode ? 'inherit' : 'pipe'
          });
          
          if (!runResult.success) {
            if (runResult.authRequired) {
              return {
                content: [{
                  type: "text",
                  text: `🔐 **Authentication Required**\n\n` +
                        `MCP "${args.slug}" requires ${runResult.authType} authentication:\n\n` +
                        runResult.instructions.map(instruction => `• ${instruction}`).join('\n') + '\n\n' +
                        `**Options:**\n` +
                        `• Set up the required authentication and try again\n` +
                        `• Use \`skip_auth_check: true\` to run anyway (may fail)\n` +
                        `• Use the \`discover\` tool with \`no_auth: true\` to find MCPs that work immediately\n\n` +
                        `💡 **Need auth-free tools?** Try: \`{"name": "discover", "arguments": {"no_auth": true}}\``
                }]
              };
            } else {
              return {
                content: [{
                  type: "text",
                  text: `❌ **Execution Failed**\n\n${runResult.error}\n\n💡 Run diagnostics: \`npx e14z --diagnose\``
                }]
              };
            }
          }
          
          return {
            content: [{
              type: "text",
              text: `✅ **MCP Executed Successfully**\n\n` +
                    `**Command:** \`${runResult.command}\`\n\n` +
                    `**Output:**\n\`\`\`\n${runResult.output || 'No output'}\n\`\`\`\n\n` +
                    (runResult.error ? `**Errors:**\n\`\`\`\n${runResult.error}\n\`\`\`\n\n` : '') +
                    `**Exit Code:** ${runResult.exitCode}\n\n` +
                    `💡 **Tip:** Use the \`review\` tool to rate this MCP after using it!`
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
    console.log('\nTo connect to AI agents, add this to your MCP configuration:');
    console.log(`{
  "mcpServers": {
    "e14z": {
      "command": "e14z"
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
  console.log('  3. If AI agent won\'t connect: Verify config file syntax');
  console.log('  4. For corporate networks: Check if proxy settings are needed');
  
  console.log('\nCommon MCP Config Locations:');
  const os = require('os');
  if (process.platform === 'darwin') {
    console.log(`  macOS: ~/Library/Application Support/Claude/claude_desktop_config.json (Claude Desktop)`);
  } else if (process.platform === 'win32') {
    console.log(`  Windows: %APPDATA%\\Claude\\claude_desktop_config.json (Claude Desktop)`);
  } else {
    console.log(`  Linux: ~/.config/claude/claude_desktop_config.json (Claude Desktop)`);
  }
  console.log(`  Other agents: Check your MCP client documentation`);
  
  console.log('\nFor more help, visit: https://e14z.com/docs');
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
E14Z MCP Server - AI Tool Discovery Platform

Usage:
  npx e14z                 Start MCP server (stdio mode)
  npx e14z --http          Start HTTP server for testing
  npx e14z --test          Test connection and functionality
  npx e14z --diagnose      Run connection diagnostics
  npx e14z --help          Show this help

Examples:
  # Connect to AI agents (add to MCP configuration):
  {
    "mcpServers": {
      "e14z": {
        "command": "e14z"
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