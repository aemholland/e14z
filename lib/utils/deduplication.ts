import { supabase } from '@/lib/supabase/client'
import type { MCP } from '@/types'

interface DuplicateCheckResult {
  isDuplicate: boolean
  duplicateType?: 'slug' | 'endpoint' | 'github_url' | 'name_similarity'
  existingMCP?: Partial<MCP>
  reason?: string
}

interface MCPInput {
  name: string
  endpoint: string
  github_url?: string
  slug?: string
}

/**
 * Comprehensive duplicate detection for MCPs
 * Checks multiple factors to prevent duplicate entries
 */
export async function checkForDuplicates(mcpData: MCPInput): Promise<DuplicateCheckResult> {
  try {
    // Generate slug if not provided
    const slug = mcpData.slug || generateSlug(mcpData.name)

    // 1. Check for exact slug match
    const { data: slugMatch } = await supabase
      .from('mcps')
      .select('id, slug, name, endpoint')
      .eq('slug', slug)
      .single()

    if (slugMatch) {
      return {
        isDuplicate: true,
        duplicateType: 'slug',
        existingMCP: slugMatch,
        reason: `An MCP with the slug "${slug}" already exists`
      }
    }

    // 2. Check for exact endpoint match
    const { data: endpointMatch } = await supabase
      .from('mcps')
      .select('id, slug, name, endpoint')
      .eq('endpoint', mcpData.endpoint)
      .single()

    if (endpointMatch) {
      return {
        isDuplicate: true,
        duplicateType: 'endpoint',
        existingMCP: endpointMatch,
        reason: `An MCP with the endpoint "${mcpData.endpoint}" already exists`
      }
    }

    // 3. Check for GitHub URL match (if provided)
    if (mcpData.github_url) {
      const normalizedGithubUrl = normalizeGithubUrl(mcpData.github_url)
      
      const { data: githubMatches } = await supabase
        .from('mcps')
        .select('id, slug, name, github_url')
        .not('github_url', 'is', null)

      if (githubMatches) {
        for (const existing of githubMatches) {
          if (existing.github_url && normalizeGithubUrl(existing.github_url) === normalizedGithubUrl) {
            return {
              isDuplicate: true,
              duplicateType: 'github_url',
              existingMCP: existing,
              reason: `An MCP with the GitHub URL "${mcpData.github_url}" already exists`
            }
          }
        }
      }
    }

    // 4. Check for name similarity (fuzzy matching)
    const { data: allMCPs } = await supabase
      .from('mcps')
      .select('id, slug, name, endpoint, github_url')

    if (allMCPs) {
      for (const existing of allMCPs) {
        const similarity = calculateNameSimilarity(mcpData.name, existing.name)
        
        // If names are very similar (>85% similarity), flag as potential duplicate
        if (similarity > 0.85) {
          return {
            isDuplicate: true,
            duplicateType: 'name_similarity',
            existingMCP: existing,
            reason: `An MCP with a very similar name "${existing.name}" already exists (${Math.round(similarity * 100)}% similarity)`
          }
        }
      }
    }

    // No duplicates found
    return { isDuplicate: false }

  } catch (error) {
    console.error('Duplicate check error:', error)
    // In case of error, allow submission but log the issue
    return { isDuplicate: false }
  }
}

/**
 * Generate a URL-friendly slug from MCP name and author
 * Official MCPs: just the name (remove "Official" suffix)
 * Community MCPs: {name}-{author}
 */
export function generateSlug(name: string, author?: string, verified?: boolean): string {
  // Clean the base name
  let cleanName = name
    .replace(/\s+(Official|Community)$/i, '') // Remove Official/Community suffix
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens

  // For official MCPs, just return the clean name
  if (verified) {
    return cleanName
  }

  // For community MCPs, append author if available
  if (author) {
    const cleanAuthor = author
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens

    return `${cleanName}-${cleanAuthor}`
  }

  // Fallback to just the clean name
  return cleanName
}

