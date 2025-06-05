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
      // Format multi-word queries for PostgreSQL full-text search
      // Convert "bitcoin payments crypto" to "bitcoin & payments & crypto"
      const formattedQuery = query.trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .join(' & ')
      
      dbQuery = dbQuery.textSearch('search_vector', formattedQuery)
    }

    // Apply filters

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

    // Auth-aware filters for autonomous agents
    if (filters.noAuth) {
      dbQuery = dbQuery.eq('auth_required', false)
    }
    
    if (filters.authRequired) {
      dbQuery = dbQuery.eq('auth_required', true)
    }
    
    if (filters.executable) {
      // Only show MCPs with stdio connection type or those that can be run directly
      dbQuery = dbQuery.eq('connection_type', 'stdio')
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

  // Use enhanced AI-generated intelligence scores if available
  if (mcp.overall_intelligence_score !== undefined && mcp.overall_intelligence_score !== null) {
    score += mcp.overall_intelligence_score * 50 // 0.0-1.0 -> 0-50 points
  }
  
  if (mcp.reliability_score !== undefined && mcp.reliability_score !== null) {
    score += mcp.reliability_score * 30 // 0.0-1.0 -> 0-30 points
  }

  // Verification bonus
  if (mcp.verified) score += 20

  // Real MCP connection data
  if (mcp.mcp_protocol_data?.connection_working) score += 15
  
  // Tool count quality (from real MCP connection)
  const toolCount = mcp.tools?.length || 0
  if (toolCount > 20) score += 10
  else if (toolCount > 10) score += 7
  else if (toolCount > 5) score += 5
  else if (toolCount > 0) score += 3

  // Documentation bonus
  if (mcp.github_url) score += 10
  if (mcp.documentation_url) score += 8
  if (mcp.website_url) score += 5

  // Enhanced description quality (OpenAI-generated)
  if (mcp.description && mcp.description.length >= 150) score += 8

  // Enhanced tags (minimum 20 from our crawler)
  const tagCount = mcp.tags?.length || 0
  if (tagCount >= 20) score += 8
  else if (tagCount >= 10) score += 5
  else if (tagCount >= 3) score += 3

  // Real auth detection confidence
  if (mcp.auth_required === false && mcp.mcp_protocol_data?.connection_working) {
    score += 5 // No auth needed and working = easier to use
  }

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