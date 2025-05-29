/**
 * MCP Processing Pipeline with Automated Tag Generation
 * Integrates AI-powered tag generation into the MCP discovery and update process
 */

import { generateMCPTagsWithGitHub, validateAndCleanTags, type MCPInfo } from '@/lib/ai/tagGenerator'
import { extractInstallationFromSection, cleanInstallationCommand } from '@/lib/mcp/installationDetector'
import { supabase } from '@/lib/supabase/client'
import type { MCP } from '@/types'

interface ProcessMCPOptions {
  forceTagRegeneration?: boolean
  includeGitHubAnalysis?: boolean
  aiProvider?: 'openai' | 'anthropic' | 'local'
}

/**
 * Process a new or existing MCP server with automated tag generation
 */
export async function processMCPWithTags(
  mcpData: Partial<MCP>,
  options: ProcessMCPOptions = {}
): Promise<{
  success: boolean
  mcp?: MCP
  tags?: string[]
  error?: string
}> {
  try {
    const {
      forceTagRegeneration = false,
      includeGitHubAnalysis = true
    } = options

    // Check if tags already exist and are comprehensive
    const needsTagGeneration = forceTagRegeneration || 
      !mcpData.tags || 
      mcpData.tags.length < 15 // Threshold for comprehensive tags

    let generatedTags: string[] = mcpData.tags || []

    if (needsTagGeneration) {
      console.log(`Generating tags for MCP: ${mcpData.name}`)
      
      // Gather information for tag generation
      const mcpInfo: MCPInfo = {
        name: mcpData.name || '',
        description: mcpData.description,
        category: mcpData.category,
        use_cases: mcpData.use_cases
      }

      // Optionally fetch GitHub content for better tag generation and installation detection
      let githubReadme = ''
      let githubDescription = ''
      
      if (includeGitHubAnalysis && mcpData.github_url) {
        const githubData = await fetchGitHubContent(mcpData.github_url)
        githubReadme = githubData.readme
        githubDescription = githubData.description
        
        // Detect installation method from README
        const installationInfo = extractInstallationFromSection(githubReadme, mcpData.github_url)
        
        // Update endpoint and install_type if we found better information
        if (installationInfo.confidence > 0.5 && installationInfo.endpoint !== 'See GitHub repository for installation instructions') {
          mcpData.endpoint = cleanInstallationCommand(installationInfo.endpoint, installationInfo.install_type)
          mcpData.install_type = installationInfo.install_type
          
          console.log(`Detected installation: ${installationInfo.install_type} - ${mcpData.endpoint}`)
        }
      }

      // Generate comprehensive tags using AI
      const tagResult = await generateMCPTagsWithGitHub(
        mcpInfo,
        githubReadme,
        githubDescription
      )

      // Validate and clean the generated tags
      generatedTags = validateAndCleanTags(tagResult.tags)

      console.log(`Generated ${generatedTags.length} tags for ${mcpData.name}`)
      console.log(`Tag generation reasoning: ${tagResult.reasoning}`)
    }

    // Update MCP with generated tags
    const updatedMCP: Partial<MCP> = {
      ...mcpData,
      tags: generatedTags,
      updated_at: new Date().toISOString()
    }

    // Save to database
    let savedMCP: MCP
    if (mcpData.id) {
      // Update existing MCP
      const { data, error } = await supabase
        .from('mcps')
        .update(updatedMCP)
        .eq('id', mcpData.id)
        .select()
        .single()

      if (error) throw error
      savedMCP = data
    } else {
      // Insert new MCP
      const { data, error } = await supabase
        .from('mcps')
        .insert([updatedMCP])
        .select()
        .single()

      if (error) throw error
      savedMCP = data
    }

    return {
      success: true,
      mcp: savedMCP,
      tags: generatedTags
    }

  } catch (error) {
    console.error('Error processing MCP with tags:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Batch process multiple MCPs with tag generation
 */
export async function batchProcessMCPsWithTags(
  mcpList: Partial<MCP>[],
  options: ProcessMCPOptions = {}
): Promise<{
  processed: number
  failed: number
  results: Array<{ name: string; success: boolean; tags?: string[]; error?: string }>
}> {
  const results = []
  let processed = 0
  let failed = 0

  for (const mcp of mcpList) {
    try {
      const result = await processMCPWithTags(mcp, options)
      
      if (result.success) {
        processed++
        results.push({
          name: mcp.name || 'Unknown',
          success: true,
          tags: result.tags
        })
      } else {
        failed++
        results.push({
          name: mcp.name || 'Unknown',
          success: false,
          error: result.error
        })
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      failed++
      results.push({
        name: mcp.name || 'Unknown',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return { processed, failed, results }
}

/**
 * Regenerate tags for existing MCPs that have insufficient tag coverage
 */
export async function regenerateInsufficientTags(): Promise<{
  updated: number
  failed: number
  results: Array<{ name: string; oldTagCount: number; newTagCount: number; success: boolean }>
}> {
  try {
    // Find MCPs with insufficient tags (< 15 tags)
    const { data: mcps, error } = await supabase
      .from('mcps')
      .select('*')
      .or('tags.is.null,array_length(tags,1).lt.15')

    if (error) throw error

    const results = []
    let updated = 0
    let failed = 0

    for (const mcp of mcps || []) {
      const oldTagCount = mcp.tags?.length || 0
      
      const result = await processMCPWithTags(mcp, {
        forceTagRegeneration: true,
        includeGitHubAnalysis: true
      })

      if (result.success) {
        updated++
        results.push({
          name: mcp.name,
          oldTagCount,
          newTagCount: result.tags?.length || 0,
          success: true
        })
      } else {
        failed++
        results.push({
          name: mcp.name,
          oldTagCount,
          newTagCount: 0,
          success: false
        })
      }
    }

    return { updated, failed, results }

  } catch (error) {
    console.error('Error regenerating insufficient tags:', error)
    return { updated: 0, failed: 0, results: [] }
  }
}

/**
 * Fetch GitHub repository content for tag generation
 */
async function fetchGitHubContent(githubUrl: string): Promise<{
  readme: string
  description: string
}> {
  try {
    // Extract owner/repo from GitHub URL
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!match) return { readme: '', description: '' }

    const [, owner, repo] = match
    
    // Fetch repository info
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
    const repoData = await repoResponse.json()
    
    // Fetch README
    const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`)
    const readmeData = await readmeResponse.json()
    
    const readme = readmeData.content ? 
      Buffer.from(readmeData.content, 'base64').toString('utf-8') : ''

    return {
      readme,
      description: repoData.description || ''
    }

  } catch (error) {
    console.error('Error fetching GitHub content:', error)
    return { readme: '', description: '' }
  }
}

/**
 * Integration hook for discovery pipeline
 * Call this when adding new MCPs through scraping/discovery
 */
export async function integrateWithDiscoveryPipeline(
  discoveredMCPs: Array<{
    name: string
    description?: string
    github_url?: string
    category?: string
    [key: string]: any
  }>
): Promise<void> {
  console.log(`Processing ${discoveredMCPs.length} discovered MCPs with AI tag generation...`)
  
  const result = await batchProcessMCPsWithTags(discoveredMCPs, {
    includeGitHubAnalysis: true,
    forceTagRegeneration: true
  })

  console.log(`Discovery integration complete:`)
  console.log(`- Processed: ${result.processed}`)
  console.log(`- Failed: ${result.failed}`)
  console.log(`- Success rate: ${(result.processed / (result.processed + result.failed) * 100).toFixed(1)}%`)
}

export { ProcessMCPOptions }