/**
 * Normalize GitHub URLs for comparison
 */
function normalizeGithubUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/\/$/, '') // Remove trailing slash
    .replace(/\.git$/, '') // Remove .git extension
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/^github\.com\//, '') // Normalize to just owner/repo
}

/**
 * Calculate name similarity using Levenshtein distance
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = name1.toLowerCase().trim()
  const s2 = name2.toLowerCase().trim()

  if (s1 === s2) return 1.0

  const len1 = s1.length
  const len2 = s2.length

  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0
  if (len2 === 0) return 0.0

  // Create matrix
  const matrix: number[][] = []
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Calculate Levenshtein distance
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[len1][len2]
  const maxLength = Math.max(len1, len2)
  
  return 1 - (distance / maxLength)
}

/**
 * Smart merge suggestions for similar MCPs
 */
export function generateMergeStrategy(newMCP: MCPInput, existingMCP: Partial<MCP>): {
  canMerge: boolean
  suggestions: string[]
  mergedData?: Partial<MCP>
} {
  const suggestions: string[] = []
  let canMerge = false

  // Check if they're likely the same MCP with different information
  if (existingMCP.name && newMCP.name) {
    const nameSimilarity = calculateNameSimilarity(newMCP.name, existingMCP.name)
    
    if (nameSimilarity > 0.9) {
      canMerge = true
      
      // Generate merge suggestions
      if (newMCP.github_url && !existingMCP.github_url) {
        suggestions.push(`Add GitHub URL: ${newMCP.github_url}`)
      }
      
      if (newMCP.endpoint !== existingMCP.endpoint) {
        suggestions.push(`Endpoint differs - review which is correct`)
      }
      
      suggestions.push(`Consider updating existing MCP instead of creating new one`)
      
      // Generate merged data
      const mergedData: Partial<MCP> = {
        ...existingMCP,
        // Prefer new data for missing fields
        github_url: existingMCP.github_url || newMCP.github_url,
        // Keep existing verified status and other metadata
      }

      return { canMerge, suggestions, mergedData }
    }
  }

  return { canMerge: false, suggestions: ['MCPs appear to be different - safe to add as new entry'] }
}

/**
 * Batch deduplication for imported MCPs
 */
export async function deduplicateBatch(mcps: MCPInput[]): Promise<{
  unique: MCPInput[]
  duplicates: Array<{ mcp: MCPInput; reason: string; existing?: Partial<MCP> }>
  potentialMerges: Array<{ new: MCPInput; existing: Partial<MCP>; suggestions: string[] }>
}> {
  const unique: MCPInput[] = []
  const duplicates: Array<{ mcp: MCPInput; reason: string; existing?: Partial<MCP> }> = []
  const potentialMerges: Array<{ new: MCPInput; existing: Partial<MCP>; suggestions: string[] }> = []

  for (const mcp of mcps) {
    const duplicateCheck = await checkForDuplicates(mcp)
    
    if (duplicateCheck.isDuplicate) {
      if (duplicateCheck.duplicateType === 'name_similarity' && duplicateCheck.existingMCP) {
        // Check if it's a potential merge candidate
        const mergeStrategy = generateMergeStrategy(mcp, duplicateCheck.existingMCP)
        
        if (mergeStrategy.canMerge) {
          potentialMerges.push({
            new: mcp,
            existing: duplicateCheck.existingMCP,
            suggestions: mergeStrategy.suggestions
          })
        } else {
          duplicates.push({
            mcp,
            reason: duplicateCheck.reason || 'Duplicate detected',
            existing: duplicateCheck.existingMCP
          })
        }
      } else {
        duplicates.push({
          mcp,
          reason: duplicateCheck.reason || 'Duplicate detected',
          existing: duplicateCheck.existingMCP
        })
      }
    } else {
      unique.push(mcp)
    }
  }

  return { unique, duplicates, potentialMerges }
}