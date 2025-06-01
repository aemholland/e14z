#!/usr/bin/env node

/**
 * E14Z MCP Server - Provides AI agents access to the complete MCP registry
 * Separated from CLI tool for clean architecture
 */

const { spawn } = require('child_process');
const path = require('path');

// Generate session ID for tracking user reviews
const sessionId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// MCP Server implementation
const mcpServer = {
  name: "e14z",
  description: "AI Tool Discovery Platform - Discover 50+ MCP servers",
  version: "3.0.0",
  
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
                    (discoverData.results || []).map(mcp => {
                      // Installation methods
                      const primaryInstall = mcp.installation?.primary_method?.command || mcp.endpoint;
                      const altMethods = mcp.installation?.alternative_methods?.length > 0 ? 
                        `\n   📋 Alternatives: ${mcp.installation.alternative_methods.map(m => m.command).join(', ')}` : '';
                      
                      // Tools information with parameters
                      const toolsList = mcp.tools?.list?.length > 0 ? 
                        `\n   🔧 Tools (${mcp.tools.count}): ${mcp.tools.list.slice(0,3).map(t => {
                          const hasParams = t.parameters && (Array.isArray(t.parameters) ? t.parameters.length > 0 : Object.keys(t.parameters).length > 0);
                          let paramInfo = '';
                          if (hasParams) {
                            if (Array.isArray(t.parameters)) {
                              paramInfo = `(${t.parameters.length}p)`;
                            } else {
                              const paramNames = Object.keys(t.parameters);
                              paramInfo = `(${paramNames.slice(0,2).join(',')}${paramNames.length > 2 ? '...' : ''})`;
                            }
                          }
                          return `${t.name}${paramInfo}`;
                        }).join(', ')}${mcp.tools.count > 3 ? '...' : ''}` : 
                        `\n   🔧 Tools: ${mcp.tools?.count || 0} available`;
                      
                      // Auth info if needed
                      const authInfo = mcp.installation?.auth_method && mcp.installation.auth_method !== 'none' ? 
                        `\n   🔐 Auth: ${mcp.installation.auth_method} required` : '';
                      
                      // Quality indicators
                      const qualityStatus = mcp.verified ? '✅ Verified' : '🔄 Community';
                      const healthStatus = mcp.quality?.health_status ? ` | 🔋 ${mcp.quality.health_status}` : '';
                      
                      // Resources
                      const resources = [];
                      if (mcp.resources?.github_url) resources.push(`📦 Code: ${mcp.resources.github_url}`);
                      if (mcp.resources?.documentation_url) resources.push(`📚 Docs: ${mcp.resources.documentation_url}`);
                      const resourceLinks = resources.length > 0 ? `\n   ${resources.join(' | ')}` : '';
                      
                      // Use cases
                      const useCases = mcp.use_cases?.length > 0 ? 
                        `\n   💡 Use cases: ${mcp.use_cases.slice(0,2).join(', ')}${mcp.use_cases.length > 2 ? '...' : ''}` : '';
                      
                      return `\n🔧 **${mcp.name}** (${mcp.slug})\n` +
                      `   ${mcp.description}\n` +
                      `   Status: ${qualityStatus}${healthStatus} | Category: ${mcp.category}\n` +
                      `   💻 Install: ${primaryInstall}${altMethods}${toolsList}${authInfo}${resourceLinks}${useCases}\n` +
                      `   📝 Review ID: ${mcp.id}\n`;
                    }).join('') + 
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
                    '💡 **Need to run MCPs?** Use `e14z run <mcp-name>` for direct execution\n' +
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
                text: `Error: ${detailsData.error}\n\n💡 Run \`e14z diagnose\` for troubleshooting.`
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
                    (mcp.github_url ? `**GitHub:** ${mcp.github_url}\n` : '') +
                    `\n**Execution:** \`e14z run ${mcp.slug}\`\n`
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
                    `Error submitting review: ${reviewData.error}\n\n💡 Run \`e14z diagnose\` for troubleshooting.` :
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

// Start the MCP server
if (require.main === module) {
  const server = new MCPServer();
  server.start().catch(error => {
    console.error('Failed to start E14Z MCP Server:', error);
    process.exit(1);
  });
}

module.exports = { MCPServer, mcpServer };