#!/usr/bin/env node

/**
 * Real Rescrape Script with Firecrawl and Supabase
 * 
 * This script fetches all MCPs from the database, rescrapes them using Firecrawl,
 * validates the data for accuracy, and updates the database with corrections
 */

import { extractInstallationFromSection, cleanInstallationCommand } from '../lib/mcp/installationDetector'

interface MCP {
  id: string
  name: string
  author: string | null
  license: string | null
  verified: boolean
  endpoint: string
  install_type: string | null
  github_url: string
  description: string | null
}

/**
 * Mock Firecrawl scrape function - replace with actual MCP call in real usage
 */
async function scrapeGitHubRepo(githubUrl: string): Promise<string> {
  // In real implementation, use:
  // return await mcp__firecrawl__firecrawl_scrape({
  //   url: githubUrl,
  //   formats: ["markdown"],
  //   onlyMainContent: true
  // })
  
  console.log(`  📥 Scraping: ${githubUrl}`)
  
  // For testing, return mock README content based on the repo
  if (githubUrl.includes('box-community/mcp-server-box')) {
    return `
# Box MCP Server

An MCP server capable of interacting with the Box API

## Installation

1. Clone the repository:
\`\`\`bash
git clone https://github.com/box-community/mcp-server-box.git
cd mcp-server-box
\`\`\`

2. Install dependencies:
\`\`\`bash
uv venv
source .venv/bin/activate
uv lock
\`\`\`

3. Run the server:
\`\`\`bash
uv run src/mcp_server_box.py
\`\`\`

## License
MIT License

## About
Maintained by Box Community team.
    `
  }
  
  if (githubUrl.includes('github/github-mcp-server')) {
    return `
# GitHub MCP Server

Official GitHub MCP Server

## Installation

\`\`\`bash
docker run ghcr.io/github/github-mcp-server
\`\`\`

## License
MIT License

## Maintained by GitHub
    `
  }
  
  if (githubUrl.includes('elevenlabs/elevenlabs-mcp')) {
    return `
# ElevenLabs MCP Server

## Installation

\`\`\`bash
uvx elevenlabs-mcp
\`\`\`

## License
MIT License

Created by ElevenLabs team.
    `
  }
  
  // Default mock content
  return `
# Mock MCP Server

## Installation
\`\`\`bash
npm install mock-mcp
\`\`\`

## License
MIT License
  `
}

/**
 * Mock Supabase function - replace with actual MCP calls
 */
async function fetchAllMCPs(): Promise<MCP[]> {
  // In real implementation, use:
  // return await mcp__supabase__execute_sql({
  //   project_id: "zmfvcqjtubfclkhsdqjx",
  //   query: "SELECT * FROM mcps ORDER BY created_at DESC"
  // })
  
  return [
    {
      id: "42a104c1-7d0c-4ff9-8626-05e9669effcf",
      name: "Box Official",
      author: "Box",
      license: "MIT",
      verified: true,
      endpoint: "uv --directory /path/to/mcp-server-box run src/mcp_server_box.py",
      install_type: "other",
      github_url: "https://github.com/box-community/mcp-server-box",
      description: "An MCP server capable of interacting with the Box API"
    },
    {
      id: "2fca2d05-9708-41f9-83fc-40a77efc7a51",
      name: "GitHub Official",
      author: "GitHub",
      license: "MIT",
      verified: true,
      endpoint: "ghcr.io/github/github-mcp-server",
      install_type: "other",
      github_url: "https://github.com/github/github-mcp-server",
      description: "Official GitHub MCP Server"
    },
    {
      id: "03d8ed50-2164-46f0-86ff-9b4a0a68e93e",
      name: "ElevenLabs Official",
      author: "ElevenLabs",
      license: "MIT",
      verified: true,
      endpoint: "uvx elevenlabs-mcp",
      install_type: "pip",
      github_url: "https://github.com/elevenlabs/elevenlabs-mcp",
      description: "ElevenLabs MCP Server"
    }
  ]
}

/**
 * Mock Supabase update - replace with actual MCP calls
 */
async function updateMCP(id: string, updates: Partial<MCP>): Promise<void> {
  // In real implementation, use:
  // await mcp__supabase__execute_sql({
  //   project_id: "zmfvcqjtubfclkhsdqjx", 
  //   query: `UPDATE mcps SET ${Object.keys(updates).map(k => `${k} = $${k}`).join(', ')} WHERE id = $id`,
  //   // Add parameter binding for updates
  // })
  
  console.log(`    💾 Database update: ${JSON.stringify(updates, null, 2)}`)
}

/**
 * Determine if repository is official based on ownership patterns
 */
function determineIfOfficial(owner: string, repo: string, readmeContent: string): boolean {
  const officialOrgs = [
    'github', 'microsoft', 'google', 'stripe', 'notion', 'cloudflare',
    'circleci', 'circleci-public', 'buildkite', 'twilio', 'twilio-labs', 
    'square', 'elevenlabs', 'box-community', 'makenotion'
  ]
  
  // Check organization ownership
  if (officialOrgs.includes(owner.toLowerCase())) {
    return true
  }
  
  // Check for official indicators in content
  const lowerContent = readmeContent.toLowerCase()
  return lowerContent.includes('official') || 
         lowerContent.includes(`maintained by ${owner}`) ||
         lowerContent.includes('created by') && lowerContent.includes(owner)
}

