'use client'

import { useEffect, useState } from 'react'
import { SearchBar } from '@/components/search/SearchBar'
import { MCPCard } from '@/components/mcp/MCPCard'
import { searchMCPs } from '@/lib/search/engine'
import type { RankedResult } from '@/types'

export default function Home() {
  const [trendingMCPs, setTrendingMCPs] = useState<RankedResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTrendingMCPs()
  }, [])

  const loadTrendingMCPs = async () => {
    try {
      const { results } = await searchMCPs({ 
        query: '', 
        filters: { verified: true }, 
        limit: 6 
      })
      setTrendingMCPs(results)
    } catch (error) {
      console.error('Failed to load trending MCPs:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-6xl">
            E14Z
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            The npm for AI agents. Discover, evaluate, and connect to MCP servers.
          </p>
          
          {/* Search Bar */}
          <div className="mt-10 flex justify-center">
            <div className="w-full max-w-2xl">
              <SearchBar />
            </div>
          </div>
          
          {/* Quick Categories */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {[
              { label: 'Search & Web', value: 'search' },
              { label: 'File Systems', value: 'file-system' },
              { label: 'Databases', value: 'database' },
              { label: 'Communication', value: 'communication' },
              { label: 'AI Models', value: 'ai-models' },
              { label: 'Development', value: 'development' }
            ].map((category) => (
              <button
                key={category.value}
                onClick={() => window.location.href = `/browse?category=${category.value}`}
                className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-50 cursor-pointer"
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{trendingMCPs.length}+</div>
            <div className="text-sm text-gray-500">MCP Servers</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-gray-900">98.5%</div>
            <div className="text-sm text-gray-500">Operational</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-gray-900">1M+</div>
            <div className="text-sm text-gray-500">API Calls</div>
          </div>
        </div>

        {/* Trending MCPs */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Verified MCPs</h2>
            <a 
              href="/browse" 
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              View all →
            </a>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingMCPs.slice(0, 6).map((result) => (
                <MCPCard 
                  key={result.mcp.id} 
                  mcp={result.mcp}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}