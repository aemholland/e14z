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
      <div style={{backgroundColor: 'var(--color-canvas-default)', minHeight: '100vh'}}>
        <div className="container" style={{maxWidth: '56rem', padding: '64px 24px'}}>
          <div className="Box" style={{textAlign: 'center'}}>
            <div className="Box-body">
              <div style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 16px',
                backgroundColor: 'var(--color-success-subtle)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg style={{width: '32px', height: '32px'}} className="text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h1 className="text-subtitle" style={{marginBottom: '16px'}}>MCP Submitted Successfully!</h1>
              <p className="text-secondary" style={{marginBottom: '24px'}}>{success.message}</p>
              
              <div className="Box" style={{backgroundColor: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-muted)', marginBottom: '24px'}}>
                <div className="Box-body">
                  <h3 className="text-body text-primary" style={{marginBottom: '8px'}}>Next Steps:</h3>
                  <ul style={{listStyle: 'none', padding: 0, margin: 0, textAlign: 'left'}} className="text-small">
                    {success.next_steps?.map((step: string, index: number) => (
                      <li key={index} style={{marginBottom: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px'}}>
                        <span className="text-accent">•</span> {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px'}} className="text-small">
                <div>
                  <strong>MCP Name:</strong> {success.mcp?.name}
                </div>
                <div>
                  <strong>Status:</strong> <span className="Label Label--attention">Pending Review</span>
                </div>
                <div>
                  <strong>URL:</strong>{' '}
                  <a 
                    href={success.mcp?.url}
                    className="text-accent"
                  >
                    {success.mcp?.url}
                  </a>
                </div>
              </div>

              <div style={{display: 'flex', gap: '16px', justifyContent: 'center'}}>
                <button
                  onClick={() => router.push('/browse')}
                  className="btn btn-primary"
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
                  className="btn btn-secondary"
                >
                  Submit Another
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{backgroundColor: 'var(--color-canvas-default)', minHeight: '100vh'}}>
      <div className="container" style={{maxWidth: '56rem', padding: '32px 24px'}}>
        
        {/* Header */}
        <div style={{marginBottom: '32px'}}>
          <h1 className="text-title" style={{marginBottom: '16px'}}>Submit New MCP</h1>
          <p className="text-body text-secondary">
            Add your MCP server to the E14Z directory for AI agents to discover
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '32px'}}>
          
          {/* Basic Information */}
          <div className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">Basic Information</h2>
            </div>
            <div className="Box-body" style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
              
              <div>
                <label htmlFor="name" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  className="form-control"
                  placeholder="My Awesome MCP"
                />
              </div>

              <div>
                <label htmlFor="description" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                  Description *
                </label>
                <textarea
                  id="description"
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  className="form-control"
                  placeholder="Describe what your MCP does and how it helps AI agents..."
                  style={{resize: 'vertical'}}
                />
              </div>

              <div>
                <label htmlFor="endpoint" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                  Endpoint *
                </label>
                <input
                  type="text"
                  id="endpoint"
                  required
                  value={formData.endpoint}
                  onChange={(e) => updateFormData('endpoint', e.target.value)}
                  className="form-control"
                  placeholder="npx @myorg/my-mcp-server"
                />
                <p className="text-small text-tertiary" style={{marginTop: '4px'}}>
                  Command to run your MCP server (stdio) or URL (http/websocket)
                </p>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px'}}>
                <div>
                  <label htmlFor="connection_type" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                    Connection Type *
                  </label>
                  <select
                    id="connection_type"
                    value={formData.connection_type}
                    onChange={(e) => updateFormData('connection_type', e.target.value)}
                    className="form-control"
                  >
                    <option value="stdio">stdio (Command Line)</option>
                    <option value="http">HTTP (REST API)</option>
                    <option value="websocket">WebSocket</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="category" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                    Category *
                  </label>
                  <select
                    id="category"
                    required
                    value={formData.category}
                    onChange={(e) => updateFormData('category', e.target.value)}
                    className="form-control"
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
                <label htmlFor="tags" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                  Tags
                </label>
                <input
                  type="text"
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => updateFormData('tags', e.target.value)}
                  className="form-control"
                  placeholder="database, sql, mysql"
                />
                <p className="text-small text-tertiary" style={{marginTop: '4px'}}>
                  Comma-separated tags that describe your MCP
                </p>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">Technical Details</h2>
            </div>
            <div className="Box-body" style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
              
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px'}}>
                <div>
                  <label htmlFor="auth_method" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                    Authentication
                  </label>
                  <select
                    id="auth_method"
                    value={formData.auth_method}
                    onChange={(e) => updateFormData('auth_method', e.target.value)}
                    className="form-control"
                  >
                    <option value="none">None</option>
                    <option value="api_key">API Key</option>
                    <option value="oauth">OAuth</option>
                    <option value="bot_token">Bot Token</option>
                    <option value="credentials">Username/Password</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="pricing_model" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                    Pricing Model
                  </label>
                  <select
                    id="pricing_model"
                    value={formData.pricing_model}
                    onChange={(e) => updateFormData('pricing_model', e.target.value)}
                    className="form-control"
                  >
                    <option value="free">Free</option>
                    <option value="usage">Usage-based</option>
                    <option value="subscription">Subscription</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-small text-tertiary" style={{display: 'block', marginBottom: '12px'}}>
                  MCP Capabilities
                </label>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                    <input
                      type="checkbox"
                      checked={formData.capabilities.tools}
                      onChange={(e) => updateCapabilities('tools', e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: 'var(--color-canvas-default)',
                        accentColor: 'var(--color-accent-fg)'
                      }}
                    />
                    <span className="text-small">Tools - Execute functions and commands</span>
                  </label>
                  <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                    <input
                      type="checkbox"
                      checked={formData.capabilities.resources}
                      onChange={(e) => updateCapabilities('resources', e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: 'var(--color-canvas-default)',
                        accentColor: 'var(--color-accent-fg)'
                      }}
                    />
                    <span className="text-small">Resources - Provide files, data, or content</span>
                  </label>
                  <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                    <input
                      type="checkbox"
                      checked={formData.capabilities.prompts}
                      onChange={(e) => updateCapabilities('prompts', e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: 'var(--color-canvas-default)',
                        accentColor: 'var(--color-accent-fg)'
                      }}
                    />
                    <span className="text-small">Prompts - Provide reusable prompt templates</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Links & Metadata */}
          <div className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">Links & Metadata</h2>
            </div>
            <div className="Box-body" style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
              
              <div>
                <label htmlFor="github_url" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                  GitHub Repository
                </label>
                <input
                  type="url"
                  id="github_url"
                  value={formData.github_url}
                  onChange={(e) => updateFormData('github_url', e.target.value)}
                  className="form-control"
                  placeholder="https://github.com/username/my-mcp-server"
                />
              </div>

              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px'}}>
                <div>
                  <label htmlFor="documentation_url" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                    Documentation URL
                  </label>
                  <input
                    type="url"
                    id="documentation_url"
                    value={formData.documentation_url}
                    onChange={(e) => updateFormData('documentation_url', e.target.value)}
                    className="form-control"
                    placeholder="https://docs.example.com"
                  />
                </div>

                <div>
                  <label htmlFor="website_url" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                    Website URL
                  </label>
                  <input
                    type="url"
                    id="website_url"
                    value={formData.website_url}
                    onChange={(e) => updateFormData('website_url', e.target.value)}
                    className="form-control"
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
                <div>
                  <label htmlFor="author" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                    Author
                  </label>
                  <input
                    type="text"
                    id="author"
                    value={formData.author}
                    onChange={(e) => updateFormData('author', e.target.value)}
                    className="form-control"
                    placeholder="Your Name"
                  />
                </div>

                <div>
                  <label htmlFor="company" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                    Company
                  </label>
                  <input
                    type="text"
                    id="company"
                    value={formData.company}
                    onChange={(e) => updateFormData('company', e.target.value)}
                    className="form-control"
                    placeholder="Company Name"
                  />
                </div>

                <div>
                  <label htmlFor="license" className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
                    License
                  </label>
                  <input
                    type="text"
                    id="license"
                    value={formData.license}
                    onChange={(e) => updateFormData('license', e.target.value)}
                    className="form-control"
                    placeholder="MIT, Apache-2.0, etc."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flash flash-error">
              <div style={{display: 'flex', alignItems: 'flex-start', gap: '12px'}}>
                <div style={{flexShrink: 0}}>
                  <svg style={{width: '20px', height: '20px'}} className="text-danger" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-small">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="Box">
            <div className="Box-body" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <div>
                <h3 className="text-body text-primary" style={{marginBottom: '4px'}}>Ready to Submit?</h3>
                <p className="text-small text-secondary">
                  Your MCP will be reviewed before appearing in search results
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{display: 'flex', alignItems: 'center', gap: '8px'}}
              >
                {loading && (
                  <svg style={{width: '16px', height: '16px', animation: 'spin 1s linear infinite'}} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle style={{opacity: 0.25}} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path style={{opacity: 0.75}} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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