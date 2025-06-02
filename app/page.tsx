'use client'

import { Search, Code2, Link, ExternalLink } from 'lucide-react'

export default function Home() {
  return (
    <div className="container" style={{padding: '64px 16px'}}>
      {/* Hero Section */}
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '64px'}}>
        <h1 className="text-title" style={{marginBottom: '24px'}}>
          The npm for <span className="text-accent">AI agents</span>
        </h1>
        <p className="text-body text-secondary" style={{marginBottom: '32px', maxWidth: '32rem'}}>
          Discover, evaluate, and connect to Model Context Protocol (MCP) servers. 
          Build powerful AI applications with curated, reliable tools.
        </p>
        
        {/* Search Bar */}
        <div style={{width: '100%', maxWidth: '32rem', marginBottom: '32px'}}>
          <div style={{display: 'flex'}}>
            <div style={{position: 'relative', flex: 1}}>
              <Search className="text-tertiary" size={16} style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)'}} />
              <input
                type="text"
                placeholder="Search MCP servers... (e.g., 'github', 'slack', 'database')"
                className="form-control text-body"
                style={{paddingLeft: '40px', paddingRight: '16px', paddingTop: '12px', paddingBottom: '12px', width: '100%'}}
              />
            </div>
            <button className="btn btn-primary" style={{marginLeft: '8px', paddingLeft: '24px', paddingRight: '24px'}}>
              Search
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{display: 'flex', gap: '16px'}}>
          <a href="/browse" className="btn btn-primary">
            Browse MCPs
          </a>
          <a href="/submit" className="btn btn-secondary">
            Submit MCP
          </a>
        </div>
      </div>

      {/* Featured MCPs */}
      <div style={{marginBottom: '64px'}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px'}}>
          <h2 className="text-subtitle">Trending MCPs</h2>
          <a href="/browse" className="text-accent">View all →</a>
        </div>
        
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px'}}>
          {[
            {
              name: 'GitHub',
              description: 'Interact with GitHub repositories, issues, and pull requests directly from your AI agent.',
              category: 'Development',
              verified: true,
              slug: 'github'
            },
            {
              name: 'Stripe',
              description: 'Process payments, manage customers, and handle subscriptions with the official Stripe MCP.',
              category: 'Payment Processing',
              verified: true,
              slug: 'stripe'
            },
            {
              name: 'MongoDB',
              description: 'Query and manage MongoDB databases with intelligent schema understanding.',
              category: 'Database',
              verified: false,
              slug: 'mongodb'
            }
          ].map((mcp, idx) => {
            return (
            <a key={idx} href={`/mcp/${mcp.slug}`} style={{textDecoration: 'none'}}>
              <div className="Box" style={{height: '100%', transition: 'all 0.2s ease', cursor: 'pointer'}} onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.borderColor = 'var(--color-border-muted)'
              }} onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = 'var(--color-border-default)'
              }}>
                <div className="Box-body" style={{padding: '24px'}}>
                  <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', flex: 1}}>
                      <h3 className="text-body text-primary" style={{margin: 0}}>{mcp.name}</h3>
                      {mcp.verified && (
                        <span className="Label Label--success">Official</span>
                      )}
                    </div>
                    <div className="status-indicator status-indicator--success"></div>
                  </div>
                  
                  <p className="text-small text-secondary" style={{marginBottom: '0', lineHeight: '1.6', minHeight: '48px'}}>
                    {mcp.description}
                  </p>
                </div>
              </div>
            </a>
          )})
        }
        </div>
      </div>

      {/* Connect to E14Z MCP */}
      <div className="Box" style={{marginBottom: '64px'}}>
        <div className="Box-body" style={{padding: '32px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{flex: 1}}>
              <h2 className="text-subtitle" style={{marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px'}}>
                <Link size={24} className="text-accent" />
                Connect to E14Z MCP
              </h2>
              <p className="text-secondary" style={{marginBottom: '24px', maxWidth: '500px'}}>
                Use our E14Z MCP server to discover and connect to any MCP in our registry directly from your AI agent. 
                Browse, search, and get installation instructions without leaving your conversation.
              </p>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px'}}>
                <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                  <div className="Box-body" style={{padding: '16px'}}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span className="text-small text-primary font-semibold">AI Agents</span>
                      <button className="btn btn-sm" style={{fontSize: '12px'}} onClick={() => navigator.clipboard.writeText('npx e14z-mcp')}>
                        Copy
                      </button>
                    </div>
                    <code className="text-mono text-small" style={{color: 'var(--color-fg-default)'}}>
                      npx e14z-mcp
                    </code>
                  </div>
                </div>
                
                <div className="Box" style={{backgroundColor: 'var(--color-canvas-inset)'}}>
                  <div className="Box-body" style={{padding: '16px'}}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px'}}>
                      <span className="text-small text-primary font-semibold">Docker</span>
                      <button className="btn btn-sm" style={{fontSize: '12px'}} onClick={() => navigator.clipboard.writeText('docker run -i --rm e14z/mcp-server')}>
                        Copy
                      </button>
                    </div>
                    <code className="text-mono text-small" style={{color: 'var(--color-fg-default)'}}>
                      docker run -i --rm e14z/mcp-server
                    </code>
                  </div>
                </div>
              </div>
              
              <div style={{display: 'flex', gap: '16px'}}>
                <a href="/docs" className="btn btn-primary">
                  <ExternalLink size={16} style={{marginRight: '8px'}} />
                  Setup Guide
                </a>
                <a href="/mcp/e14z" className="btn btn-secondary">
                  View Documentation
                </a>
              </div>
            </div>
            
            <div style={{fontSize: '4rem', opacity: 0.1, marginLeft: '32px'}} className="text-tertiary">
              <Link size={120} />
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={{marginBottom: '64px'}}>
        <h2 className="text-subtitle" style={{marginBottom: '32px'}}>Browse by Category</h2>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px'}}>
          {[
            { name: 'Development', count: 8, icon: Code2 },
            { name: 'Communication', count: 4, icon: Search },
            { name: 'Database', count: 3, icon: Search },
            { name: 'Payment Processing', count: 2, icon: Search },
            { name: 'Infrastructure', count: 2, icon: Search },
            { name: 'Productivity', count: 1, icon: Search }
          ].map((category, idx) => (
            <a
              key={idx}
              href={`/browse?category=${category.name.toLowerCase()}`}
              className="Box hover-lift"
              style={{textDecoration: 'none'}}
            >
              <div className="Box-body" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <category.icon size={20} className="text-accent" />
                  <div>
                    <div className="text-small text-primary">{category.name}</div>
                    <div className="text-small text-tertiary">{category.count} servers</div>
                  </div>
                </div>
                <div className="text-tertiary">→</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Developer Section */}
      <div className="Box">
        <div className="Box-body" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div>
            <h2 className="text-subtitle" style={{marginBottom: '8px'}}>For Developers</h2>
            <p className="text-secondary" style={{marginBottom: '16px'}}>
              Build and submit your own MCP servers. Join our community of developers
              creating the future of AI tooling.
            </p>
            <div style={{display: 'flex', gap: '16px'}}>
              <a href="/docs" className="btn btn-primary">
                Get Started
              </a>
              <a href="/submit" className="btn btn-secondary">
                Submit MCP
              </a>
            </div>
          </div>
          <div style={{fontSize: '4rem', opacity: 0.2}} className="text-tertiary">
            <Code2 size={80} />
          </div>
        </div>
      </div>
    </div>
  )
}