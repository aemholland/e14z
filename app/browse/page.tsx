'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { SearchBar } from '@/components/search/SearchBar'
import { MCPCard } from '@/components/mcp/MCPCard'
import { SearchFilters } from '@/components/search/SearchFilters'
import { searchMCPs, getCategories } from '@/lib/search/engine'
import type { RankedResult, SearchOptions } from '@/types'

function BrowsePageContent() {
  const searchParams = useSearchParams()
  const [results, setResults] = useState<RankedResult[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string>()

  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    query: searchParams.get('q') || '',
    filters: {
      verified: searchParams.get('verified') === 'true' ? true : undefined,
      healthStatus: searchParams.get('health') as 'healthy' | 'degraded' | 'down' | undefined,
    },
    limit: 20,
    offset: 0
  })

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    performSearch()
  }, [searchOptions])

  const loadCategories = async () => {
    try {
      const cats = await getCategories()
      setCategories(cats)
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  const performSearch = async () => {
    setLoading(true)
    setError(undefined)
    
    try {
      const { results: searchResults, total: totalCount, error: searchError } = await searchMCPs(searchOptions)
      
      if (searchError) {
        setError(searchError)
      } else {
        setResults(searchResults)
        setTotal(totalCount)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchOptions(prev => ({
      ...prev,
      query,
      offset: 0
    }))
  }

  const handleFilterChange = (filters: SearchOptions['filters']) => {
    setSearchOptions(prev => ({
      ...prev,
      filters,
      offset: 0
    }))
  }

  const handleSortChange = (sortBy: string) => {
    // For now, we'll implement sorting later
    console.log('Sort by:', sortBy)
  }

  return (
    <div className="container" style={{padding: '32px 24px'}}>
      
      {/* Search Header */}
      <div style={{marginBottom: '40px'}}>
        <h1 className="text-title" style={{marginBottom: '32px'}}>Browse MCP Servers</h1>
        <div style={{maxWidth: '40rem'}}>
          <SearchBar 
            initialQuery={searchOptions.query}
            onSearch={handleSearch}
            placeholder="Search by name, description, or category..."
          />
        </div>
      </div>

      <div style={{display: 'flex', gap: '40px'}}>
        {/* Sidebar Filters */}
        <aside style={{width: '280px', flexShrink: 0}}>
          <SearchFilters
            categories={categories}
            filters={searchOptions.filters}
            onFilterChange={handleFilterChange}
          />
        </aside>

        {/* Main Content */}
        <main style={{flex: 1}}>
          
          {/* Results Header */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px'}}>
            <div>
              <p className="text-small text-secondary">
                {loading ? (
                  'Searching...'
                ) : error ? (
                  'Search failed'
                ) : (
                  <>
                    {total} MCP{total !== 1 ? 's' : ''} found
                    {searchOptions.query && (
                      <> for "<span className="text-primary">{searchOptions.query}</span>"</>
                    )}
                  </>
                )}
              </p>
            </div>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              <label htmlFor="sort" className="text-small text-tertiary">Sort by:</label>
              <select 
                id="sort"
                className="form-control text-small"
                style={{padding: '4px 8px', minWidth: '140px'}}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="relevance">Best Match</option>
                <option value="name">Name A-Z</option>
                <option value="category">Category</option>
                <option value="health">Health Status</option>
                <option value="recent">Recently Added</option>
              </select>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="flash flash-error" style={{marginBottom: '32px'}}>
              <div style={{display: 'flex', alignItems: 'flex-start', gap: '12px'}}>
                <div style={{flexShrink: 0}}>
                  <svg style={{width: '20px', height: '20px'}} className="text-danger" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-small">Error: {error}</p>
                  <button 
                    onClick={performSearch}
                    className="text-small text-danger"
                    style={{marginTop: '8px', textDecoration: 'underline', border: 'none', background: 'transparent', cursor: 'pointer'}}
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px'}}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="Box" style={{height: '280px'}}>
                  <div className="Box-body" style={{padding: '24px'}}>
                    <div style={{animation: 'pulse 1.5s ease-in-out infinite'}}>
                      <div style={{height: '20px', backgroundColor: 'var(--color-neutral-muted)', borderRadius: '4px', width: '75%', marginBottom: '16px'}}></div>
                      <div style={{height: '16px', backgroundColor: 'var(--color-neutral-muted)', borderRadius: '4px', width: '100%', marginBottom: '12px'}}></div>
                      <div style={{height: '16px', backgroundColor: 'var(--color-neutral-muted)', borderRadius: '4px', width: '66%', marginBottom: '20px'}}></div>
                      <div style={{display: 'flex', gap: '12px'}}>
                        <div style={{height: '24px', backgroundColor: 'var(--color-neutral-muted)', borderRadius: '4px', width: '64px'}}></div>
                        <div style={{height: '24px', backgroundColor: 'var(--color-neutral-muted)', borderRadius: '4px', width: '48px'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results Grid */}
          {!loading && !error && (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px'}}>
              {results.map((result) => (
                <MCPCard 
                  key={result.mcp.id} 
                  mcp={result.mcp}
                  highlights={result.highlights}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && results.length === 0 && (
            <div style={{textAlign: 'center', padding: '48px 24px'}}>
              <div className="text-tertiary" style={{marginBottom: '24px'}}>
                <svg style={{width: '64px', height: '64px', margin: '0 auto'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-body text-primary" style={{marginBottom: '12px'}}>No MCPs found</h3>
              <p className="text-secondary" style={{marginBottom: '24px'}}>
                Try adjusting your search terms or filters to find what you're looking for.
              </p>
              <button 
                onClick={() => setSearchOptions({ query: '', filters: {}, limit: 20, offset: 0 })}
                className="btn btn-primary"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Load More */}
          {!loading && !error && results.length > 0 && results.length < total && (
            <div style={{textAlign: 'center', marginTop: '40px'}}>
              <button 
                onClick={() => setSearchOptions(prev => ({
                  ...prev,
                  offset: prev.offset! + prev.limit!
                }))}
                className="btn btn-primary"
                style={{padding: '8px 24px'}}
              >
                Load More ({total - results.length} remaining)
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BrowsePageContent />
    </Suspense>
  )
}