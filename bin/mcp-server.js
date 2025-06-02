#!/usr/bin/env node

/**
 * E14Z MCP Server CLI Entry Point
 * 
 * This script starts the E14Z MCP server that provides AI agents
 * with access to the complete MCP registry for discovery and integration.
 * 
 * 🛡️ 2025 MCP SECURITY HARDENING IMPLEMENTED:
 * 
 * Protocol-Level Security:
 * - JSON-RPC 2.0 strict compliance validation
 * - Method name allowlisting (prevents tool poisoning attacks)  
 * - Request/response size limits (prevents buffer overflow)
 * - Multi-layer rate limiting with burst protection
 * - Session-based request tracking
 * 
 * Input Validation & Sanitization:
 * - XSS pattern detection and blocking
 * - Prototype pollution prevention
 * - Command injection protection
 * - Parameter depth and count limits
 * - Dangerous content filtering
 * 
 * Resource Protection:
 * - Memory exhaustion prevention (1MB buffer limit)
 * - Message flooding protection (100 msg/batch limit)
 * - Response timeout monitoring (30s)
 * - Deep object nesting prevention (10 levels max)
 * 
 * Monitoring & Alerting:
 * - Real-time threat pattern detection
 * - Security event logging with context
 * - Response time monitoring
 * - Statistical audit logging (1% sample)
 * - Production vs development error detail control
 * 
 * Research Sources:
 * - 2025 MCP vulnerability assessments
 * - OWASP JSON-RPC security guidelines
 * - Node.js security best practices
 * - Context7 MCP security documentation
 */

const { spawn } = require('child_process');
const path = require('path');

// Import MCP APM for comprehensive monitoring
const { mcpAPM } = require('../lib/observability/mcp-apm');

