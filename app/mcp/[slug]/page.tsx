import { notFound } from 'next/navigation'
import { getMCPBySlug } from '@/lib/search/engine'
import { HealthBadge } from '@/components/mcp/HealthBadge'
import { MCPStats } from '@/components/mcp/MCPStats'
import { ConnectionGuide } from '@/components/mcp/ConnectionGuide'
import type { MCP } from '@/types'

interface PageProps {
  params: {
    slug: string
  }
}

export default async function MCPDetailPage({ params }: PageProps) {
  const mcp = await getMCPBySlug(params.slug)

  if (!mcp) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-8 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{mcp.name}</h1>
                {mcp.verified && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ✓ Verified
                  </span>
                )}
              </div>
              
              <p className="text-lg text-gray-600 mb-4">
                {mcp.description || 'No description available'}
              </p>
              
              <div className="flex items-center gap-4">
                <HealthBadge status={mcp.health_status} />
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-500 capitalize">
                  {mcp.connection_type} connection
                </span>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-500 capitalize">
                  {mcp.pricing_model}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              {mcp.github_url && (
                <a
                  href={mcp.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                  </svg>
                  View on GitHub
                </a>
              )}
              {mcp.documentation_url && (
                <a
                  href={mcp.documentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  📖 Documentation
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Connection Details */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Connection Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endpoint
                  </label>
                  <code className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono text-gray-900">
                    {mcp.endpoint}
                  </code>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Connection Type
                    </label>
                    <p className="text-sm text-gray-900 capitalize">{mcp.connection_type}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Protocol Version
                    </label>
                    <p className="text-sm text-gray-900">{mcp.protocol_version}</p>
                  </div>
                </div>

                {mcp.auth_method && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Authentication
                    </label>
                    <p className="text-sm text-gray-900 capitalize">{mcp.auth_method}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Capabilities */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Capabilities</h2>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                    mcp.capabilities.tools ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    🔧
                  </div>
                  <p className="text-sm font-medium">Tools</p>
                  <p className="text-xs text-gray-500">
                    {mcp.capabilities.tools ? 'Supported' : 'Not supported'}
                  </p>
                </div>
                
                <div className="text-center">
                  <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                    mcp.capabilities.resources ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    📁
                  </div>
                  <p className="text-sm font-medium">Resources</p>
                  <p className="text-xs text-gray-500">
                    {mcp.capabilities.resources ? 'Supported' : 'Not supported'}
                  </p>
                </div>
                
                <div className="text-center">
                  <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                    mcp.capabilities.prompts ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    💬
                  </div>
                  <p className="text-sm font-medium">Prompts</p>
                  <p className="text-xs text-gray-500">
                    {mcp.capabilities.prompts ? 'Supported' : 'Not supported'}
                  </p>
                </div>
              </div>
            </div>

            {/* Connection Guide */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Connection Guide</h2>
              <ConnectionGuide mcp={mcp} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Quick Info */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h3>
              
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-700">Category:</span>
                  <span className="ml-2 inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {mcp.category}
                  </span>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-gray-700">Pricing:</span>
                  <span className="ml-2 text-sm text-gray-900 capitalize">{mcp.pricing_model}</span>
                </div>
                
                {mcp.author && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Author:</span>
                    <span className="ml-2 text-sm text-gray-900">{mcp.author}</span>
                  </div>
                )}
                
                {mcp.license && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">License:</span>
                    <span className="ml-2 text-sm text-gray-900">{mcp.license}</span>
                  </div>
                )}
                
                <div>
                  <span className="text-sm font-medium text-gray-700">Added:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {new Date(mcp.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {mcp.tags.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {mcp.tags.map((tag) => (
                    <span 
                      key={tag}
                      className="inline-block bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Use Cases */}
            {mcp.use_cases.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Use Cases</h3>
                <ul className="space-y-2">
                  {mcp.use_cases.map((useCase) => (
                    <li key={useCase} className="text-sm text-gray-700">
                      • {useCase.replace('-', ' ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Performance Stats Placeholder */}
            <MCPStats mcpId={mcp.id} />
          </div>
        </div>
      </div>
    </div>
  )
}