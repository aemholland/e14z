'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { SearchBar } from '@/components/search/SearchBar'
import { MCPCard } from '@/components/mcp/MCPCard'
import { SearchFilters } from '@/components/search/SearchFilters'
import { searchMCPs, getCategories } from '@/lib/search/engine'
import type { RankedResult, SearchOptions } from '@/types'

export default function BrowsePage() {
  const searchParams = useSearchParams()
  const [results, setResults] = useState<RankedResult[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string>()

  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    query: searchParams.get('q') || '',
    filters: {
      category: searchParams.get('category') || undefined,
      pricing: searchParams.get('pricing') as 'free' | 'paid' | undefined,
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Browse MCP Servers</h1>
          <div className="max-w-2xl">
            <SearchBar 
              initialQuery={searchOptions.query}
              onSearch={handleSearch}
              placeholder="Search MCPs by name, description, or tags..."
            />
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <aside className="w-64 flex-shrink-0">
            <SearchFilters
              categories={categories}
              filters={searchOptions.filters}
              onFilterChange={handleFilterChange}
            />
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-gray-600">
                  {loading ? (
                    'Searching...'
                  ) : error ? (
                    'Search failed'
                  ) : (
                    <>
                      {total} MCP{total !== 1 ? 's' : ''} found
                      {searchOptions.query && (
                        <> for "<span className="font-medium">{searchOptions.query}</span>"</>
                      )}
                    </>
                  )}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <label htmlFor="sort" className="text-sm text-gray-600">Sort by:</label>
                <select 
                  id="sort"
                  className="text-sm border border-gray-300 rounded px-2 py-1"
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700">Error: {error}</p>
                <button 
                  onClick={performSearch}
                  className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results Grid */}
            {!loading && !error && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No MCPs found</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
                <button 
                  onClick={() => setSearchOptions({ query: '', filters: {}, limit: 20, offset: 0 })}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Load More */}
            {!loading && !error && results.length > 0 && results.length < total && (
              <div className="text-center mt-8">
                <button 
                  onClick={() => setSearchOptions(prev => ({
                    ...prev,
                    offset: prev.offset! + prev.limit!
                  }))}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Load More ({total - results.length} remaining)
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}