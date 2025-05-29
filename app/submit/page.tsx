'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SubmitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<any>()

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    endpoint: '',
    connection_type: 'stdio',
    category: '',
    tags: '',
    github_url: '',
    documentation_url: '',
    website_url: '',
    auth_method: 'none',
    pricing_model: 'free',
    author: '',
    company: '',
    license: '',
    capabilities: {
      tools: true,
      resources: false,
      prompts: false
    }
  })

  const categories = [
    'search',
    'database', 
    'file-system',
    'communication',
    'development',
    'ai-models',
    'web',
    'productivity',
    'document-processing',
    'cloud-storage',
    'data',
    'other'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(undefined)
    setSuccess(undefined)

    try {
      // Prepare data
      const submitData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        capabilities: formData.capabilities
      }

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed')
      }

      setSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updateCapabilities = (capability: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      capabilities: {
        ...prev.capabilities,
        [capability]: value
      }
    }))
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">MCP Submitted Successfully!</h1>
            <p className="text-gray-600 mb-6">{success.message}</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
              <ul className="text-sm text-blue-800 space-y-1 text-left">
                {success.next_steps?.map((step: string, index: number) => (
                  <li key={index}>• {step}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <strong>MCP Name:</strong> {success.mcp?.name}
              </div>
              <div>
                <strong>Status:</strong> <span className="text-orange-600">Pending Review</span>
              </div>
              <div>
                <strong>URL:</strong>{' '}
                <a 
                  href={success.mcp?.url}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  {success.mcp?.url}
                </a>
              </div>
            </div>

            <div className="mt-8 space-x-4">
              <button
                onClick={() => router.push('/browse')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Browse MCPs
              </button>
              <button
                onClick={() => {
                  setSuccess(undefined)
                  setFormData({
                    name: '',
                    description: '',
                    endpoint: '',
                    connection_type: 'stdio',
                    category: '',
                    tags: '',
                    github_url: '',
                    documentation_url: '',
                    website_url: '',
                    auth_method: 'none',
                    pricing_model: 'free',
                    author: '',
                    company: '',
                    license: '',
                    capabilities: { tools: true, resources: false, prompts: false }
                  })
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Submit Another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Submit New MCP</h1>
          <p className="text-lg text-gray-600">
            Add your MCP server to the E14Z directory for AI agents to discover
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="My Awesome MCP"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe what your MCP does and how it helps AI agents..."
                />
              </div>

              <div>
                <label htmlFor="endpoint" className="block text-sm font-medium text-gray-700 mb-2">
                  Endpoint *
                </label>
                <input
                  type="text"
                  id="endpoint"
                  required
                  value={formData.endpoint}
                  onChange={(e) => updateFormData('endpoint', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="npx @myorg/my-mcp-server"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Command to run your MCP server (stdio) or URL (http/websocket)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="connection_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Connection Type *
                  </label>
                  <select
                    id="connection_type"
                    value={formData.connection_type}
                    onChange={(e) => updateFormData('connection_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="stdio">stdio (Command Line)</option>
                    <option value="http">HTTP (REST API)</option>
                    <option value="websocket">WebSocket</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    id="category"
                    required
                    value={formData.category}
                    onChange={(e) => updateFormData('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => updateFormData('tags', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="database, sql, mysql"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated tags that describe your MCP
                </p>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Technical Details</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="auth_method" className="block text-sm font-medium text-gray-700 mb-2">
                    Authentication
                  </label>
                  <select
                    id="auth_method"
                    value={formData.auth_method}
                    onChange={(e) => updateFormData('auth_method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="none">None</option>
                    <option value="api_key">API Key</option>
                    <option value="oauth">OAuth</option>
                    <option value="bot_token">Bot Token</option>
                    <option value="credentials">Username/Password</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="pricing_model" className="block text-sm font-medium text-gray-700 mb-2">
                    Pricing Model
                  </label>
                  <select
                    id="pricing_model"
                    value={formData.pricing_model}
                    onChange={(e) => updateFormData('pricing_model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="free">Free</option>
                    <option value="usage">Usage-based</option>
                    <option value="subscription">Subscription</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  MCP Capabilities
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.capabilities.tools}
                      onChange={(e) => updateCapabilities('tools', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Tools - Execute functions and commands</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.capabilities.resources}
                      onChange={(e) => updateCapabilities('resources', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Resources - Provide files, data, or content</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.capabilities.prompts}
                      onChange={(e) => updateCapabilities('prompts', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Prompts - Provide reusable prompt templates</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Links & Metadata */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Links & Metadata</h2>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="github_url" className="block text-sm font-medium text-gray-700 mb-2">
                  GitHub Repository
                </label>
                <input
                  type="url"
                  id="github_url"
                  value={formData.github_url}
                  onChange={(e) => updateFormData('github_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://github.com/username/my-mcp-server"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="documentation_url" className="block text-sm font-medium text-gray-700 mb-2">
                    Documentation URL
                  </label>
                  <input
                    type="url"
                    id="documentation_url"
                    value={formData.documentation_url}
                    onChange={(e) => updateFormData('documentation_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://docs.example.com"
                  />
                </div>

                <div>
                  <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    id="website_url"
                    value={formData.website_url}
                    onChange={(e) => updateFormData('website_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-2">
                    Author
                  </label>
                  <input
                    type="text"
                    id="author"
                    value={formData.author}
                    onChange={(e) => updateFormData('author', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your Name"
                  />
                </div>

                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    id="company"
                    value={formData.company}
                    onChange={(e) => updateFormData('company', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Company Name"
                  />
                </div>

                <div>
                  <label htmlFor="license" className="block text-sm font-medium text-gray-700 mb-2">
                    License
                  </label>
                  <input
                    type="text"
                    id="license"
                    value={formData.license}
                    onChange={(e) => updateFormData('license', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="MIT, Apache-2.0, etc."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Ready to Submit?</h3>
                <p className="text-sm text-gray-600">
                  Your MCP will be reviewed before appearing in search results
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? 'Submitting...' : 'Submit MCP'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}