import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { MCP } from '@/types'
import { HealthBadge } from './HealthBadge'

interface MCPCardProps {
  mcp: MCP
  highlights?: {
    name?: string
    description?: string
  }
}

export function MCPCard({ mcp, highlights }: MCPCardProps) {
  return (
    <Link href={`/mcp/${mcp.slug}`} style={{textDecoration: 'none'}}>
      <div className="Box hover-lift" style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
        <div className="Box-body" style={{display: 'flex', flexDirection: 'column', height: '100%', padding: '24px'}}>
          {/* Header */}
          <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0}}>
              <h3 className="text-body text-primary" style={{margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                {highlights?.name ? (
                  <span dangerouslySetInnerHTML={{ __html: highlights.name }} />
                ) : (
                  mcp.name.replace(/\s+(Official|Community)$/i, '')
                )}
              </h3>
              {mcp.verified && (
                <span className="Label Label--success">Official</span>
              )}
            </div>
            <HealthBadge status={mcp.health_status} />
          </div>

          {/* Author */}
          {mcp.author && (
            <div className="text-small text-tertiary" style={{marginBottom: '12px'}}>
              by {mcp.author}
            </div>
          )}

          {/* Description */}
          <p className="text-small text-secondary" style={{marginBottom: '20px', lineHeight: 1.6, flex: 1, minHeight: '48px'}}>
            {highlights?.description ? (
              <span dangerouslySetInnerHTML={{ __html: highlights.description }} />
            ) : (
              mcp.description || 'No description available'
            )}
          </p>


          {/* Footer */}
          {mcp.github_url && (
            <div style={{display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', marginTop: 'auto', borderTop: '1px solid var(--color-border-muted)'}}>
              <div className="text-tertiary text-small" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                <ExternalLink size={14} />
                <span>GitHub</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}