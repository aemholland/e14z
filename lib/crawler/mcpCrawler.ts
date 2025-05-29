/**
 * Automated MCP Discovery Crawler
 * 
 * Discovers new MCP servers using Firecrawl, generates AI tags,
 * and updates the database automatically.
 * 
 * INACTIVE BY DEFAULT - Requires manual activation
 */

import { supabase } from '@/lib/supabase/client'
import { processMCPWithTags } from '@/lib/mcp/processor'
import { checkMCPHealth } from './healthChecker'
import type { MCP } from '@/types'

interface CrawlerConfig {
  enabled: boolean
  sources: CrawlerSource[]
  rateLimitMs: number
  maxNewMCPsPerRun: number
  firecrawlApiKey?: string
  healthCheckEnabled: boolean
  healthCheckTimeout: number
}

interface CrawlerSource {
  name: string
  url: string
  type: 'github-list' | 'awesome-list' | 'documentation' | 'registry'
  enabled: boolean
  selector?: string
  extractionRules: ExtractionRules
}

interface ExtractionRules {
  namePattern: RegExp
  descriptionPattern?: RegExp
  githubUrlPattern: RegExp
  categoryMapping?: Record<string, string>
}

interface CrawlerResult {
  discovered: number
  processed: number
  failed: number
  skipped: number
  newMCPs: Array<{
    name: string
    success: boolean
    tags?: string[]
    error?: string
  }>
  errors: string[]
}

/**
 * Main MCP Crawler Class
 */
export class MCPCrawler {
  private config: CrawlerConfig
  private isRunning = false

