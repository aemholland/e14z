'use client'

import type { SearchOptions } from '@/types'
import { formatCategory } from '@/lib/utils/formatting'

interface SearchFiltersProps {
  categories: string[]
  filters: SearchOptions['filters']
  onFilterChange: (filters: SearchOptions['filters']) => void
}

export function SearchFilters({ categories, filters = {}, onFilterChange }: SearchFiltersProps) {
  const updateFilter = (key: keyof SearchOptions['filters'], value: any) => {
    const newFilters = { ...filters }
    if (value === '' || value === undefined) {
      delete newFilters[key]
    } else {
      newFilters[key] = value
    }
    onFilterChange(newFilters)
  }

  const clearAllFilters = () => {
    onFilterChange({})
  }

  const hasActiveFilters = Object.keys(filters).length > 0

  return (
    <div className="Box">
      <div className="Box-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <h3 className="text-body text-primary">Filters</h3>
        {hasActiveFilters && (
          <button 
            onClick={clearAllFilters}
            className="text-small text-accent"
            style={{textDecoration: 'underline', border: 'none', background: 'transparent', cursor: 'pointer'}}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="Box-body" style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
        
        {/* Health Status */}
        <div>
          <label className="text-small text-tertiary" style={{display: 'block', marginBottom: '8px'}}>
            Health Status
          </label>
          <select 
            value={filters.healthStatus || ''}
            onChange={(e) => updateFilter('healthStatus', e.target.value)}
            className="form-control text-small"
            style={{width: '100%'}}
          >
            <option value="">All Status</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="down">Down</option>
          </select>
        </div>

        {/* Verification */}
        <div>
          <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
            <input
              type="checkbox"
              checked={filters.verified === true}
              onChange={(e) => updateFilter('verified', e.target.checked ? true : undefined)}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-canvas-default)',
                accentColor: 'var(--color-accent-fg)'
              }}
            />
            <span className="text-small text-secondary">Verified only</span>
          </label>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div style={{paddingTop: '16px', borderTop: '1px solid var(--color-border-muted)'}}>
            <p className="text-small text-tertiary" style={{marginBottom: '8px'}}>Active filters:</p>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              {filters.healthStatus && (
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}} className="text-small">
                  <span className="text-secondary">Health: {filters.healthStatus}</span>
                  <button 
                    onClick={() => updateFilter('healthStatus', undefined)}
                    className="text-danger"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {filters.verified && (
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}} className="text-small">
                  <span className="text-secondary">Verified only</span>
                  <button 
                    onClick={() => updateFilter('verified', undefined)}
                    className="text-danger"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}