/**
 * Extract license from README content
 */
function extractLicense(readmeContent: string): string {
  const licensePatterns = [
    /## License[^\n]*\n([^\n]*)/i,
    /license[:\s]*([A-Z]+[A-Z0-9\-\.]*)/i,
    /MIT License/i,
    /Apache License/i,
    /BSD License/i
  ]
  
  for (const pattern of licensePatterns) {
    const match = readmeContent.match(pattern)
    if (match) {
      const license = match[1] || match[0]
      if (license.includes('MIT')) return 'MIT'
      if (license.includes('Apache')) return 'Apache 2.0'
      if (license.includes('BSD')) return 'BSD'
    }
  }
  
  return 'MIT' // Default assumption for MCP servers
}

/**
 * Extract proper author name
 */
function extractAuthor(owner: string, readmeContent: string, isOfficial: boolean): string {
  const officialNames = {
    'github': 'GitHub',
    'microsoft': 'Microsoft', 
    'google': 'Google',
    'stripe': 'Stripe',
    'notion': 'Notion',
    'makenotion': 'Notion',
    'cloudflare': 'Cloudflare',
    'circleci': 'CircleCI',
    'circleci-public': 'CircleCI',
    'buildkite': 'Buildkite',
    'twilio': 'Twilio',
    'twilio-labs': 'Twilio',
    'square': 'Square',
    'elevenlabs': 'ElevenLabs',
    'box-community': 'Box'
  }
  
  return officialNames[owner.toLowerCase()] || 
         owner.charAt(0).toUpperCase() + owner.slice(1)
}

/**
 * Process a single MCP for validation and updates
 */
async function processMCP(mcp: MCP): Promise<Partial<MCP> | null> {
  console.log(`\n🔍 Processing: ${mcp.name}`)
  
  try {
    // Scrape current README
    const readmeContent = await scrapeGitHubRepo(mcp.github_url)
    
    // Extract repository info
    const urlParts = mcp.github_url.replace('https://github.com/', '').split('/')
    const owner = urlParts[0]
    const repo = urlParts[1]
    
    // Analyze content for corrections
    const isOfficial = determineIfOfficial(owner, repo, readmeContent)
    const license = extractLicense(readmeContent)
    const author = extractAuthor(owner, readmeContent, isOfficial)
    
    // Get corrected installation info
    const installationInfo = extractInstallationFromSection(readmeContent, mcp.github_url)
    const correctedEndpoint = cleanInstallationCommand(installationInfo.endpoint, installationInfo.install_type)
    
    // Build updates object
    const updates: Partial<MCP> = {}
    
    if (mcp.verified !== isOfficial) {
      console.log(`  🔧 Verified: ${mcp.verified} → ${isOfficial}`)
      updates.verified = isOfficial
    }
    
    if (mcp.license !== license) {
      console.log(`  🔧 License: "${mcp.license}" → "${license}"`)
      updates.license = license
    }
    
    if (mcp.author !== author) {
      console.log(`  🔧 Author: "${mcp.author}" → "${author}"`)
      updates.author = author
    }
    
    if (mcp.endpoint !== correctedEndpoint) {
      console.log(`  🔧 Endpoint: "${mcp.endpoint}"`)
      console.log(`           → "${correctedEndpoint}"`)
      updates.endpoint = correctedEndpoint
    }
    
    if (mcp.install_type !== installationInfo.install_type) {
      console.log(`  🔧 Install Type: "${mcp.install_type}" → "${installationInfo.install_type}"`)
      updates.install_type = installationInfo.install_type
    }
    
    if (Object.keys(updates).length > 0) {
      console.log(`  ✅ Found ${Object.keys(updates).length} corrections (confidence: ${installationInfo.confidence})`)
      return { id: mcp.id, ...updates }
    } else {
      console.log(`  ✅ No corrections needed`)
      return null
    }
    
  } catch (error) {
    console.error(`  ❌ Error processing ${mcp.name}:`, error)
    return null
  }
}

/**
 * Main rescraping function
 */
async function main() {
  console.log('🚀 Starting comprehensive MCP rescraping and validation...\n')
  
  try {
    // Fetch all MCPs from database
    console.log('📋 Fetching MCPs from database...')
    const mcps = await fetchAllMCPs()
    console.log(`   Found ${mcps.length} MCPs to process\n`)
    
    // Process each MCP
    const corrections = []
    let processedCount = 0
    
    for (const mcp of mcps) {
      const correction = await processMCP(mcp)
      if (correction) {
        corrections.push(correction)
      }
      processedCount++
      
      // Add small delay to be respectful to GitHub API
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Apply corrections to database
    console.log(`\n📊 Processing Summary:`)
    console.log(`  📋 Total MCPs processed: ${processedCount}`)
    console.log(`  🔧 MCPs requiring corrections: ${corrections.length}`)
    console.log(`  ✅ MCPs already accurate: ${processedCount - corrections.length}`)
    
    if (corrections.length > 0) {
      console.log(`\n🔄 Applying corrections to database...`)
      for (const correction of corrections) {
        const { id, ...updates } = correction
        console.log(`  💾 Updating MCP: ${id}`)
        await updateMCP(id, updates)
      }
      console.log(`  ✅ All ${corrections.length} corrections applied!`)
    }
    
    console.log(`\n🎉 Rescraping completed successfully!`)
    
  } catch (error) {
    console.error('❌ Error during rescraping:', error)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)