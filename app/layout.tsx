import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'E14Z - AI Tool Discovery',
  description: 'The npm for AI agents. Discover and connect to MCP servers.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* GitHub-style header */}
        <header className="Header">
          <div className="container">
            <div className="Header-item">
              <a href="/" className="Header-link text-mono text-subtitle" style={{textDecoration: 'none'}}>
                E14Z
              </a>
            </div>
            <div className="Header-item">
              <span className="text-tertiary">/</span>
              <span className="text-secondary">MCP Registry</span>
            </div>
            <nav className="Header-item" style={{marginLeft: 'auto'}}>
              <a href="/" className="Header-link">Home</a>
              <a href="/browse" className="Header-link">Browse</a>
              <a href="/submit" className="Header-link">Submit</a>
              <a href="/docs" className="Header-link">Docs</a>
            </nav>
          </div>
        </header>
        
        {/* Main content */}
        <main>{children}</main>
        
        {/* GitHub-style footer */}
        <footer style={{backgroundColor: 'var(--color-canvas-subtle)', borderTop: '1px solid var(--color-border-default)', marginTop: '64px'}}>
          <div className="container" style={{padding: '48px 16px'}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', marginBottom: '32px'}}>
              {/* Company */}
              <div>
                <h3 className="text-subtitle" style={{marginBottom: '16px'}}>E14Z</h3>
                <p className="text-secondary" style={{marginBottom: '16px'}}>
                  The npm for AI agents. Discover, evaluate, and connect to MCP servers.
                </p>
                <div style={{display: 'flex', gap: '16px'}}>
                  <a href="https://github.com/e14z/e14z" className="text-accent">GitHub</a>
                  <a href="https://e14z.com" className="text-accent">Website</a>
                </div>
              </div>
              
              {/* Resources */}
              <div>
                <h4 className="text-small text-primary" style={{marginBottom: '16px'}}>Resources</h4>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <a href="/docs" className="text-secondary">Documentation</a>
                  <a href="/browse" className="text-secondary">Browse MCPs</a>
                  <a href="/submit" className="text-secondary">Submit MCP</a>
                  <a href="/api" className="text-secondary">API</a>
                </div>
              </div>
              
              {/* Community */}
              <div>
                <h4 className="text-small text-primary" style={{marginBottom: '16px'}}>Community</h4>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <a href="#" className="text-secondary">Discord</a>
                  <a href="#" className="text-secondary">Twitter</a>
                  <a href="#" className="text-secondary">Blog</a>
                  <a href="#" className="text-secondary">Support</a>
                </div>
              </div>
            </div>
            
            {/* Bottom */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '32px', borderTop: '1px solid var(--color-border-default)'}}>
              <p className="text-small text-tertiary">© 2024 E14Z. All rights reserved.</p>
              <div style={{display: 'flex', gap: '24px'}}>
                <a href="#" className="text-small text-tertiary">Privacy</a>
                <a href="#" className="text-small text-tertiary">Terms</a>
                <a href="#" className="text-small text-tertiary">Security</a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}