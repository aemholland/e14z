#!/usr/bin/env tsx

/**
 * E14Z Deduplication Script
 * 
 * This script helps identify and resolve duplicate MCPs in the database.
 * It can be run manually or as part of the crawler process.
 * 
 * Usage:
 *   npx tsx scripts/deduplicate.ts [--dry-run] [--auto-merge]
 */

import { supabase } from '../lib/supabase/client'
import { deduplicateBatch, generateMergeStrategy } from '../lib/utils/deduplication'
import type { MCP } from '../types'

interface DeduplicationOptions {
  dryRun: boolean
  autoMerge: boolean
  verbose: boolean
}

async function main() {
  const args = process.argv.slice(2)
  const options: DeduplicationOptions = {
    dryRun: args.includes('--dry-run'),
    autoMerge: args.includes('--auto-merge'),
    verbose: args.includes('--verbose') || args.includes('-v')
  }

  console.log('🔍 E14Z Deduplication Tool')
  console.log('==========================')
  
  if (options.dryRun) {
    console.log('📋 Running in DRY RUN mode - no changes will be made')
  }

  // Get all MCPs from database
  console.log('\n📊 Fetching all MCPs from database...')
  const { data: allMCPs, error } = await supabase
    .from('mcps')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error fetching MCPs:', error)
    process.exit(1)
  }

  if (!allMCPs || allMCPs.length === 0) {
    console.log('✅ No MCPs found in database')
    return
  }

  console.log(`📈 Found ${allMCPs.length} MCPs to analyze`)

  // Convert to input format for batch processing
  const mcpInputs = allMCPs.map(mcp => ({
    name: mcp.name,
    endpoint: mcp.endpoint,
    github_url: mcp.github_url,
    slug: mcp.slug
  }))

  // Run batch deduplication
  console.log('\n🔄 Running deduplication analysis...')
  const results = await deduplicateBatch(mcpInputs)

  // Report results
  console.log('\n📊 Deduplication Results:')
  console.log(`✅ Unique MCPs: ${results.unique.length}`)
  console.log(`🔄 Potential duplicates: ${results.duplicates.length}`)
  console.log(`🔀 Potential merges: ${results.potentialMerges.length}`)

  if (results.duplicates.length > 0) {
    console.log('\n🚨 Potential Duplicates Found:')
    console.log('===================================')
    
    for (const duplicate of results.duplicates) {
      console.log(`\n📌 ${duplicate.mcp.name}`)
      console.log(`   Reason: ${duplicate.reason}`)
      
      if (duplicate.existing) {
        console.log(`   Conflicts with: ${duplicate.existing.name}`)
        console.log(`   Existing slug: ${duplicate.existing.slug}`)
      }
      
      if (options.verbose) {
        console.log(`   Endpoint: ${duplicate.mcp.endpoint}`)
        if (duplicate.mcp.github_url) {
          console.log(`   GitHub: ${duplicate.mcp.github_url}`)
        }
      }
    }

    if (!options.dryRun) {
      console.log('\n⚠️  Manual review required for duplicates')
      console.log('   Use --dry-run to preview without making changes')
    }
  }

  if (results.potentialMerges.length > 0) {
    console.log('\n🔀 Potential Merge Candidates:')
    console.log('===============================')
    
    for (const merge of results.potentialMerges) {
      console.log(`\n🔗 ${merge.new.name} → ${merge.existing.name}`)
      console.log('   Suggestions:')
      
      for (const suggestion of merge.suggestions) {
        console.log(`   • ${suggestion}`)
      }

      if (options.autoMerge && !options.dryRun) {
        console.log('   🤖 Auto-merging...')
        await performMerge(merge.new, merge.existing as MCP)
      }
    }

    if (!options.autoMerge) {
      console.log('\n💡 Run with --auto-merge to automatically apply safe merges')
    }
  }

  // Database health check
  console.log('\n🏥 Database Health Check:')
  console.log('=========================')
  
  await performHealthCheck()

  console.log('\n✅ Deduplication analysis complete!')
  
  if (options.dryRun) {
    console.log('💡 Run without --dry-run to apply changes')
  }
}

async function performMerge(newMCP: any, existingMCP: MCP) {
  try {
    // Generate merge strategy
    const strategy = generateMergeStrategy(newMCP, existingMCP)
    
    if (!strategy.canMerge || !strategy.mergedData) {
      console.log(`   ⚠️  Cannot safely merge ${newMCP.name}`)
      return
    }

    // Update existing MCP with merged data
    const { error } = await supabase
      .from('mcps')
      .update(strategy.mergedData)
      .eq('id', existingMCP.id)

    if (error) {
      console.error(`   ❌ Error merging ${newMCP.name}:`, error)
    } else {
      console.log(`   ✅ Successfully merged ${newMCP.name}`)
    }
  } catch (error) {
    console.error(`   ❌ Merge failed for ${newMCP.name}:`, error)
  }
}

async function performHealthCheck() {
  // Check for MCPs with missing required fields
  const { data: missingData } = await supabase
    .from('mcps')
    .select('id, slug, name, endpoint, description')
    .or('description.is.null,endpoint.is.null')

  if (missingData && missingData.length > 0) {
    console.log(`⚠️  ${missingData.length} MCPs missing required data`)
    
    for (const mcp of missingData) {
      const issues = []
      if (!mcp.description) issues.push('description')
      if (!mcp.endpoint) issues.push('endpoint')
      
      console.log(`   • ${mcp.name}: missing ${issues.join(', ')}`)
    }
  }

  // Check for MCPs with invalid endpoints
  const { data: allMCPs } = await supabase
    .from('mcps')
    .select('id, slug, name, endpoint')

  if (allMCPs) {
    const invalidEndpoints = allMCPs.filter(mcp => 
      !isValidEndpoint(mcp.endpoint)
    )

    if (invalidEndpoints.length > 0) {
      console.log(`⚠️  ${invalidEndpoints.length} MCPs with potentially invalid endpoints`)
      
      for (const mcp of invalidEndpoints) {
        console.log(`   • ${mcp.name}: "${mcp.endpoint}"`)
      }
    }
  }

  // Check for orphaned data
  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })

  const { count: perfCount } = await supabase
    .from('performance_logs')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 ${reviewCount || 0} reviews, ${perfCount || 0} performance logs`)

  console.log('✅ Health check complete')
}

function isValidEndpoint(endpoint: string): boolean {
  if (!endpoint) return false
  
  // Check for common valid patterns
  const patterns = [
    /^npx\s+[@\w-]+\/[\w-]+/, // npm packages
    /^https?:\/\/\S+/, // HTTP URLs
    /^wss?:\/\/\S+/, // WebSocket URLs
    /^[\w-]+:\/\/\S+/ // Other protocols
  ]
  
  return patterns.some(pattern => pattern.test(endpoint))
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
}

export { main as deduplicateDatabase }