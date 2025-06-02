export default function DocsPage() {
  return (
    <div style={{backgroundColor: 'var(--color-canvas-default)', minHeight: '100vh'}}>
      <div className="container" style={{maxWidth: '64rem', padding: '32px 16px'}}>
        
        {/* Header */}
        <div style={{marginBottom: '32px'}}>
          <h1 className="text-title" style={{marginBottom: '16px'}}>E14Z API Documentation</h1>
          <p className="text-body text-secondary" style={{marginBottom: '16px'}}>
            Complete guide to discovering and connecting to MCP servers via E14Z APIs
          </p>
          <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
            <a 
              href="/api-docs" 
              className="btn btn-primary"
              style={{
                textDecoration: 'none',
                padding: '8px 16px',
                backgroundColor: 'var(--color-btn-primary-bg)',
                color: 'var(--color-btn-primary-text)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              📚 Interactive API Docs (Swagger)
            </a>
            <a 
              href="/api/docs?format=json" 
              className="btn btn-outline"
              style={{
                textDecoration: 'none',
                padding: '8px 16px',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-fg-default)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500'
              }}
              target="_blank"
            >
              📄 OpenAPI JSON
            </a>
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '48px'}}>
          
          {/* Overview */}
          <section className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">Overview</h2>
            </div>
            <div className="Box-body">
              <p className="text-secondary" style={{marginBottom: '16px'}}>
                E14Z provides two primary ways to discover MCP servers:
              </p>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px'}}>
                <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                  <div className="Box-body">
                    <h3 className="text-body text-primary" style={{marginBottom: '8px'}}>REST API</h3>
                    <p className="text-small text-secondary" style={{marginBottom: '12px'}}>
                      Traditional HTTP endpoints for web applications and scripts
                    </p>
                    <code className="text-small text-mono" style={{
                      backgroundColor: 'var(--color-canvas-subtle)',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}>
                      https://e14z.com/api/*
                    </code>
                  </div>
                </div>
                <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                  <div className="Box-body">
                    <h3 className="text-body text-primary" style={{marginBottom: '8px'}}>MCP Protocol</h3>
                    <p className="text-small text-secondary" style={{marginBottom: '12px'}}>
                      Native MCP server for agent-to-agent communication
                    </p>
                    <code className="text-small text-mono" style={{
                      backgroundColor: 'var(--color-canvas-subtle)',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}>
                      https://e14z.com/mcp
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* REST API */}
          <section className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">REST API</h2>
            </div>
            <div className="Box-body" style={{display: 'flex', flexDirection: 'column', gap: '32px'}}>
              
              {/* Discovery Endpoint */}
              <div>
                <h3 className="text-body text-primary" style={{marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span className="Label Label--accent">GET</span>
                  /api/discover
                </h3>
                <p className="text-secondary" style={{marginBottom: '16px'}}>Search and discover MCP servers</p>
                
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                  <div>
                    <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>Query Parameters</h4>
                    <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                      <div className="Box-body text-small" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <div><code className="text-mono">q</code> - Search query (string)</div>
                        <div><code className="text-mono">category</code> - Filter by category (string)</div>
                        <div><code className="text-mono">pricing</code> - Filter by pricing: 'free' or 'paid' (string)</div>
                        <div><code className="text-mono">verified</code> - Only verified MCPs (boolean)</div>
                        <div><code className="text-mono">health</code> - Filter by health status (string)</div>
                        <div><code className="text-mono">limit</code> - Max results (number, default: 10, max: 100)</div>
                        <div><code className="text-mono">offset</code> - Pagination offset (number, default: 0)</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>Example Request</h4>
                    <pre className="text-mono text-small" style={{
                      backgroundColor: 'var(--color-canvas-default)',
                      color: 'var(--color-fg-default)',
                      padding: '16px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-default)',
                      overflow: 'auto',
                      maxWidth: '100%',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
{`curl "https://e14z.com/api/discover?q=database&verified=true&limit=5"`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>Example Response</h4>
                    <pre className="text-mono text-small" style={{
                      backgroundColor: 'var(--color-canvas-default)',
                      color: 'var(--color-fg-default)',
                      padding: '16px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-default)',
                      overflow: 'auto',
                      maxWidth: '100%',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
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
              <div>
                <h3 className="text-body text-primary" style={{marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span className="Label Label--success">POST</span>
                  /api/review
                </h3>
                <p className="text-secondary" style={{marginBottom: '16px'}}>Submit performance feedback after using an MCP</p>
                
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                  <div>
                    <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>Request Body</h4>
                    <pre className="text-mono text-small" style={{
                      backgroundColor: 'var(--color-canvas-default)',
                      color: 'var(--color-fg-default)',
                      padding: '16px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-default)',
                      overflow: 'auto',
                      maxWidth: '100%',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
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
                    <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>Response</h4>
                    <pre className="text-mono text-small" style={{
                      backgroundColor: 'var(--color-canvas-default)',
                      color: 'var(--color-fg-default)',
                      padding: '16px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-default)',
                      overflow: 'auto',
                      maxWidth: '100%',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
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
                <h3 className="text-body text-primary" style={{marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span className="Label Label--done">POST</span>
                  /api/submit
                </h3>
                <p className="text-secondary" style={{marginBottom: '16px'}}>Submit a new MCP for inclusion in the directory</p>
                
                <div>
                  <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>Request Body</h4>
                  <pre className="text-mono text-small" style={{
                    backgroundColor: 'var(--color-canvas-default)',
                    color: 'var(--color-fg-default)',
                    padding: '16px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-default)',
                    overflow: 'auto',
                    maxWidth: '100%',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}>
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
          <section className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">MCP Protocol Server</h2>
            </div>
            <div className="Box-body">
              <p className="text-secondary" style={{marginBottom: '24px'}}>
                E14Z itself is an MCP server! Connect to it to discover other MCPs using the native MCP protocol.
              </p>

              <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
                <div>
                  <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>Connection</h3>
                  <pre className="text-mono text-small" style={{
                    backgroundColor: 'var(--color-canvas-default)',
                    color: 'var(--color-fg-default)',
                    padding: '16px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-default)',
                    overflow: 'auto',
                    maxWidth: '100%',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}>
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
                  <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>Available Tools</h3>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                      <div className="Box-body">
                        <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>discover</h4>
                        <p className="text-small text-secondary" style={{marginBottom: '8px'}}>Search and discover MCP servers</p>
                        <div className="text-small text-tertiary">
                          Parameters: query, category, pricing, verified, limit
                        </div>
                      </div>
                    </div>

                    <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                      <div className="Box-body">
                        <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>details</h4>
                        <p className="text-small text-secondary" style={{marginBottom: '8px'}}>Get detailed information about a specific MCP</p>
                        <div className="text-small text-tertiary">
                          Parameters: slug (required)
                        </div>
                      </div>
                    </div>

                    <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                      <div className="Box-body">
                        <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>review</h4>
                        <p className="text-small text-secondary" style={{marginBottom: '8px'}}>Submit a review after using an MCP</p>
                        <div className="text-small text-tertiary">
                          Parameters: mcp_id, rating, success (required); latency_ms, error_count, review_text, use_case (optional)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>Example Tool Call</h3>
                  <pre className="text-mono text-small" style={{
                    backgroundColor: 'var(--color-canvas-default)',
                    color: 'var(--color-fg-default)',
                    padding: '16px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border-default)',
                    overflow: 'auto',
                    maxWidth: '100%',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}>
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
                  <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>Available Resources</h3>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                      <div className="Box-body">
                        <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>e14z://categories</h4>
                        <p className="text-small text-secondary">List of all available MCP categories</p>
                      </div>
                    </div>

                    <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                      <div className="Box-body">
                        <h4 className="text-body text-primary" style={{marginBottom: '8px'}}>e14z://stats</h4>
                        <p className="text-small text-secondary">Platform statistics and metrics</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Integration Examples */}
          <section className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">Integration Examples</h2>
            </div>
            <div className="Box-body" style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
              
              <div>
                <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>Agent Workflow</h3>
                <div className="Box" style={{backgroundColor: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-muted)'}}>
                  <div className="Box-body">
                    <ol style={{margin: 0, paddingLeft: '20px'}} className="text-small" data-style="list">
                      <li style={{marginBottom: '8px'}}><strong>1. Discovery:</strong> Agent searches E14Z for relevant MCPs</li>
                      <li style={{marginBottom: '8px'}}><strong>2. Selection:</strong> Agent evaluates results and picks best MCP</li>
                      <li style={{marginBottom: '8px'}}><strong>3. Connection:</strong> Agent connects using provided endpoint</li>
                      <li style={{marginBottom: '8px'}}><strong>4. Usage:</strong> Agent performs tasks using the MCP</li>
                      <li><strong>5. Review:</strong> Agent submits performance feedback to E14Z</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>Python Example</h3>
                <pre className="text-mono text-small" style={{
                  backgroundColor: 'var(--color-canvas-default)',
                  color: 'var(--color-fg-default)',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-default)',
                  overflow: 'auto',
                  maxWidth: '100%',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}>
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
                <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>Claude Desktop Integration</h3>
                <pre className="text-mono text-small" style={{
                  backgroundColor: 'var(--color-canvas-default)',
                  color: 'var(--color-fg-default)',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-default)',
                  overflow: 'auto',
                  maxWidth: '100%',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}>
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
          <section className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">Rate Limits & Best Practices</h2>
            </div>
            <div className="Box-body">
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px'}}>
                <div>
                  <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>Rate Limits</h3>
                  <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px'}} className="text-small text-secondary">
                    <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className="text-accent">•</span> 1000 requests per hour per IP
                    </li>
                    <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className="text-accent">•</span> 100 requests per minute per IP
                    </li>
                    <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className="text-accent">•</span> No authentication required for basic usage
                    </li>
                    <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className="text-accent">•</span> Higher limits available for verified agents
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>Best Practices</h3>
                  <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px'}} className="text-small text-secondary">
                    <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className="text-accent">•</span> Cache discovery results when possible
                    </li>
                    <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className="text-accent">•</span> Always submit reviews after using MCPs
                    </li>
                    <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className="text-accent">•</span> Use specific search queries for better results
                    </li>
                    <li style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className="text-accent">•</span> Check health status before connecting
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Support */}
          <section className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">Support & Links</h2>
            </div>
            <div className="Box-body">
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px'}}>
                <div>
                  <h3 className="text-body text-primary" style={{marginBottom: '8px'}}>Documentation</h3>
                  <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px'}} className="text-small">
                    <li><a href="https://modelcontextprotocol.io" className="text-accent">MCP Protocol Spec</a></li>
                    <li><a href="/browse" className="text-accent">Browse All MCPs</a></li>
                    <li><a href="https://github.com/aemholland/e14z" className="text-accent">E14Z Source Code</a></li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-body text-primary" style={{marginBottom: '8px'}}>API Endpoints</h3>
                  <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px'}} className="text-small text-mono">
                    <li>GET /api/discover</li>
                    <li>POST /api/review</li>
                    <li>POST /api/submit</li>
                    <li>POST /mcp</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-body text-primary" style={{marginBottom: '8px'}}>Community</h3>
                  <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px'}} className="text-small">
                    <li><a href="https://github.com/aemholland/e14z/issues" className="text-accent">Report Issues</a></li>
                    <li><a href="https://github.com/aemholland/e14z/discussions" className="text-accent">Discussions</a></li>
                    <li><a href="/submit" className="text-accent">Submit Your MCP</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}