  constructor(config?: Partial<CrawlerConfig>) {
    this.config = {
      enabled: false, // DISABLED BY DEFAULT
      rateLimitMs: 2000,
      maxNewMCPsPerRun: 20,
      firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
      healthCheckEnabled: true, // Health check by default
      healthCheckTimeout: 10000, // 10 seconds timeout
      sources: [
        {
          name: 'Official MCP Servers',
          url: 'https://github.com/modelcontextprotocol/servers',
          type: 'github-list',
          enabled: true,
          extractionRules: {
            namePattern: /^([^\/]+)\/([^\/]+)$/,
            githubUrlPattern: /https:\/\/github\.com\/[^\/]+\/[^\/]+/,
            categoryMapping: {
              'official': 'official',
              'community': 'community'
            }
          }
        },
        {
          name: 'Awesome MCP Servers',
          url: 'https://github.com/punkpeye/awesome-mcp-servers',
          type: 'awesome-list',
          enabled: true,
          extractionRules: {
            namePattern: /\[([^\]]+)\]\(([^)]+)\)/,
            githubUrlPattern: /https:\/\/github\.com\/[^\/]+\/[^\/]+/
          }
        },
        {
          name: 'MCP Documentation',
          url: 'https://modelcontextprotocol.io/servers',
          type: 'documentation',
          enabled: true,
          extractionRules: {
            namePattern: /^([A-Za-z0-9\s-_]+)$/,
            githubUrlPattern: /https:\/\/github\.com\/[^\/]+\/[^\/]+/
          }
        },
        {
          name: 'GitHub Search - Popular MCPs',
          url: 'https://github.com/search?q=mcp&type=repositories&s=stars&o=desc',
          type: 'github-search',
          enabled: true,
          extractionRules: {
            namePattern: /\/([^\/]+)\/([^\/]+)$/,
            githubUrlPattern: /https:\/\/github\.com\/[^\/]+\/[^\/]+/
          }
        },
        {
          name: 'GitHub Search - Recent MCPs',
          url: 'https://github.com/search?q=mcp&type=repositories&s=updated&o=desc',
          type: 'github-search',
          enabled: true,
          extractionRules: {
            namePattern: /\/([^\/]+)\/([^\/]+)$/,
            githubUrlPattern: /https:\/\/github\.com\/[^\/]+\/[^\/]+/
          }
        }
      ],
      ...config
    }
  }

  /**
   * Check if crawler is enabled and configured
   */
  isEnabled(): boolean {
    return this.config.enabled && Boolean(this.config.firecrawlApiKey)
  }

  /**
   * Enable/disable the crawler
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    console.log(`MCP Crawler ${enabled ? 'ENABLED' : 'DISABLED'}`)
  }

  /**
   * Main crawler execution
   */
  async run(): Promise<CrawlerResult> {
    if (!this.isEnabled()) {
      throw new Error('MCP Crawler is disabled. Enable it before running.')
    }

    if (this.isRunning) {
      throw new Error('Crawler is already running')
    }

    this.isRunning = true
    const startTime = Date.now()
    
    console.log('🕷️ Starting MCP crawler...')

    const result: CrawlerResult = {
      discovered: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      newMCPs: [],
      errors: []
    }

    try {
      // Get existing MCPs to avoid duplicates
      const existingMCPs = await this.getExistingMCPs()
      console.log(`📊 Found ${existingMCPs.size} existing MCPs in database`)

      // Crawl each enabled source
      for (const source of this.config.sources.filter(s => s.enabled)) {
        try {
          console.log(`🔍 Crawling source: ${source.name}`)
          const discovered = await this.crawlSource(source, existingMCPs)
          
          result.discovered += discovered.length
          console.log(`📦 Discovered ${discovered.length} MCPs from ${source.name}`)

          // Process new MCPs with health checking and AI tag generation
          for (const mcp of discovered.slice(0, this.config.maxNewMCPsPerRun)) {
            try {
              console.log(`⚡ Processing MCP: ${mcp.name}`)
              
              // Health check first if enabled
              if (this.config.healthCheckEnabled) {
                console.log(`🏥 Health checking: ${mcp.name}`)
                const healthResult = await checkMCPHealth({
                  name: mcp.name || '',
                  endpoint: mcp.endpoint || '',
                  github_url: mcp.github_url,
                  connection_type: mcp.connection_type
                })

                // Update MCP with health information
                mcp.health_status = healthResult.status === 'healthy' || healthResult.status === 'requires_auth' 
                  ? 'healthy' 
                  : healthResult.status === 'error' 
                    ? 'down' 
                    : 'unknown'

                // Add auth info if detected
                if (healthResult.requiresAuth && healthResult.authType) {
                  mcp.auth_method = healthResult.authType
                }

                console.log(`🏥 Health check result for ${mcp.name}: ${healthResult.status} (${healthResult.responseTime}ms)`)

                // Skip if MCP is confirmed down/unreachable
                if (healthResult.status === 'unreachable' || (healthResult.status === 'error' && !mcp.github_url)) {
                  result.skipped++
                  result.newMCPs.push({
                    name: mcp.name,
                    success: false,
                    error: `Health check failed: ${healthResult.error}`
                  })
                  console.log(`⚠️ Skipping unhealthy MCP: ${mcp.name} - ${healthResult.error}`)
                  continue
                }
              }

              // Process with AI tag generation
              const processResult = await processMCPWithTags(mcp, {
                forceTagRegeneration: true,
                includeGitHubAnalysis: true
              })

              if (processResult.success) {
                result.processed++
                result.newMCPs.push({
                  name: mcp.name,
                  success: true,
                  tags: processResult.tags
                })
                console.log(`✅ Successfully processed: ${mcp.name}`)
              } else {
                result.failed++
                result.newMCPs.push({
                  name: mcp.name,
                  success: false,
                  error: processResult.error
                })
                console.log(`❌ Failed to process: ${mcp.name} - ${processResult.error}`)
              }

              // Rate limiting
              await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs))

            } catch (error) {
              result.failed++
              const errorMsg = error instanceof Error ? error.message : 'Unknown error'
              result.errors.push(`Failed to process ${mcp.name}: ${errorMsg}`)
              console.error(`❌ Error processing ${mcp.name}:`, error)
            }
          }

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          result.errors.push(`Failed to crawl ${source.name}: ${errorMsg}`)
          console.error(`❌ Error crawling ${source.name}:`, error)
        }
      }

      const duration = Date.now() - startTime
      console.log(`🏁 Crawler completed in ${duration}ms`)
      console.log(`📊 Results: ${result.processed} processed, ${result.failed} failed, ${result.skipped} skipped`)

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Crawler failed: ${errorMsg}`)
      console.error('❌ Crawler failed:', error)
    } finally {
      this.isRunning = false
    }

    return result
  }

  /**
   * Get existing MCPs to avoid duplicates
   */
  private async getExistingMCPs(): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('mcps')
      .select('name, github_url')

    if (error) throw error

    const existing = new Set<string>()
    data?.forEach(mcp => {
      existing.add(mcp.name.toLowerCase())
      if (mcp.github_url) {
        existing.add(this.normalizeGitHubUrl(mcp.github_url))
      }
    })

    return existing
  }

  /**
   * Crawl a specific source for MCPs
   */
  private async crawlSource(source: CrawlerSource, existing: Set<string>): Promise<Partial<MCP>[]> {
    if (!this.config.firecrawlApiKey) {
      throw new Error('Firecrawl API key not configured')
    }

    // Use Firecrawl to scrape the source
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.firecrawlApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: source.url,
        formats: ['markdown'],
        onlyMainContent: true
      })
    })

    if (!response.ok) {
      throw new Error(`Firecrawl error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.data?.markdown || ''

    // Extract MCPs based on source type
    return this.extractMCPsFromContent(content, source, existing)
  }

  /**
   * Extract MCP information from scraped content
   */
  private extractMCPsFromContent(
    content: string, 
    source: CrawlerSource, 
    existing: Set<string>
  ): Partial<MCP>[] {
    const mcps: Partial<MCP>[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      try {
        const mcp = this.extractMCPFromLine(line, source)
        if (mcp && this.isNewMCP(mcp, existing)) {
          mcps.push(mcp)
        }
      } catch (error) {
        console.warn('Error extracting MCP from line:', line, error)
      }
    }

    return mcps
  }

  /**
   * Extract MCP from a single line of content
   */
  private extractMCPFromLine(line: string, source: CrawlerSource): Partial<MCP> | null {
    const { extractionRules } = source
    
    // Look for GitHub URLs and names
    const githubMatch = line.match(extractionRules.githubUrlPattern)
    if (!githubMatch) return null

    const githubUrl = githubMatch[0]
    
    // Extract name from GitHub URL or markdown link
    let name = ''
    const nameMatch = line.match(extractionRules.namePattern)
    if (nameMatch) {
      name = nameMatch[1] || nameMatch[2] || ''
    } else {
      // Fallback: extract from GitHub URL
      const urlParts = githubUrl.split('/')
      name = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || ''
    }

    if (!name) return null

    // Extract description if pattern provided
    let description = ''
    if (extractionRules.descriptionPattern) {
      const descMatch = line.match(extractionRules.descriptionPattern)
      description = descMatch?.[1] || ''
    }

    // Determine category
    const category = this.determineCategory(name, description, source)
    
    // Extract author from GitHub URL
    const author = githubUrl ? this.extractAuthorFromGithubUrl(githubUrl) : undefined
    const verified = source.name.includes('Official')

    return {
      name: this.cleanName(name),
      description: description || undefined,
      github_url: githubUrl,
      category,
      slug: this.generateSlug(name, author, verified),
      endpoint: '', // Will be determined during processing
      connection_type: 'stdio',
      protocol_version: '1.0',
      pricing_model: 'free',
      pricing_details: {},
      tags: [],
      use_cases: [],
      verified: source.name.includes('Official'),
      auto_discovered: true,
      discovery_source: source.name,
      health_status: 'unknown',
      tool_endpoints: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  /**
   * Check if MCP is new (not in existing set)
   */
  private isNewMCP(mcp: Partial<MCP>, existing: Set<string>): boolean {
    if (!mcp.name) return false
    
    const normalizedName = mcp.name.toLowerCase()
    const normalizedUrl = mcp.github_url ? this.normalizeGitHubUrl(mcp.github_url) : ''
    
    return !existing.has(normalizedName) && !existing.has(normalizedUrl)
  }

  /**
   * Normalize GitHub URL for comparison
   */
  private normalizeGitHubUrl(url: string): string {
    return url.toLowerCase().replace(/\/$/, '').replace(/\.git$/, '')
  }

  /**
   * Clean and normalize MCP name
   */
  private cleanName(name: string): string {
    return name
      .replace(/^[@#-]+/, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  /**
   * Extract author/organization from GitHub URL
   */
  private extractAuthorFromGithubUrl(githubUrl: string): string | undefined {
    try {
      const url = new URL(githubUrl)
      const pathParts = url.pathname.split('/').filter(Boolean)
      return pathParts[0] // First part is the username/organization
    } catch {
      return undefined
    }
  }

  /**
   * Generate slug from name, author, and verified status
   * Official MCPs: just the name (remove "Official" suffix)
   * Community MCPs: {name}-{author}
   */
  private generateSlug(name: string, author?: string, verified?: boolean): string {
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
   * Determine category based on name, description, and source
   */
  private determineCategory(name: string, description: string, source: CrawlerSource): string {
    const text = `${name} ${description}`.toLowerCase()
    
    // Category keywords mapping
    const categoryKeywords: Record<string, string[]> = {
      'communication': ['slack', 'discord', 'teams', 'chat', 'message', 'notification'],
      'development': ['github', 'git', 'code', 'build', 'ci', 'cd', 'deploy', 'docker'],
      'productivity': ['notion', 'todoist', 'calendar', 'task', 'note', 'planning'],
      'databases': ['mongodb', 'postgres', 'mysql', 'database', 'sql', 'data'],
      'ai-tools': ['openai', 'anthropic', 'llm', 'ai', 'ml', 'neural', 'model'],
      'fintech': ['stripe', 'payment', 'billing', 'finance', 'money', 'transaction'],
      'cloud': ['aws', 'azure', 'gcp', 'cloudflare', 'cloud', 'serverless'],
      'monitoring': ['datadog', 'newrelic', 'monitoring', 'observability', 'metrics']
    }

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category
      }
    }

    // Use source category mapping if available
    if (source.extractionRules.categoryMapping) {
      for (const [pattern, category] of Object.entries(source.extractionRules.categoryMapping)) {
        if (text.includes(pattern)) {
          return category
        }
      }
    }

    return 'tools' // Default category
  }
}

/**
 * Singleton crawler instance
 */
export const mcpCrawler = new MCPCrawler()

/**
 * Manual crawler execution function
 */
export async function runMCPCrawler(): Promise<CrawlerResult> {
  return mcpCrawler.run()
}

/**
 * Enable/disable crawler
 */
export function enableCrawler(enabled: boolean): void {
  mcpCrawler.setEnabled(enabled)
}

/**
 * Check if crawler is enabled
 */
export function isCrawlerEnabled(): boolean {
  return mcpCrawler.isEnabled()
}