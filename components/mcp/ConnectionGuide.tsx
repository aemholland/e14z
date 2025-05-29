import type { MCP } from '@/types'

interface ConnectionGuideProps {
  mcp: MCP
}

export function ConnectionGuide({ mcp }: ConnectionGuideProps) {
  const getConnectionExample = () => {
    switch (mcp.connection_type) {
      case 'stdio':
        return {
          title: 'Connect via stdio (Command Line)',
          example: `# Install the MCP server
${mcp.endpoint}

# Or use with Claude Desktop by adding to config:
{
  "mcpServers": {
    "${mcp.slug}": {
      "command": "${mcp.endpoint.replace('npx -y ', 'npx')}",
      "args": []
    }
  }
}`
        }
      
      case 'http':
        return {
          title: 'Connect via HTTP',
          example: `# Connect to HTTP endpoint
curl -X POST "${mcp.endpoint}" \\
  -H "Content-Type: application/json" \\
  ${mcp.auth_method === 'api_key' ? '-H "Authorization: Bearer YOUR_API_KEY" \\' : ''}
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "${mcp.protocol_version}",
      "capabilities": ${JSON.stringify(mcp.capabilities, null, 6)}
    },
    "id": 1
  }'`
        }
      
      case 'websocket':
        return {
          title: 'Connect via WebSocket',
          example: `# Connect to WebSocket endpoint
const ws = new WebSocket("${mcp.endpoint}");

ws.onopen = function() {
  // Send initialization message
  ws.send(JSON.stringify({
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "${mcp.protocol_version}",
      "capabilities": ${JSON.stringify(mcp.capabilities, null, 6)}
    },
    "id": 1
  }));
};`
        }
      
      default:
        return {
          title: 'Connection Information',
          example: `# Endpoint: ${mcp.endpoint}
# Type: ${mcp.connection_type}
# Protocol: ${mcp.protocol_version}`
        }
    }
  }

  const getAuthExample = () => {
    if (!mcp.auth_method || mcp.auth_method === 'none') return null
    
    switch (mcp.auth_method) {
      case 'api_key':
        return {
          title: 'Authentication Required',
          example: `# Set your API key as environment variable
export ${mcp.slug.toUpperCase().replace('-', '_')}_API_KEY="your_api_key_here"

# Or pass it when running:
${mcp.endpoint} --api-key="your_api_key_here"`
        }
      
      case 'oauth':
        return {
          title: 'OAuth Authentication',
          example: `# OAuth flow required
# 1. Get authorization URL
# 2. User authorizes application  
# 3. Exchange code for access token
# 4. Use access token in requests

export ${mcp.slug.toUpperCase().replace('-', '_')}_ACCESS_TOKEN="your_access_token"`
        }
      
      case 'bot_token':
        return {
          title: 'Bot Token Required',
          example: `# Set bot token as environment variable
export ${mcp.slug.toUpperCase().replace('-', '_')}_BOT_TOKEN="your_bot_token"

# Get token from your platform's developer portal`
        }
      
      case 'credentials':
        return {
          title: 'Credentials Required',
          example: `# Set credentials as environment variables
export ${mcp.slug.toUpperCase().replace('-', '_')}_USERNAME="your_username"
export ${mcp.slug.toUpperCase().replace('-', '_')}_PASSWORD="your_password"`
        }
      
      default:
        return {
          title: 'Authentication Required',
          example: `# Authentication method: ${mcp.auth_method}
# Check documentation for specific requirements`
        }
    }
  }

  const connectionExample = getConnectionExample()
  const authExample = getAuthExample()

  return (
    <div className="space-y-6">
      {/* Main Connection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{connectionExample.title}</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{connectionExample.example}</code>
        </pre>
      </div>

      {/* Authentication */}
      {authExample && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{authExample.title}</h3>
          <pre className="bg-orange-50 border border-orange-200 text-orange-900 p-4 rounded-lg overflow-x-auto text-sm">
            <code>{authExample.example}</code>
          </pre>
        </div>
      )}

      {/* E14Z Discovery */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Discover via E14Z API</h3>
        <pre className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{`# Search for this MCP
curl "https://e14z.com/api/discover?q=${encodeURIComponent(mcp.name)}"

# Get connection details and health status
# Response includes endpoint, auth requirements, and capabilities`}</code>
        </pre>
      </div>

      {/* Claude Desktop Config */}
      {mcp.connection_type === 'stdio' && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Claude Desktop Configuration</h3>
          <pre className="bg-purple-50 border border-purple-200 text-purple-900 p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`{
  "mcpServers": {
    "${mcp.slug}": {
      "command": "${mcp.endpoint.replace('npx -y ', 'npx')}",
      "args": []${mcp.auth_method && mcp.auth_method !== 'none' ? `,
      "env": {
        "${mcp.slug.toUpperCase().replace('-', '_')}_API_KEY": "your_api_key_here"
      }` : ''}
    }
  }
}`}</code>
          </pre>
          <p className="text-sm text-gray-600 mt-2">
            Add this to your Claude Desktop configuration file
          </p>
        </div>
      )}

      {/* Capabilities Info */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Available Capabilities</h3>
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className={`text-center p-2 rounded ${mcp.capabilities.tools ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <strong>Tools:</strong> {mcp.capabilities.tools ? 'Available' : 'Not available'}
            </div>
            <div className={`text-center p-2 rounded ${mcp.capabilities.resources ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <strong>Resources:</strong> {mcp.capabilities.resources ? 'Available' : 'Not available'}
            </div>
            <div className={`text-center p-2 rounded ${mcp.capabilities.prompts ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <strong>Prompts:</strong> {mcp.capabilities.prompts ? 'Available' : 'Not available'}
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Link */}
      {mcp.github_url && (
        <div className="pt-4 border-t">
          <p className="text-sm text-gray-600">
            📖 For detailed setup instructions and examples, see the{' '}
            <a 
              href={mcp.github_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              GitHub repository
            </a>
          </p>
        </div>
      )}
    </div>
  )
}