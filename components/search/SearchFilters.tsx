'use client'

import type { SearchOptions } from '@/types'

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
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button 
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-6">
        
        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select 
            value={filters.category || ''}
            onChange={(e) => updateFilter('category', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Pricing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pricing
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="pricing"
                value=""
                checked={!filters.pricing}
                onChange={(e) => updateFilter('pricing', undefined)}
                className="mr-2"
              />
              <span className="text-sm">All</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="pricing"
                value="free"
                checked={filters.pricing === 'free'}
                onChange={(e) => updateFilter('pricing', 'free')}
                className="mr-2"
              />
              <span className="text-sm">Free</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="pricing"
                value="paid"
                checked={filters.pricing === 'paid'}
                onChange={(e) => updateFilter('pricing', 'paid')}
                className="mr-2"
              />
              <span className="text-sm">Paid</span>
            </label>
          </div>
        </div>

        {/* Health Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Health Status
          </label>
          <select 
            value={filters.healthStatus || ''}
            onChange={(e) => updateFilter('healthStatus', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="down">Down</option>
          </select>
        </div>

        {/* Verification */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.verified === true}
              onChange={(e) => updateFilter('verified', e.target.checked ? true : undefined)}
              className="mr-2"
            />
            <span className="text-sm">Verified only</span>
          </label>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-500 mb-2">Active filters:</p>
            <div className="space-y-1">
              {filters.category && (
                <div className="flex items-center justify-between text-xs">
                  <span>Category: {filters.category}</span>
                  <button 
                    onClick={() => updateFilter('category', undefined)}
                    className="text-red-600 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              )}
              {filters.pricing && (
                <div className="flex items-center justify-between text-xs">
                  <span>Pricing: {filters.pricing}</span>
                  <button 
                    onClick={() => updateFilter('pricing', undefined)}
                    className="text-red-600 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              )}
              {filters.healthStatus && (
                <div className="flex items-center justify-between text-xs">
                  <span>Health: {filters.healthStatus}</span>
                  <button 
                    onClick={() => updateFilter('healthStatus', undefined)}
                    className="text-red-600 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              )}
              {filters.verified && (
                <div className="flex items-center justify-between text-xs">
                  <span>Verified only</span>
                  <button 
                    onClick={() => updateFilter('verified', undefined)}
                    className="text-red-600 hover:text-red-700"
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