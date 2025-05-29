#!/usr/bin/env node

/**
 * Clean Database Formatting Script
 * 
 * Updates existing database entries to use clean formatting:
 * - Categories: replace dashes/underscores with spaces
 * - Auth methods: replace dashes/underscores with spaces  
 * - Use cases: replace dashes/underscores with spaces
 * - Removes pricing information (set all to 'free')
 */

import { createClient } from '@supabase/supabase-js'
import { formatCategory, formatAuthMethod, formatUseCase } from '../lib/utils/formatting'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Clean a string by replacing dashes and underscores with spaces
 */
function cleanString(str: string): string {
  if (!str) return str
  return str.replace(/[-_]/g, ' ').trim()
}

/**
 * Clean array of strings
 */
function cleanStringArray(arr: string[]): string[] {
  if (!Array.isArray(arr)) return arr
  return arr.map(cleanString)
}

async function main() {
  console.log('🧹 Starting database formatting cleanup...\n')

  try {
    // Get all MCPs
    console.log('📊 Fetching all MCPs from database...')
    const { data: mcps, error: fetchError } = await supabase
      .from('mcps')
      .select('*')
      .order('name')

    if (fetchError) {
      throw new Error(`Failed to fetch MCPs: ${fetchError.message}`)
    }

    if (!mcps || mcps.length === 0) {
      console.log('ℹ️ No MCPs found in database')
      return
    }

    console.log(`📦 Found ${mcps.length} MCPs to process\n`)

    let updateCount = 0
    let skipCount = 0

    // Process each MCP
    for (const mcp of mcps) {
      console.log(`🔍 Processing: ${mcp.name}`)
      
      // Prepare updates
      const updates: any = {}
      let hasUpdates = false

      // Clean category with proper formatting
      if (mcp.category) {
        const formattedCategory = formatCategory(mcp.category)
        if (formattedCategory !== mcp.category) {
          updates.category = formattedCategory
          hasUpdates = true
          console.log(`   📂 Category: "${mcp.category}" → "${formattedCategory}"`)
        }
      }

      // Clean auth_method with proper formatting
      if (mcp.auth_method) {
        const formattedAuthMethod = formatAuthMethod(mcp.auth_method)
        if (formattedAuthMethod !== mcp.auth_method) {
          updates.auth_method = formattedAuthMethod
          hasUpdates = true
          console.log(`   🔑 Auth method: "${mcp.auth_method}" → "${formattedAuthMethod}"`)
        }
      }

      // Clean use_cases with proper formatting
      if (mcp.use_cases && Array.isArray(mcp.use_cases) && mcp.use_cases.length > 0) {
        const formattedUseCases = mcp.use_cases.map((uc: string) => formatUseCase(uc))
        const hasChanges = formattedUseCases.some((formatted, index) => formatted !== mcp.use_cases[index])
        
        if (hasChanges) {
          updates.use_cases = formattedUseCases
          hasUpdates = true
          console.log(`   🎯 Use cases formatted: ${mcp.use_cases.length} items`)
        }
      }

      // Set pricing to 'free' if not already
      if (mcp.pricing_model !== 'free') {
        updates.pricing_model = 'free'
        updates.pricing_details = {}
        hasUpdates = true
        console.log(`   💰 Pricing: "${mcp.pricing_model}" → "free"`)
      }

      // Update timestamps
      if (hasUpdates) {
        updates.updated_at = new Date().toISOString()
      }

      // Apply updates if needed
      if (hasUpdates) {
        const { error: updateError } = await supabase
          .from('mcps')
          .update(updates)
          .eq('id', mcp.id)

        if (updateError) {
          console.log(`   ❌ Failed to update: ${updateError.message}`)
        } else {
          console.log(`   ✅ Updated successfully`)
          updateCount++
        }
      } else {
        console.log(`   ⏭️ No updates needed`)
        skipCount++
      }

      console.log('')
    }

    // Summary
    console.log('🏁 Cleanup completed!\n')
    console.log('📊 Summary:')
    console.log(`   ✅ Updated: ${updateCount} MCPs`)
    console.log(`   ⏭️ Skipped: ${skipCount} MCPs`)
    console.log(`   📦 Total: ${mcps.length} MCPs`)

    if (updateCount > 0) {
      console.log('\n🎉 Database formatting has been cleaned!')
      console.log('   - Categories properly capitalized (e.g., "AI Tools", "FinTech")')
      console.log('   - Auth methods properly formatted (e.g., "API Key", "Personal Access Token")')
      console.log('   - Use cases formatted with proper title case')
      console.log('   - Acronyms capitalized (API, URL, ID, etc.)')
      console.log('   - All pricing set to "free"')
    }

  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})