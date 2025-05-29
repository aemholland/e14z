#!/usr/bin/env node

/**
 * Script to generate/regenerate comprehensive tags for MCP servers
 * Can be run manually or integrated into CI/CD pipeline
 */

import { processMCPWithTags, regenerateInsufficientTags, batchProcessMCPsWithTags } from '../lib/mcp/processor'
import { supabase } from '../lib/supabase/client'

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'regenerate-all':
      await regenerateAllTags()
      break
    
    case 'regenerate-insufficient':
      await regenerateInsufficientTagsCommand()
      break
    
    case 'generate-for-mcp':
      const mcpName = args[1]
      if (!mcpName) {
        console.error('Please provide MCP name: npm run generate-tags generate-for-mcp "GitHub Official"')
        process.exit(1)
      }
      await generateForSpecificMCP(mcpName)
      break
    
    case 'test-generation':
      await testTagGeneration()
      break
    
    default:
      showUsage()
  }
}

async function regenerateAllTags() {
  console.log('🔄 Regenerating tags for ALL MCP servers...')
  
  try {
    // Fetch all MCPs
    const { data: mcps, error } = await supabase
      .from('mcps')
      .select('*')

    if (error) throw error

    console.log(`Found ${mcps?.length || 0} MCP servers`)

    const result = await batchProcessMCPsWithTags(mcps || [], {
      forceTagRegeneration: true,
      includeGitHubAnalysis: true
    })

    console.log('\n✅ Tag regeneration complete!')
    console.log(`📊 Results:`)
    console.log(`   - Processed: ${result.processed}`)
    console.log(`   - Failed: ${result.failed}`)
    console.log(`   - Success rate: ${(result.processed / (result.processed + result.failed) * 100).toFixed(1)}%`)

    // Show detailed results
    console.log('\n📋 Detailed Results:')
    result.results.forEach(r => {
      if (r.success) {
        console.log(`   ✅ ${r.name}: ${r.tags?.length || 0} tags generated`)
      } else {
        console.log(`   ❌ ${r.name}: ${r.error}`)
      }
    })

  } catch (error) {
    console.error('❌ Error regenerating tags:', error)
    process.exit(1)
  }
}

async function regenerateInsufficientTagsCommand() {
  console.log('🔄 Regenerating tags for MCPs with insufficient tag coverage...')
  
  try {
    const result = await regenerateInsufficientTags()

    console.log('\n✅ Insufficient tag regeneration complete!')
    console.log(`📊 Results:`)
    console.log(`   - Updated: ${result.updated}`)
    console.log(`   - Failed: ${result.failed}`)

    // Show detailed results
    console.log('\n📋 Tag Count Changes:')
    result.results.forEach(r => {
      if (r.success) {
        console.log(`   ✅ ${r.name}: ${r.oldTagCount} → ${r.newTagCount} tags`)
      } else {
        console.log(`   ❌ ${r.name}: Failed to update`)
      }
    })

  } catch (error) {
    console.error('❌ Error regenerating insufficient tags:', error)
    process.exit(1)
  }
}

async function generateForSpecificMCP(mcpName: string) {
  console.log(`🔄 Generating tags for: ${mcpName}`)
  
  try {
    // Find the MCP
    const { data: mcp, error } = await supabase
      .from('mcps')
      .select('*')
      .eq('name', mcpName)
      .single()

    if (error) throw error
    if (!mcp) {
      console.error(`❌ MCP not found: ${mcpName}`)
      process.exit(1)
    }

    console.log(`📋 Current tags (${mcp.tags?.length || 0}): ${mcp.tags?.join(', ') || 'None'}`)

    const result = await processMCPWithTags(mcp, {
      forceTagRegeneration: true,
      includeGitHubAnalysis: true
    })

    if (result.success) {
      console.log(`\n✅ Tag generation complete!`)
      console.log(`📊 Generated ${result.tags?.length || 0} tags:`)
      console.log(`   ${result.tags?.join(', ') || 'None'}`)
    } else {
      console.error(`❌ Tag generation failed: ${result.error}`)
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Error generating tags for specific MCP:', error)
    process.exit(1)
  }
}

async function testTagGeneration() {
  console.log('🧪 Testing tag generation with sample data...')
  
  const sampleMCP = {
    name: 'Test MCP Server',
    description: 'A test MCP server for automated task management and team collaboration',
    category: 'productivity',
    use_cases: ['task-management', 'team-collaboration', 'workflow-automation'],
    github_url: 'https://github.com/example/test-mcp'
  }

  try {
    const result = await processMCPWithTags(sampleMCP, {
      forceTagRegeneration: true,
      includeGitHubAnalysis: false // Skip GitHub for test
    })

    if (result.success) {
      console.log(`\n✅ Test tag generation successful!`)
      console.log(`📊 Generated ${result.tags?.length || 0} tags:`)
      console.log(`   ${result.tags?.join(', ') || 'None'}`)
    } else {
      console.error(`❌ Test failed: ${result.error}`)
    }

  } catch (error) {
    console.error('❌ Test error:', error)
  }
}

function showUsage() {
  console.log(`
🏷️  MCP Tag Generation Tool

Usage:
  npm run generate-tags <command> [options]

Commands:
  regenerate-all              Regenerate tags for all MCP servers
  regenerate-insufficient     Only regenerate for MCPs with < 15 tags  
  generate-for-mcp <name>     Generate tags for specific MCP
  test-generation             Test tag generation with sample data

Examples:
  npm run generate-tags regenerate-all
  npm run generate-tags regenerate-insufficient
  npm run generate-tags generate-for-mcp "GitHub Official"
  npm run generate-tags test-generation

Notes:
  - Uses AI/LLM for comprehensive tag generation
  - Includes GitHub repository analysis when available
  - Generates 25-35 tags optimized for AI agent search
  - Rate limited to avoid API throttling
`)
}

// Add to package.json scripts
function updatePackageJsonScripts() {
  console.log(`
📝 Add this to your package.json scripts section:

"scripts": {
  "generate-tags": "tsx scripts/generateTags.ts",
  "generate-tags:all": "tsx scripts/generateTags.ts regenerate-all",
  "generate-tags:insufficient": "tsx scripts/generateTags.ts regenerate-insufficient"
}
`)
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
}

export { main as generateTagsScript }