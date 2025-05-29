'use client'

import { useState, useEffect } from 'react'

interface MCPStatsProps {
  mcpId: string
}

interface Stats {
  totalCalls: number
  avgLatency: number
  successRate: number
  uptime: number
}

export function MCPStats({ mcpId }: MCPStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // No fake data - will be populated by E14Z Pulse when implemented
    setLoading(false)
  }, [mcpId])

  if (loading) {
    return (
      <div className="Box">
        <div className="Box-header">
          <h3 className="text-body text-primary">Performance Stats</h3>
        </div>
        <div className="Box-body" style={{minHeight: '200px'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{animation: 'pulse 1.5s ease-in-out infinite'}}>
                <div style={{height: '16px', backgroundColor: 'var(--color-neutral-muted)', borderRadius: '4px', width: '75%', marginBottom: '8px'}}></div>
                <div style={{height: '12px', backgroundColor: 'var(--color-neutral-muted)', borderRadius: '4px', width: '50%'}}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="Box">
      <div className="Box-header">
        <h3 className="text-body text-primary">Performance Stats</h3>
      </div>
      
      <div className="Box-body" style={{minHeight: '280px', display: 'flex', flexDirection: 'column'}}>
        <div style={{textAlign: 'center', padding: '32px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <div className="text-tertiary" style={{marginBottom: '16px'}}>
            <svg style={{width: '48px', height: '48px', margin: '0 auto'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h4 className="text-small text-primary" style={{marginBottom: '8px', fontWeight: 500}}>Performance Stats</h4>
          <p className="text-small text-secondary" style={{marginBottom: '20px'}}>Coming with E14Z Pulse</p>
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}} className="text-small text-tertiary">
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span style={{color: 'var(--color-accent-fg)'}}>•</span>
              <span>Real-time latency monitoring</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span style={{color: 'var(--color-accent-fg)'}}>•</span>
              <span>Success rate tracking</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span style={{color: 'var(--color-accent-fg)'}}>•</span>
              <span>Uptime percentages</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span style={{color: 'var(--color-accent-fg)'}}>•</span>
              <span>Usage analytics</span>
            </div>
          </div>
        </div>
        
        <div style={{marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-border-muted)'}}>
          <p className="text-small text-tertiary">
            Stats collected by E14Z Pulse monitoring
          </p>
        </div>
      </div>
    </div>
  )
}