'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Command } from 'lucide-react'

interface SearchBarProps {
  initialQuery?: string
  placeholder?: string
  onSearch?: (query: string) => void
}

export function SearchBar({ 
  initialQuery = '', 
  placeholder = "Search for MCP servers... (e.g., 'invoice processing')",
  onSearch 
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (onSearch) {
      onSearch(query)
    } else {
      // Navigate to browse page with search query
      const params = new URLSearchParams()
      if (query.trim()) {
        params.set('q', query.trim())
      }
      router.push(`/browse?${params.toString()}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{width: '100%'}}>
      <div style={{position: 'relative'}}>
        {/* Search icon */}
        <div style={{
          position: 'absolute', 
          left: '12px', 
          top: '50%', 
          transform: 'translateY(-50%)',
          color: 'var(--color-fg-subtle)'
        }}>
          <Search size={16} />
        </div>
        
        {/* Input field */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="form-control"
          style={{ 
            width: '100%',
            paddingLeft: '40px',
            paddingRight: '120px',
            paddingTop: '12px',
            paddingBottom: '12px',
            fontSize: '16px' // Prevents zoom on mobile
          }}
        />
        
        {/* Command hint */}
        <div style={{
          position: 'absolute',
          right: '80px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'none'
        }} className="hidden md:flex">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: 'var(--color-canvas-subtle)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--color-fg-subtle)'
          }}>
            <Command size={12} />
            <span>K</span>
          </div>
        </div>
        
        {/* Search button */}
        <div style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)'
        }}>
          <button 
            type="submit"
            className="btn btn-primary"
            style={{
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '4px',
              paddingBottom: '4px',
              fontSize: '14px'
            }}
            disabled={!query.trim()}
          >
            Search
          </button>
        </div>
      </div>
      
      {/* Search suggestions */}
      {query.length > 2 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '8px',
          backgroundColor: 'var(--color-canvas-overlay)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '6px',
          boxShadow: 'var(--color-shadow-large)',
          overflow: 'hidden',
          zIndex: 10
        }}>
          <div style={{padding: '8px'}}>
            <div className="text-small text-secondary" style={{marginBottom: '8px', paddingLeft: '8px', paddingRight: '8px', fontWeight: 600}}>
              Quick suggestions
            </div>
            {[
              'communication tools',
              'database servers', 
              'productivity apps',
              'development tools'
            ].filter(suggestion => 
              suggestion.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 3).map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="text-small text-primary"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-neutral-muted)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Search size={14} className="text-tertiary" />
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}