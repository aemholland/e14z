'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Copy, Check, Star, ExternalLink, Calendar, User, Shield, Zap } from 'lucide-react'
import { getMCPBySlug } from '@/lib/search/engine'
import { HealthBadge } from '@/components/mcp/HealthBadge'
import { MCPStats } from '@/components/mcp/MCPStats'
import { formatCategory, formatAuthMethod, formatUseCase, formatConnectionType } from '@/lib/utils/formatting'
import type { MCP } from '@/types'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copyToClipboard}
      className="btn btn-secondary"
      style={{
        fontSize: '12px',
        paddingTop: '4px',
        paddingBottom: '4px',
        paddingLeft: '8px',
        paddingRight: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={12} />
          Copied
        </>
      ) : (
        <>
          <Copy size={12} />
          Copy
        </>
      )}
    </button>
  )
}

export default async function MCPDetailPage({ params }: PageProps) {
  const { slug } = await params
  const mcp = await getMCPBySlug(slug)

  if (!mcp) {
    notFound()
  }

  return (
    <div className="container" style={{padding: '32px 24px'}}>
      {/* Back Button */}
      <div style={{marginBottom: '32px'}}>
        <a href="/browse" className="btn btn-secondary" style={{display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '8px 16px'}}>
          <ArrowLeft size={16} />
          Back to Browse
        </a>
      </div>
      
      {/* Header */}
      <div className="Box" style={{marginBottom: '40px'}}>
        <div className="Box-body" style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '32px'}}>
          <div style={{flex: 1}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
              <h1 className="text-title">{mcp.name.replace(/\s+(Official|Community)$/i, '')}</h1>
              {mcp.verified && (
                <span className="Label Label--success">Official</span>
              )}
              <HealthBadge status={mcp.health_status} />
            </div>
            
            <p className="text-body text-secondary" style={{marginBottom: '20px', lineHeight: '1.6'}}>
              {mcp.description || 'No description available'}
            </p>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '20px'}} className="text-small text-tertiary">
              {mcp.author && (
                <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <User size={16} />
                  <span>{mcp.author}</span>
                </div>
              )}
              <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                <Calendar size={16} />
                <span>{new Date(mcp.created_at).toLocaleDateString()}</span>
              </div>
              {mcp.rating && (
                <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <Star size={16} className="text-accent" />
                  <span>{mcp.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {mcp.github_url && (
              <a
                href={mcp.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '8px 16px'}}
              >
                <ExternalLink size={16} />
                View on GitHub
              </a>
            )}
            {mcp.documentation_url && (
              <a
                href={mcp.documentation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '8px 16px'}}
              >
                📖 Documentation
              </a>
            )}
          </div>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 320px', gap: '40px'}}>
        
        {/* Main Content */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '40px'}}>
          
          {/* Installation */}
          <div className="Box">
            <div className="Box-header">
              <h2 className="text-subtitle">Installation</h2>
            </div>
            <div className="Box-body" style={{padding: '24px'}}>
              {mcp.installation_methods && mcp.installation_methods.length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                  {mcp.installation_methods
                    .sort((a, b) => a.priority - b.priority)
                    .map((method, index) => (
                    <div key={index} className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                      <div className="Box-body">
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span className="Label Label--primary">
                              {method.type.toUpperCase()}
                            </span>
                            <span className="text-small text-primary">
                              {method.description || `${method.type} installation`}
                            </span>
                          </div>
                          <CopyButton text={method.command} />
                        </div>
                        <pre className="text-mono text-small" style={{
                          display: 'block',
                          padding: '12px',
                          backgroundColor: 'var(--color-canvas-default)',
                          border: '1px solid var(--color-border-muted)',
                          borderRadius: '6px',
                          overflow: 'auto',
                          margin: 0,
                          maxWidth: '100%',
                          wordWrap: 'break-word',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {method.command}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                  <div className="Box-body">
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px'}}>
                      <span className="text-small text-primary">Installation Command</span>
                      <CopyButton text={mcp.endpoint} />
                    </div>
                    <pre className="text-mono text-small" style={{
                      display: 'block',
                      padding: '12px',
                      backgroundColor: 'var(--color-canvas-default)',
                      border: '1px solid var(--color-border-muted)',
                      borderRadius: '6px',
                      overflow: 'auto',
                      margin: 0,
                      maxWidth: '100%',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {mcp.endpoint}
                    </pre>
                  </div>
                </div>
              )}
              
              <div style={{marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border-muted)'}}>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px'}}>
                  <div>
                    <span className="text-small text-tertiary">Connection Type</span>
                    <p className="text-small text-primary">{formatConnectionType(mcp.connection_type)}</p>
                  </div>
                  <div>
                    <span className="text-small text-tertiary">Protocol Version</span>
                    <p className="text-small text-primary">{mcp.protocol_version}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tools */}
          {(mcp.tools && mcp.tools.length > 0) || mcp.tool_endpoints.length > 0 ? (
            <div className="Box">
              <div className="Box-header">
                <h2 className="text-subtitle">Available Tools</h2>
              </div>
              <div className="Box-body">
                {mcp.tools && mcp.tools.length > 0 ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
                    {Object.entries(
                      mcp.tools.reduce((acc, tool) => {
                        const category = tool.category || 'Other'
                        if (!acc[category]) acc[category] = []
                        acc[category].push(tool)
                        return acc
                      }, {} as Record<string, typeof mcp.tools>)
                    ).map(([category, tools]) => (
                      <div key={category}>
                        <h3 className="text-body text-primary" style={{marginBottom: '12px', textTransform: 'capitalize'}}>{category}</h3>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                          {tools.map((tool, index) => (
                            <div key={index} className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                              <div className="Box-body" style={{display: 'flex', alignItems: 'flex-start', gap: '12px'}}>
                                <Zap size={16} className="text-accent" style={{marginTop: '2px', flexShrink: 0}} />
                                <div style={{flex: 1}}>
                                  <code className="text-small text-mono text-primary">{tool.name}</code>
                                  {tool.description && (
                                    <p className="text-small text-secondary" style={{marginTop: '4px'}}>{tool.description}</p>
                                  )}
                                  {tool.parameters && tool.parameters.length > 0 && (
                                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px'}}>
                                      {tool.parameters.map((param, paramIndex) => (
                                        <span key={paramIndex} className="Label Label--secondary">
                                          {param}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    <div style={{paddingTop: '16px', borderTop: '1px solid var(--color-border-muted)'}}>
                      <p className="text-small text-tertiary">
                        {mcp.tools.length} tool{mcp.tools.length !== 1 ? 's' : ''} available
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                    {mcp.tool_endpoints.map((endpoint, index) => (
                      <div key={index} className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                        <div className="Box-body" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <Zap size={14} className="text-accent" />
                          <code className="text-small text-mono text-primary">{endpoint}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

        </div>

        {/* Sidebar */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '32px'}}>
          
          {/* Quick Info */}
          <div className="Box">
            <div className="Box-header">
              <h3 className="text-body text-primary">Quick Info</h3>
            </div>
            <div className="Box-body">
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}} className="text-small">
                
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span className="text-tertiary">Connection:</span>
                  <span className="text-secondary">{formatConnectionType(mcp.connection_type)}</span>
                </div>
                
                {mcp.license && (
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span className="text-tertiary">License:</span>
                    <span className="text-secondary">{mcp.license}</span>
                  </div>
                )}
                
                {mcp.auth_method && (
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span className="text-tertiary">Auth:</span>
                    <span className="text-secondary">{formatAuthMethod(mcp.auth_method)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Use Cases */}
          {mcp.use_cases.length > 0 && (
            <div className="Box">
              <div className="Box-header">
                <h3 className="text-body text-primary">Use Cases</h3>
              </div>
              <div className="Box-body">
                <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  {mcp.use_cases.map((useCase) => (
                    <li key={useCase} className="text-small text-secondary" style={{display: 'flex', alignItems: 'flex-start', gap: '8px'}}>
                      <span className="text-accent" style={{marginTop: '2px'}}>•</span>
                      <span>{formatUseCase(useCase)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}


          {/* Performance Stats */}
          <MCPStats mcpId={mcp.id} />
        </div>
      </div>
    </div>
  )
}