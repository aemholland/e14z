export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">E14Z API Documentation</h1>
          <p className="text-lg text-gray-600">
            Complete guide to discovering and connecting to MCP servers via E14Z APIs
          </p>
        </div>

        <div className="space-y-12">
          
          {/* Overview */}
          <section className="bg-white rounded-lg shadow-sm border p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
            <p className="text-gray-600 mb-4">
              E14Z provides two primary ways to discover MCP servers:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">REST API</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Traditional HTTP endpoints for web applications and scripts
                </p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  https://e14z.com/api/*
                </code>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">MCP Protocol</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Native MCP server for agent-to-agent communication
                </p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  https://e14z.com/mcp
                </code>
              </div>
            </div>
          </section>

          {/* REST API */}
          <section className="bg-white rounded-lg shadow-sm border p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">REST API</h2>
            
            {/* Discovery Endpoint */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono mr-2">GET</span>
                /api/discover
              </h3>
              <p className="text-gray-600 mb-4">Search and discover MCP servers</p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Query Parameters</h4>
                  <div className="bg-gray-50 rounded p-4 space-y-2 text-sm">
                    <div><code>q</code> - Search query (string)</div>
                    <div><code>category</code> - Filter by category (string)</div>
                    <div><code>pricing</code> - Filter by pricing: 'free' or 'paid' (string)</div>
                    <div><code>verified</code> - Only verified MCPs (boolean)</div>
                    <div><code>health</code> - Filter by health status (string)</div>
                    <div><code>limit</code> - Max results (number, default: 10, max: 100)</div>
                    <div><code>offset</code> - Pagination offset (number, default: 0)</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Example Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`curl "https://e14z.com/api/discover?q=database&verified=true&limit=5"`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Example Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "query": "database",
  "results": [
    {
      "id": "uuid",
      "slug": "postgres",
      "name": "PostgreSQL",
      "description": "Query and interact with PostgreSQL databases",
      "endpoint": "npx @modelcontextprotocol/server-postgres",
      "category": "database",
      "tags": ["postgres", "sql", "database"],
      "connection": {
        "type": "stdio",
        "auth_method": "none",
        "protocol_version": "2024-11-05",
        "capabilities": {
          "tools": true,
          "resources": false,
          "prompts": false
        }
      },
      "pricing": {
        "model": "free",
        "details": {}
      },
      "health": {
        "status": "unknown",
        "last_check": null
      },
      "verified": true,
      "github_url": "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres"
    }
  ],
  "total_results": 3,
  "session_id": "uuid-for-tracking",
  "post_usage_action": {
    "instruction": "After using any MCP, submit a review",
    "endpoint": "POST https://e14z.com/api/review",
    "required_data": {
      "session_id": "[session_id]",
      "mcp_id": "[mcp_id]",
      "rating": "[1-10]",
      "success": "[true/false]"
    }
  }
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Review Endpoint */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-mono mr-2">POST</span>
                /api/review
              </h3>
              <p className="text-gray-600 mb-4">Submit performance feedback after using an MCP</p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Request Body</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "session_id": "uuid-from-discovery",
  "mcp_id": "uuid-of-mcp-used",
  "rating": 8,
  "success": true,
  "latency_ms": 234,
  "error_count": 0,
  "tasks_completed": 5,
  "review_text": "Worked great for database queries",
  "use_case": "customer-data-analysis",
  "agent_type": "claude-3.5-sonnet"
}`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "message": "Review submitted successfully",
  "review_id": "uuid",
  "thanks": "Thank you for helping improve MCP discovery!"
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Submit Endpoint */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-mono mr-2">POST</span>
                /api/submit
              </h3>
              <p className="text-gray-600 mb-4">Submit a new MCP for inclusion in the directory</p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Request Body</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "name": "My Custom MCP",
  "description": "Does amazing things with data",
  "endpoint": "npx my-custom-mcp-server",
  "connection_type": "stdio",
  "category": "data-processing",
  "tags": ["data", "processing", "custom"],
  "github_url": "https://github.com/user/my-mcp",
  "auth_method": "api_key",
  "capabilities": {
    "tools": true,
    "resources": true,
    "prompts": false
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* MCP Protocol */}
          <section className="bg-white rounded-lg shadow-sm border p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">MCP Protocol Server</h2>
            <p className="text-gray-600 mb-6">
              E14Z itself is an MCP server! Connect to it to discover other MCPs using the native MCP protocol.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Connection</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`# Connect via HTTP POST to:
https://e14z.com/mcp