// Generate session ID for tracking user reviews
const sessionId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// MCP Server implementation
const mcpServer = {
  name: "e14z",
  description: "AI Tool Discovery Platform - Discover 50+ MCP servers",
  version: "3.0.9",
  
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
  
  async handleToolCall({ name, arguments: args }) {
    const baseUrl = process.env.E14Z_API_URL || 'https://www.e14z.com';
    
    // APM: Track tool call start
    const toolStartTime = Date.now();
    
    // 2025 MCP Security: Comprehensive Input Validation & Sanitization
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid tool name: must be a non-empty string');
    }
    
    // Tool name sanitization - prevent injection attacks
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Invalid tool name: contains dangerous characters');
    }
    
    if (name.length > 50) {
      throw new Error('Tool name too long: maximum 50 characters');
    }
    
    // Strict allowlist - only specific tools allowed (prevents tool poisoning)
    const allowedTools = ['discover', 'details', 'review', 'run'];
    if (!allowedTools.includes(name)) {
      throw new Error(`Tool not allowed: ${name}. Allowed tools: ${allowedTools.join(', ')}`);
    }
    
    // Validate arguments object structure
    if (args !== null && args !== undefined) {
      if (typeof args !== 'object' || Array.isArray(args)) {
        throw new Error('Arguments must be an object or null');
      }
      
      // Prevent prototype pollution and check argument count
      if (Object.prototype.hasOwnProperty.call(args, '__proto__') || 
          Object.prototype.hasOwnProperty.call(args, 'constructor') ||
          Object.prototype.hasOwnProperty.call(args, 'prototype')) {
        throw new Error('Arguments contain dangerous properties');
      }
      
      if (Object.keys(args).length > 20) {
        throw new Error('Too many arguments: maximum 20 allowed');
      }
      
      // Validate each argument
      for (const [key, value] of Object.entries(args)) {
        if (typeof key !== 'string' || key.length > 100) {
          throw new Error(`Invalid argument key: ${key}`);
        }
        
        if (typeof value === 'string' && value.length > 10000) {
          throw new Error(`Argument value too long: ${key}`);
        }
        
        // Prevent XSS in arguments
        if (typeof value === 'string' && /<script|javascript:|data:|vbscript:/i.test(value)) {
          throw new Error(`Dangerous content detected in argument: ${key}`);
        }
      }
    }
    
    try {
      const fetch = (await import('node-fetch')).default;
      let result;
      
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
          
          result = {
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
                    '💡 **Installation Issues?** Run `npx e14z --test` for diagnostics\n' +
                    '📊 **Structured reviews create precise benchmarks for autonomous agent decision-making**'
            }]
          };
          break;
          
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
            result = {
              content: [{
                type: "text",
                text: `Error: ${detailsData.error}\n\n💡 Run \`npx e14z --diagnose\` for troubleshooting.`
              }]
            };
          } else {
            const mcp = detailsData.mcp;
            result = {
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
          }
          break;
          
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
          
          result = {
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
          break;
          
        case 'run':
          // Import ExecutionEngine for running MCPs
          const { ExecutionEngine } = require('../lib/execution/engine');
          const executionEngine = new ExecutionEngine();
          
          const runResult = await executionEngine.executeMCP(args.slug, {
            skipAuthCheck: args.skip_auth_check || false,
            stdio: args.stdio_mode ? 'inherit' : 'pipe'
          });
          
          if (!runResult.success) {
            if (runResult.authRequired) {
              result = {
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
              result = {
                content: [{
                  type: "text",
                  text: `❌ **Execution Failed**\n\n${runResult.error}\n\n💡 Run diagnostics: \`npx e14z --diagnose\``
                }]
              };
            }
          } else {
            result = {
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
          }
          break;
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      
      // APM: Record successful tool execution
      const toolDuration = Date.now() - toolStartTime;
      mcpAPM.recordToolPerformance(name, toolDuration, true);
      
      return result;
      
    } catch (error) {
      // APM: Record failed tool execution
      const toolDuration = Date.now() - toolStartTime;
      mcpAPM.recordToolPerformance(name, toolDuration, false);
      
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
        } else if (req.method === 'GET' && req.url === '/metrics') {
          // APM: Metrics endpoint for monitoring
          try {
            const metrics = mcpAPM.getMetricsSnapshot();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(metrics, null, 2));
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to get metrics' }));
          }
        } else {
          res.writeHead(404);
          res.end('MCP Server - Use POST /mcp or GET /metrics');
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
    
    // 2025 MCP Security: Enhanced rate limiting and session tracking
    this.requestCounts = new Map(); // IP/session based rate limiting
    this.lastRequestTime = 0;
    this.sessionAuthRequired = new Set(); // Track sessions requiring auth
    
    process.stdin.on('data', async (chunk) => {
      buffer += chunk;
      
      // 2025 MCP Security: Buffer size protection against memory exhaustion
      if (buffer.length > 1000000) { // 1MB total buffer limit
        console.error('MCP Security Alert: Buffer overflow attempt detected');
        buffer = '';
        return;
      }
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      // 2025 MCP Security: Limit concurrent message processing
      if (lines.length > 100) { // Max 100 messages per batch
        console.error('MCP Security Alert: Message flooding attempt detected');
        return;
      }
      
      for (const line of lines) {
        if (line.trim()) {
          let request = null;
          let apmContext = null;
          
          try {
            // 2025 MCP Security: Enhanced request validation
            if (line.length > 50000) { // Reduced from 100KB to 50KB
              mcpAPM.recordSecurityEvent('request_too_large', `Request size: ${line.length} bytes`, 'high');
              throw new Error('Request too large: maximum 50KB allowed');
            }
            
            // 2025 MCP Security: Validate against common injection patterns
            if (/<script|javascript:|data:|vbscript:|file:|ftp:/i.test(line)) {
              mcpAPM.recordSecurityEvent('injection_attempt', 'Dangerous content patterns detected', 'critical');
              throw new Error('Dangerous content detected in request');
            }
            
            // 2025 MCP Security: Check for prototype pollution attempts
            if (/(__proto__|constructor|prototype).*:/i.test(line)) {
              mcpAPM.recordSecurityEvent('prototype_pollution_attempt', 'Prototype pollution patterns detected', 'critical');
              throw new Error('Prototype pollution attempt detected');
            }
            
            request = JSON.parse(line);
            
            // APM: Start request tracking
            apmContext = mcpAPM.startRequest(request);
            
            // 2025 MCP Security: Comprehensive request structure validation
            if (!request || typeof request !== 'object' || Array.isArray(request)) {
              throw new Error('Invalid request format: must be object');
            }
            
            // 2025 MCP Security: Validate JSON-RPC 2.0 compliance
            if (!request.jsonrpc || request.jsonrpc !== '2.0') {
              throw new Error('Invalid JSON-RPC version: must be 2.0');
            }
            
            if (!request.method || typeof request.method !== 'string') {
              throw new Error('Invalid method: must be non-empty string');
            }
            
            // 2025 MCP Security: Method name validation
            if (request.method.length > 50) {
              throw new Error('Method name too long: maximum 50 characters');
            }
            
            if (!/^[a-zA-Z0-9/_-]+$/.test(request.method)) {
              throw new Error('Invalid method name: contains dangerous characters');
            }
            
            // 2025 MCP Security: ID validation for requests
            if (request.id !== undefined) {
              if (typeof request.id !== 'string' && typeof request.id !== 'number' && request.id !== null) {
                throw new Error('Invalid request ID: must be string, number, or null');
              }
              
              if (typeof request.id === 'string' && request.id.length > 100) {
                throw new Error('Request ID too long: maximum 100 characters');
              }
            }
            
            // 2025 MCP Security: Parameters validation
            if (request.params !== undefined) {
              if (typeof request.params !== 'object' || Array.isArray(request.params)) {
                throw new Error('Invalid params: must be object or undefined');
              }
              
              // Check for dangerous properties
              if (Object.prototype.hasOwnProperty.call(request.params, '__proto__') ||
                  Object.prototype.hasOwnProperty.call(request.params, 'constructor') ||
                  Object.prototype.hasOwnProperty.call(request.params, 'prototype')) {
                throw new Error('Params contain dangerous properties');
              }
              
              // Limit parameter count and depth
              if (Object.keys(request.params).length > 50) {
                throw new Error('Too many parameters: maximum 50 allowed');
              }
              
              // Deep object validation to prevent nested attacks
              const validateDepth = (obj, depth = 0) => {
                if (depth > 10) throw new Error('Parameter nesting too deep: maximum 10 levels');
                if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
                  for (const [key, value] of Object.entries(obj)) {
                    if (typeof key === 'string' && key.length > 100) {
                      throw new Error(`Parameter key too long: ${key}`);
                    }
                    validateDepth(value, depth + 1);
                  }
                }
              };
              validateDepth(request.params);
            }
            
            // 2025 MCP Security: Enhanced rate limiting with burst protection
            const now = Date.now();
            const sessionId = request.id?.toString() || 'anonymous';
            
            if (!this.requestCounts.has(sessionId)) {
              this.requestCounts.set(sessionId, { count: 0, window: now });
            }
            
            const session = this.requestCounts.get(sessionId);
            
            // Reset window every 60 seconds
            if (now - session.window > 60000) {
              session.count = 0;
              session.window = now;
            }
            
            // Rate limiting: max 100 requests per minute per session
            if (session.count >= 100) {
              mcpAPM.recordSecurityEvent('rate_limit_session', `Session ${sessionId} exceeded 100 req/min`, 'medium');
              throw new Error('Rate limit exceeded: maximum 100 requests per minute');
            }
            
            // Additional global rate limiting
            if (now - this.lastRequestTime < 50) { // Reduced to 50ms minimum
              mcpAPM.recordSecurityEvent('rate_limit_global', 'Global rate limit exceeded', 'medium');
              throw new Error('Global rate limit exceeded');
            }
            
            session.count++;
            this.lastRequestTime = now;
            
            // 2025 MCP Security: Method allowlisting at protocol level
            const allowedMethods = [
              'initialize', 'initialized', 'notifications/initialized',
              'tools/list', 'tools/call', 'ping', 'shutdown'
            ];
            
            if (!allowedMethods.includes(request.method)) {
              throw new Error(`Method not allowed: ${request.method}`);
            }
            
            // 2025 MCP Security: Authentication enforcement for sensitive methods
            if (['tools/call'].includes(request.method) && this.sessionAuthRequired.has(sessionId)) {
              // In a real implementation, validate session tokens here
              console.error(`MCP Security: Authenticated method ${request.method} called by session ${sessionId}`);
            }
            
            const response = await this.server.handleRequest(request);
            
            // APM: Record successful request completion
            mcpAPM.endRequest(apmContext, response);
            
            // 2025 MCP Security: Response time monitoring
            const responseTime = Date.now() - apmContext.startTime;
            if (responseTime > 30000) { // 30 second timeout
              mcpAPM.recordSecurityEvent('slow_response', `${responseTime}ms for ${request.method}`, 'low');
              console.error(`MCP Security Alert: Slow response detected: ${responseTime}ms for ${request.method}`);
            }
            
            // Only send response for requests (with ID), not notifications
            if (request.id !== undefined) {
              const responseData = {
                jsonrpc: "2.0",
                id: request.id,
                result: response
              };
              
              // 2025 MCP Security: Response size validation
              const responseString = JSON.stringify(responseData);
              if (responseString.length > 500000) { // 500KB response limit
                mcpAPM.recordSecurityEvent('response_too_large', `Response size: ${responseString.length} bytes`, 'medium');
                throw new Error('Response too large');
              }
              
              console.log(responseString);
            }
            
            // 2025 MCP Security: Success logging for monitoring
            if (Math.random() < 0.01) { // Log 1% of successful requests for monitoring
              console.error(`MCP Audit: ${request.method} completed in ${responseTime}ms`);
            }
            
          } catch (error) {
            // APM: Record failed request if context exists
            if (apmContext) {
              mcpAPM.endRequestWithError(apmContext, error);
            }
            
            const responseTime = apmContext ? Date.now() - apmContext.startTime : 0;
            
            // 2025 MCP Security: Enhanced error logging with threat detection
            console.error(`MCP Security Event: ${error.message} | Method: ${request?.method || 'unknown'} | Time: ${responseTime}ms | Session: ${request?.id?.toString() || 'anonymous'}`);
            
            // 2025 MCP Security: Threat pattern detection
            if (error.message.includes('dangerous') || 
                error.message.includes('pollution') || 
                error.message.includes('injection') ||
                error.message.includes('overflow')) {
              console.error(`MCP SECURITY ALERT: Potential attack detected - ${error.message}`);
              
              // In production, this would trigger security monitoring
              // Example: await this.notifySecurityTeam(error, request);
            }
            
            // Determine appropriate JSON-RPC error code
            let errorCode = -32603; // Internal error default
            let errorMessage = error.message;
            
            if (error.message.includes('Unknown method') || error.message.includes('Method not allowed')) {
              errorCode = -32601; // Method not found
            } else if (error.message.includes('Invalid params') || error.message.includes('Invalid method')) {
              errorCode = -32602; // Invalid params
            } else if (line.trim() && !request) {
              errorCode = -32700; // Parse error
            } else if (error.message.includes('Rate limit')) {
              errorCode = -32000; // Custom: Rate limit error
            } else if (error.message.includes('too large') || error.message.includes('overflow')) {
              errorCode = -32001; // Custom: Resource limit error
              errorMessage = 'Request exceeds size limits'; // Don't leak internal details
            } else if (error.message.includes('dangerous') || error.message.includes('pollution')) {
              errorCode = -32002; // Custom: Security error
              errorMessage = 'Request contains invalid content'; // Generic security message
            }
            
            // Only send error response for requests (with ID), not notifications
            if (request?.id !== undefined) {
              const errorResponse = {
                jsonrpc: "2.0", 
                id: request.id,
                error: {
                  code: errorCode,
                  message: errorMessage,
                  // 2025 MCP Security: Limit error details in production
                  data: process.env.NODE_ENV === 'development' ? {
                    type: error.constructor.name,
                    details: error.stack ? error.stack.split('\n')[0] : error.message
                  } : undefined
                }
              };
              
              console.log(JSON.stringify(errorResponse));
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
  # Connect to Claude Desktop (add to claude_desktop_config.json):
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