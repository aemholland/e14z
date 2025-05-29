'use client'

import { useState } from 'react'
import type { MCP } from '@/types'

interface ConnectionGuideProps {
  mcp: MCP
}

interface CodeBlockProps {
  code: string
  language?: string
  title?: string
}

function CodeBlock({ code, language = 'bash', title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">{title}</h4>
        </div>
      )}
      <div className="relative">
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
          <code>{code}</code>
        </pre>
        <button
          onClick={copyToClipboard}
          className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export function ConnectionGuide({ mcp }: ConnectionGuideProps) {
  // Use new installation_methods if available, otherwise fall back to old logic
  if (mcp.installation_methods && mcp.installation_methods.length > 0) {
    const primaryMethod = mcp.installation_methods.sort((a, b) => a.priority - b.priority)[0]
    
    return (
      <div className="space-y-6">
        {/* Installation Methods */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Installation Options</h4>
          <div className="space-y-3">
            {mcp.installation_methods.map((method, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {method.type.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {method.description || `${method.type} installation`}
                    </span>
                    {index === 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                        Recommended
                      </span>
                    )}
                  </div>
                </div>
                <CodeBlock code={method.command} />
              </div>
            ))}
          </div>
        </div>

        {/* Connection Details */}
        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Connection Type:
              </label>
              <p className="text-sm text-gray-900">{mcp.connection_type}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protocol Version:
              </label>
              <p className="text-sm text-gray-900">{mcp.protocol_version}</p>
            </div>
          </div>
          
          {mcp.auth_method && mcp.auth_method !== 'none' && mcp.auth_method !== 'None Required' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Authentication:
              </label>
              <p className="text-sm text-gray-900">{mcp.auth_method}</p>
            </div>
          )}
        </div>

        {/* GitHub Documentation Link */}
        {mcp.github_url && (
          <div className="pt-4 border-t border-gray-200">
            <a 
              href={mcp.github_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
              Complete setup guide on GitHub
            </a>
          </div>
        )}
      </div>
    )
  }

  const getSetupInfo = () => {
    // Get setup info based on the actual server requirements
    switch (mcp.name) {
      case 'GitHub Official':
        return {
          endpoint: 'ghcr.io/github/github-mcp-server',
          directUsage: 'docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server',
          authInfo: {
            title: 'GitHub Personal Access Token Required',
            description: 'Create a Personal Access Token at GitHub Settings > Developer settings > Personal access tokens.',
            envVar: 'GITHUB_PERSONAL_ACCESS_TOKEN',
            placeholder: 'ghp_your_token_here'
          }
        }
      
      case 'Notion Official':
        return {
          endpoint: 'npx @notionhq/notion-mcp-server',
          directUsage: 'npx @notionhq/notion-mcp-server',
          authInfo: {
            title: 'Notion Integration Token Required',
            description: 'Create an internal integration at notion.so/profile/integrations.',
            envVar: 'NOTION_INTEGRATION_TOKEN',
            placeholder: 'secret_your_integration_token'
          }
        }
      
      case 'Stripe Official':
        return {
          endpoint: 'npx @stripe/mcp',
          directUsage: 'npx @stripe/mcp --api-key=YOUR_KEY',
          authInfo: {
            title: 'Stripe Secret Key Required',
            description: 'Get your Secret key from Stripe Dashboard > Developers > API keys.',
            envVar: 'STRIPE_SECRET_KEY',
            placeholder: 'sk_test_your_secret_key'
          }
        }

      case 'Box Official':
        return {
          endpoint: 'uv run src/mcp_server_box.py',
          directUsage: 'git clone https://github.com/box-community/mcp-server-box && cd mcp-server-box && uv run src/mcp_server_box.py',
          authInfo: {
            title: 'Box API Credentials Required',
            description: 'Create a Box app at developer.box.com and get your Client ID and Client Secret.',
            envVar: 'BOX_CLIENT_ID, BOX_CLIENT_SECRET',
            placeholder: 'your_client_id, your_client_secret'
          }
        }

      case 'Buildkite Official':
        return {
          endpoint: 'ghcr.io/buildkite/buildkite-mcp-server',
          directUsage: 'docker run -i --rm -e BUILDKITE_API_TOKEN ghcr.io/buildkite/buildkite-mcp-server stdio',
          authInfo: {
            title: 'Buildkite API Token Required',
            description: 'Create an API token at buildkite.com/user/api-access-tokens.',
            envVar: 'BUILDKITE_API_TOKEN'
          }
        }

      case 'CircleCI Official':
        return {
          endpoint: 'npx @circleci/mcp-server-circleci',
          directUsage: 'npx -y @circleci/mcp-server-circleci',
          authInfo: {
            title: 'CircleCI API Token Required',
            description: 'Create a personal API token at app.circleci.com/settings/user/tokens.',
            envVar: 'CIRCLECI_TOKEN'
          }
        }

      case 'Cloudflare Official':
        return {
          endpoint: 'https://observability.mcp.cloudflare.com/sse',
          directUsage: 'npx mcp-remote https://observability.mcp.cloudflare.com/sse',
          authInfo: null
        }

      case 'Docker':
        return {
          endpoint: 'uvx docker-mcp',
          directUsage: 'uvx docker-mcp',
          authInfo: {
            title: 'Docker Required',
            description: 'Make sure Docker Desktop or Docker Engine is running on your system.',
            envVar: 'N/A'
          }
        }

      case 'ElevenLabs Official':
        return {
          endpoint: 'uvx elevenlabs-mcp',
          directUsage: 'uvx elevenlabs-mcp',
          authInfo: {
            title: 'ElevenLabs API Key Required',
            description: 'Get your API key from elevenlabs.io/speech-synthesis.',
            envVar: 'ELEVENLABS_API_KEY'
          }
        }

      case 'Home Assistant':
        return {
          endpoint: 'voska/hass-mcp',
          directUsage: 'docker run -i --rm -e HA_URL -e HA_TOKEN voska/hass-mcp',
          authInfo: {
            title: 'Home Assistant Long-Lived Access Token Required',
            description: 'Create a long-lived access token in Home Assistant Settings > Security.',
            envVar: 'HA_URL, HA_TOKEN'
          }
        }

      case 'Linear':
        return {
          endpoint: 'npx @tacticlaunch/mcp-linear',
          directUsage: 'npx -y @tacticlaunch/mcp-linear',
          authInfo: {
            title: 'Linear API Token Required',
            description: 'Create an API token at linear.app/settings/api.',
            envVar: 'LINEAR_API_TOKEN'
          }
        }

      case 'MongoDB':
        return {
          endpoint: 'npx mongo-mcp',
          directUsage: 'npx mongo-mcp "mongodb://username:password@host:port/database"',
          authInfo: {
            title: 'MongoDB Connection String Required',
            description: 'Provide your MongoDB connection string with credentials.',
            envVar: 'MONGODB_CONNECTION_STRING'
          }
        }

      case 'Slack Community':
        return {
          endpoint: 'npx slack-mcp-server',
          directUsage: 'npx -y slack-mcp-server@latest --transport stdio',
          authInfo: {
            title: 'Slack Browser Tokens Required',
            description: 'Extract XOXC and XOXD tokens from your browser while logged into Slack.',
            envVar: 'SLACK_MCP_XOXC_TOKEN, SLACK_MCP_XOXD_TOKEN'
          }
        }

      case 'Todoist':
        return {
          endpoint: 'npx todoist-mcp',
          directUsage: 'npx -y todoist-mcp',
          authInfo: {
            title: 'Todoist API Token Required',
            description: 'Get your API token from Todoist Settings > Integrations.',
            envVar: 'API_KEY'
          }
        }
      
      default:
        // Generic setup for community servers
        return {
          endpoint: mcp.endpoint,
          directUsage: mcp.endpoint + (mcp.auth_method && mcp.auth_method !== 'none' && mcp.auth_method !== 'None Required' ? ' --api-key=YOUR_KEY' : ''),
          authInfo: mcp.auth_method && mcp.auth_method !== 'none' && mcp.auth_method !== 'None Required' ? {
            title: 'Authentication Required',
            description: 'This server requires authentication. Check the GitHub repository for specific setup instructions.',
            envVar: `${mcp.slug.toUpperCase().replace(/[-_]/g, '_')}_API_KEY`
          } : null
        }
    }
  }

  const setup = getSetupInfo()

  return (
    <div className="space-y-6">
      {/* Connection Details */}
      <div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Installation Command:
            </label>
            <div className="relative">
              <code className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono text-gray-900 whitespace-pre-wrap break-all">
                {setup.endpoint}
              </code>
              {mcp.install_type && (
                <span className="absolute top-2 right-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {mcp.install_type}
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type:
              </label>
              <p className="text-sm text-gray-900">{mcp.connection_type}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protocol:
              </label>
              <p className="text-sm text-gray-900">{mcp.protocol_version}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Direct Usage */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Complete Installation:</h4>
        <CodeBlock 
          code={setup.directUsage}
        />
      </div>

      {/* Authentication */}
      {setup.authInfo && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Authentication:</h4>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="font-medium text-blue-800">{setup.authInfo.title}</h4>
                <p className="text-sm text-blue-700 mt-1 mb-3">
                  {setup.authInfo.description}
                </p>
                <div className="bg-white rounded border p-2">
                  <code className="text-sm text-gray-800">
                    {setup.authInfo.envVar}="{setup.authInfo.placeholder || 'your_key_here'}"
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* GitHub Documentation Link */}
      {mcp.github_url && (
        <div className="pt-4 border-t border-gray-200">
          <a 
            href={mcp.github_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
            Complete setup guide on GitHub
          </a>
        </div>
      )}
    </div>
  )
}