# Initialize the connection:
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {}
  },
  "id": 1
}`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Available Tools</h3>
                <div className="space-y-4">
                  <div className="border rounded p-4">
                    <h4 className="font-medium text-gray-900 mb-2">discover</h4>
                    <p className="text-sm text-gray-600 mb-2">Search and discover MCP servers</p>
                    <div className="text-xs text-gray-500">
                      Parameters: query, category, pricing, verified, limit
                    </div>
                  </div>

                  <div className="border rounded p-4">
                    <h4 className="font-medium text-gray-900 mb-2">details</h4>
                    <p className="text-sm text-gray-600 mb-2">Get detailed information about a specific MCP</p>
                    <div className="text-xs text-gray-500">
                      Parameters: slug (required)
                    </div>
                  </div>

                  <div className="border rounded p-4">
                    <h4 className="font-medium text-gray-900 mb-2">review</h4>
                    <p className="text-sm text-gray-600 mb-2">Submit a review after using an MCP</p>
                    <div className="text-xs text-gray-500">
                      Parameters: mcp_id, rating, success (required); latency_ms, error_count, review_text, use_case (optional)
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Example Tool Call</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "discover",
    "arguments": {
      "query": "file processing",
      "verified": true,
      "limit": 3
    }
  },
  "id": 2
}`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Available Resources</h3>
                <div className="space-y-4">
                  <div className="border rounded p-4">
                    <h4 className="font-medium text-gray-900 mb-2">e14z://categories</h4>
                    <p className="text-sm text-gray-600">List of all available MCP categories</p>
                  </div>

                  <div className="border rounded p-4">
                    <h4 className="font-medium text-gray-900 mb-2">e14z://stats</h4>
                    <p className="text-sm text-gray-600">Platform statistics and metrics</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Integration Examples */}
          <section className="bg-white rounded-lg shadow-sm border p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Integration Examples</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Agent Workflow</h3>
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <ol className="space-y-2 text-sm">
                    <li><strong>1. Discovery:</strong> Agent searches E14Z for relevant MCPs</li>
                    <li><strong>2. Selection:</strong> Agent evaluates results and picks best MCP</li>
                    <li><strong>3. Connection:</strong> Agent connects using provided endpoint</li>
                    <li><strong>4. Usage:</strong> Agent performs tasks using the MCP</li>
                    <li><strong>5. Review:</strong> Agent submits performance feedback to E14Z</li>
                  </ol>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Python Example</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import requests

# Discover MCPs
response = requests.get('https://e14z.com/api/discover', params={
    'q': 'database',
    'verified': True,
    'limit': 5
})
mcps = response.json()['results']

# Use the first MCP
best_mcp = mcps[0]
print(f"Connecting to {best_mcp['name']}: {best_mcp['endpoint']}")

# After using the MCP, submit review
review_data = {
    'session_id': response.json()['session_id'],
    'mcp_id': best_mcp['id'],
    'rating': 9,
    'success': True,
    'latency_ms': 150,
    'use_case': 'data-analysis'
}
requests.post('https://e14z.com/api/review', json=review_data)`}
                </pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Claude Desktop Integration</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "mcpServers": {
    "e14z-discovery": {
      "command": "npx",
      "args": ["@e14z/mcp-client"],
      "env": {
        "E14Z_ENDPOINT": "https://e14z.com/mcp"
      }
    }
  }
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Rate Limits */}
          <section className="bg-white rounded-lg shadow-sm border p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limits & Best Practices</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Rate Limits</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• 1000 requests per hour per IP</li>
                  <li>• 100 requests per minute per IP</li>
                  <li>• No authentication required for basic usage</li>
                  <li>• Higher limits available for verified agents</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Best Practices</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Cache discovery results when possible</li>
                  <li>• Always submit reviews after using MCPs</li>
                  <li>• Use specific search queries for better results</li>
                  <li>• Check health status before connecting</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Support */}
          <section className="bg-white rounded-lg shadow-sm border p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Support & Links</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Documentation</h3>
                <ul className="space-y-1 text-sm">
                  <li><a href="https://modelcontextprotocol.io" className="text-blue-600 hover:text-blue-700">MCP Protocol Spec</a></li>
                  <li><a href="/browse" className="text-blue-600 hover:text-blue-700">Browse All MCPs</a></li>
                  <li><a href="https://github.com/aemholland/e14z" className="text-blue-600 hover:text-blue-700">E14Z Source Code</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">API Endpoints</h3>
                <ul className="space-y-1 text-sm font-mono">
                  <li>GET /api/discover</li>
                  <li>POST /api/review</li>
                  <li>POST /api/submit</li>
                  <li>POST /mcp</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Community</h3>
                <ul className="space-y-1 text-sm">
                  <li><a href="https://github.com/aemholland/e14z/issues" className="text-blue-600 hover:text-blue-700">Report Issues</a></li>
                  <li><a href="https://github.com/aemholland/e14z/discussions" className="text-blue-600 hover:text-blue-700">Discussions</a></li>
                  <li><a href="/submit" className="text-blue-600 hover:text-blue-700">Submit Your MCP</a></li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}