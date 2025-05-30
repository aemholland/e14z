#!/usr/bin/env node

/**
 * E14Z MCP Server CLI Entry Point
 * 
 * This script starts the E14Z MCP server that provides AI agents
 * with access to the complete MCP registry for discovery and integration.
 */

const { spawn } = require('child_process');
const path = require('path');

// MCP Server implementation
const mcpServer = {
  name: "e14z",
  description: "AI Tool Discovery Platform - The npm for AI agents",
  version: "1.0.0",
  
  // MCP Protocol handlers
  async handleRequest(request) {
    const { method, params } = request;
    
    switch (method) {
      case 'initialize':
        return {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: this.name,
            version: this.version
          }
        };
        
      case 'tools/list':
        return {
          tools: [
            {
              name: "discover",
              description: "Search and filter MCP servers by capabilities, category, or keywords",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Search query for MCP servers" },
                  category: { type: "string", description: "Filter by category (e.g., 'database', 'payment')" },
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
                  mcp_slug: { type: "string", description: "MCP server slug" },
                  rating: { type: "number", description: "Rating from 1-10" },
                  review_text: { type: "string", description: "Optional review text" },
                  use_case: { type: "string", description: "What you used it for" }
                },
                required: ["mcp_slug", "rating"]
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
    const baseUrl = process.env.E14Z_API_URL || 'https://e14z.com';
    
    try {
      const fetch = (await import('node-fetch')).default;
      
      switch (name) {
        case 'discover':
          const discoverUrl = new URL('/api/discover', baseUrl);
          if (args.query) discoverUrl.searchParams.set('q', args.query);
          if (args.category) discoverUrl.searchParams.set('category', args.category);
          if (args.verified) discoverUrl.searchParams.set('verified', 'true');
          if (args.limit) discoverUrl.searchParams.set('limit', args.limit.toString());
          
          const discoverResponse = await fetch(discoverUrl);
          const discoverData = await discoverResponse.json();
          
          return {
            content: [{
              type: "text",
              text: `Found ${discoverData.results?.length || 0} MCP servers:\n\n` +
                    (discoverData.results || []).map(mcp => 
                      `🔧 **${mcp.name}** (${mcp.slug})\n` +
                      `   ${mcp.description}\n` +
                      `   Category: ${mcp.category} | ${mcp.verified ? '✅ Verified' : '🔄 Community'}\n` +
                      `   Install: ${mcp.endpoint}\n` +
                      `   Tools: ${mcp.tools?.length || 0} available\n`
                    ).join('\n')
            }]
          };
          
        case 'details':
          const detailsResponse = await fetch(`${baseUrl}/api/mcp/${args.slug}`);
          const detailsData = await detailsResponse.json();
          
          if (detailsData.error) {
            return {
              content: [{
                type: "text",
                text: `Error: ${detailsData.error}`
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
          const reviewResponse = await fetch(`${baseUrl}/api/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
          });
          const reviewData = await reviewResponse.json();
          
          return {
            content: [{
              type: "text",
              text: reviewData.error ? 
                    `Error submitting review: ${reviewData.error}` :
                    `✅ Review submitted successfully for ${args.mcp_slug}!\nThank you for your feedback.`
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
    // Handle stdin/stdout for MCP protocol
    process.stdin.setEncoding('utf8');
    
    let buffer = '';
    
    process.stdin.on('data', async (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const request = JSON.parse(line);
            const response = await this.server.handleRequest(request);
            
            console.log(JSON.stringify({
              jsonrpc: "2.0",
              id: request.id,
              result: response
            }));
          } catch (error) {
            console.log(JSON.stringify({
              jsonrpc: "2.0", 
              id: request?.id || null,
              error: {
                code: -32603,
                message: error.message
              }
            }));
          }
        }
      }
    });
    
    process.stdin.on('end', () => {
      process.exit(0);
    });
    
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
    }
  }
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
  
  // Start the MCP server
  const server = new MCPServer();
  server.start().catch(error => {
    console.error('Failed to start E14Z MCP Server:', error);
    process.exit(1);
  });
}

module.exports = { MCPServer, mcpServer };