#!/usr/bin/env node

/**
 * Update all MCP slugs to the new format:
 * - Official MCPs: remove "-official" suffix, just use clean name
 * - Community MCPs: use "{name}-{author}" format
 */

import { supabase } from '../lib/supabase/client'
import { generateSlug } from '../lib/utils/deduplication'

interface MCP {
  id: string
  slug: string
  name: string
  author?: string
  verified: boolean
  github_url?: string
}

/**
 * Extract author from GitHub URL
 */
function extractAuthorFromGithubUrl(githubUrl: string): string | undefined {
  try {
    const url = new URL(githubUrl)
    const pathParts = url.pathname.split('/').filter(Boolean)
    return pathParts[0] // First part is the username/organization
  } catch {
    return undefined
  }
}

async function updateSlugs() {
  console.log('🔄 Starting slug update process...\n')

  // Fetch all MCPs
  const { data: mcps, error } = await supabase
    .from('mcps')
    .select('id, slug, name, author, verified, github_url')
    .order('name')

  if (error) {
    console.error('❌ Error fetching MCPs:', error)
    return
  }

  if (!mcps || mcps.length === 0) {
    console.log('No MCPs found.')
    return
  }

  console.log(`📊 Found ${mcps.length} MCPs to process\n`)

  const updates: { id: string; oldSlug: string; newSlug: string; name: string }[] = []

  for (const mcp of mcps) {
    // Try to get author from the author field or GitHub URL
    let author = mcp.author

    // If no author in field, try to extract from GitHub URL
    if (!author && mcp.github_url) {
      author = extractAuthorFromGithubUrl(mcp.github_url)
    }

    // Generate new slug
    const newSlug = generateSlug(mcp.name, author, mcp.verified)

    if (newSlug !== mcp.slug) {
      updates.push({
        id: mcp.id,
        oldSlug: mcp.slug,
        newSlug,
        name: mcp.name
      })
    }
  }

  if (updates.length === 0) {
    console.log('✅ All slugs are already up to date!')
    return
  }

  console.log(`🔧 Found ${updates.length} slugs that need updating:\n`)

  // Show preview of changes
  updates.forEach(update => {
    console.log(`  ${update.name}`)
    console.log(`    ${update.oldSlug} → ${update.newSlug}`)
    console.log('')
  })

  // Confirm before proceeding
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const proceed = await new Promise<boolean>((resolve) => {
    rl.question('Do you want to proceed with these updates? (y/N): ', (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })

  if (!proceed) {
    console.log('❌ Operation cancelled')
    return
  }

  console.log('\n🔄 Updating slugs...\n')

  // Update slugs in database
  let successCount = 0
  let errorCount = 0

  for (const update of updates) {
    const { error } = await supabase
      .from('mcps')
      .update({ slug: update.newSlug })
      .eq('id', update.id)

    if (error) {
      console.error(`❌ Failed to update ${update.name}:`, error.message)
      errorCount++
    } else {
      console.log(`✅ Updated: ${update.name} → ${update.newSlug}`)
      successCount++
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`  ✅ Successfully updated: ${successCount}`)
  console.log(`  ❌ Failed to update: ${errorCount}`)
  console.log(`  📝 Total processed: ${updates.length}`)

  if (successCount > 0) {
    console.log(`\n🎉 Slug update completed! ${successCount} MCPs now have clean URLs.`)
  }
}

// Run the script
if (require.main === module) {
  updateSlugs().catch(console.error)
}

export { updateSlugs }