import { supabase } from '@/lib/supabase/client'
import type { MCP, SearchOptions, RankedResult } from '@/types'

export async function searchMCPs(options: SearchOptions): Promise<{
  results: RankedResult[]
  total: number
  error?: string
}> {
  try {
    const { query, filters = {}, limit = 10, offset = 0 } = options

    let dbQuery = supabase
      .from('mcps')
      .select('*')

    // Text search using full-text search vector
    if (query.trim()) {
      try {
        // Format query for PostgreSQL tsquery - replace spaces with & for AND operation
        const formattedQuery = query.trim()
          .split(/\s+/)
          .filter(term => term.length > 0)
          .map(term => term.replace(/[&|!():]/g, '')) // Remove special tsquery characters
          .filter(term => term.length > 0)
          .join(' & ')
        
        if (formattedQuery) {
          dbQuery = dbQuery.textSearch('search_vector', formattedQuery)
        }
      } catch (tsqueryError) {
        // Fallback to simple ILIKE search if tsquery fails
        console.warn('tsquery failed, falling back to ILIKE search:', tsqueryError)
        const searchTerms = query.trim().toLowerCase().split(/\s+/)
        
        if (searchTerms.length > 0) {
          // Search in name, description, and tags using ILIKE
          let fallbackQuery = dbQuery.or(
            `name.ilike.%${searchTerms[0]}%,description.ilike.%${searchTerms[0]}%`
          )
          
          // Add additional terms with AND logic
          for (let i = 1; i < Math.min(searchTerms.length, 3); i++) {
            fallbackQuery = fallbackQuery.or(
              `name.ilike.%${searchTerms[i]}%,description.ilike.%${searchTerms[i]}%`
            )
          }
          
          dbQuery = fallbackQuery
        }
      }
    }

    // Apply filters
    if (filters.category) {
      // Make category search flexible - case insensitive and handle singular/plural
      const categoryPattern = filters.category.toLowerCase();
      dbQuery = dbQuery.or(
        `category.ilike.%${categoryPattern}%,category.ilike.%${categoryPattern}s%`
      );
    }

    if (filters.pricing === 'free') {
      dbQuery = dbQuery.eq('pricing_model', 'free')
    } else if (filters.pricing === 'paid') {
      dbQuery = dbQuery.neq('pricing_model', 'free')
    }

    if (filters.verified !== undefined) {
      dbQuery = dbQuery.eq('verified', filters.verified)
    }

    if (filters.healthStatus) {
      dbQuery = dbQuery.eq('health_status', filters.healthStatus)
    }

    // Execute query with pagination
    const { data: mcps, error, count } = await dbQuery
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Search error:', error)
      return { results: [], total: 0, error: error.message }
    }

    if (!mcps) {
      return { results: [], total: 0 }
    }

    // Calculate relevance scores for ranking
    const rankedResults: RankedResult[] = mcps.map(mcp => {
      const relevanceScore = calculateRelevanceScore(mcp, query)
      const qualityScore = calculateQualityScore(mcp)
      const healthScore = calculateHealthScore(mcp)
      
      const totalScore = (
        relevanceScore * 0.35 +
        qualityScore * 0.25 +
        healthScore * 0.15 +
        (mcp.verified ? 15 : 0) +
        (query ? 0 : 10) // Boost for browse mode
      )

      return {
        mcp,
        relevanceScore,
        qualityScore, 
        healthScore,
        totalScore,
        highlights: generateHighlights(mcp, query)
      }
    })

    // Sort by total score
    rankedResults.sort((a, b) => b.totalScore - a.totalScore)

    return {
      results: rankedResults,
      total: count || mcps.length,
    }
  } catch (err) {
    console.error('Search error:', err)
    return { 
      results: [], 
      total: 0, 
      error: err instanceof Error ? err.message : 'Search failed' 
    }
  }
}

function calculateRelevanceScore(mcp: MCP, query: string): number {
  if (!query.trim()) return 50 // Default score for browse mode

  const searchTerms = query.toLowerCase().split(' ')
  let score = 0

  // Name match (highest weight)
  const nameMatches = searchTerms.filter(term => 
    mcp.name.toLowerCase().includes(term)
  ).length
  score += nameMatches * 20

  // Description match
  if (mcp.description) {
    const descMatches = searchTerms.filter(term =>
      mcp.description!.toLowerCase().includes(term)
    ).length
    score += descMatches * 10
  }

  // Tag matches
  const tagMatches = searchTerms.filter(term =>
    mcp.tags.some(tag => tag.toLowerCase().includes(term))
  ).length
  score += tagMatches * 15

  // Category match
  const categoryMatches = searchTerms.filter(term =>
    mcp.category.toLowerCase().includes(term)
  ).length
  score += categoryMatches * 12

  return Math.min(score, 100)
}

function calculateQualityScore(mcp: MCP): number {
  let score = 0

  // Verification bonus
  if (mcp.verified) score += 30

  // Documentation bonus
  if (mcp.github_url) score += 20
  if (mcp.documentation_url) score += 15
  if (mcp.website_url) score += 10

  // Description quality
  if (mcp.description && mcp.description.length > 50) score += 15

  // Tags indicate good categorization
  if (mcp.tags.length >= 3) score += 10

  return Math.min(score, 100)
}

function calculateHealthScore(mcp: MCP): number {
  switch (mcp.health_status) {
    case 'healthy': return 100
    case 'degraded': return 60
    case 'down': return 20
    case 'unknown':
    default: return 70 // Default score until health is checked
  }
}

function generateHighlights(mcp: MCP, query: string): { name?: string; description?: string } {
  if (!query.trim()) return {}

  const highlights: { name?: string; description?: string } = {}
  const searchTerms = query.toLowerCase().split(' ')

  // Highlight name matches
  let highlightedName = mcp.name
  searchTerms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi')
    highlightedName = highlightedName.replace(regex, '<mark>$1</mark>')
  })
  if (highlightedName !== mcp.name) {
    highlights.name = highlightedName
  }

  // Highlight description matches
  if (mcp.description) {
    let highlightedDesc = mcp.description
    searchTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi')
      highlightedDesc = highlightedDesc.replace(regex, '<mark>$1</mark>')
    })
    if (highlightedDesc !== mcp.description) {
      highlights.description = highlightedDesc
    }
  }

  return highlights
}

export async function getCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('mcps')
      .select('category')
      .not('category', 'is', null)

    if (error) throw error

    const categories = Array.from(new Set(data.map(row => row.category))).sort()
    return categories
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}

export async function getMCPBySlug(slug: string): Promise<MCP | null> {
  try {
    const { data, error } = await supabase
      .from('mcps')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching MCP:', error)
    return null
  }
}