#!/usr/bin/env tsx

/**
 * Parameter Formatting Migration Script
 * 
 * Fixes concatenated parameters in existing MCP commands in the database.
 * This addresses issues like:
 * - "docker run -i--rm-e GITHUB_PERSONAL_ACCESS_TOKEN" 
 * - "npx @package/name--flag=value"
 * - Missing spaces between parameters
 */

import { supabase } from '../lib/supabase/client'

interface MCP {
  id: string
  name: string
  endpoint: string
  installation_methods?: Array<{
    type: string
    command: string
    description?: string
    priority: number
  }>
}

/**
 * Fix parameter formatting in commands
 */
function fixCommandFormatting(command: string): string {
  if (!command || typeof command !== 'string') {
    return command
  }

  return command
    // Remove markdown code block markers
    .replace(/```[a-z]*\n?/g, '')
    // Remove $ or > prompts
    .replace(/^[\$>]\s*/gm, '')
    // Fix common parameter concatenation issues
    .replace(/([a-zA-Z0-9])(-[a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--[a-zA-Z])/g, '$1 $2')
    // Fix Docker parameter concatenation
    .replace(/([a-zA-Z0-9])(-e\s+)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(-p\s+)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(-v\s+)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(-i)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--rm)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--name)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--env)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--volume)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--port)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--detach)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--interactive)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--tty)/g, '$1 $2')
    // Fix NPM parameter concatenation 
    .replace(/([a-zA-Z0-9])(@[a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--save)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--global)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--yes)/g, '$1 $2')
    // Fix Python parameter concatenation
    .replace(/([a-zA-Z0-9])(--user)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--upgrade)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--force)/g, '$1 $2')
    // Fix git parameter concatenation
    .replace(/([a-zA-Z0-9])(--recursive)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--depth)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--branch)/g, '$1 $2')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fix installation methods array
 */
function fixInstallationMethods(methods: any[]): any[] {
  if (!Array.isArray(methods)) {
    return methods
  }

  return methods.map(method => ({
    ...method,
    command: fixCommandFormatting(method.command)
  }))
}

/**
 * Analyze what would be changed (dry run)
 */
async function analyzeChanges(): Promise<void> {
  console.log('🔍 Analyzing parameter formatting issues...\n')

  const { data: mcps, error } = await supabase
    .from('mcps')
    .select('id, name, endpoint, installation_methods')
    .order('name')

  if (error) {
    console.error('Error fetching MCPs:', error)
    return
  }

  let totalMCPs = 0
  let endpointIssues = 0
  let installationMethodIssues = 0
  const examples: string[] = []

  for (const mcp of mcps) {
    totalMCPs++
    let hasIssues = false

    // Check endpoint
    if (mcp.endpoint) {
      const fixed = fixCommandFormatting(mcp.endpoint)
      if (fixed !== mcp.endpoint) {
        endpointIssues++
        hasIssues = true
        if (examples.length < 5) {
          examples.push(`📦 ${mcp.name}:\n  Before: ${mcp.endpoint}\n  After:  ${fixed}\n`)
        }
      }
    }

    // Check installation methods
    if (mcp.installation_methods && Array.isArray(mcp.installation_methods)) {
      for (const method of mcp.installation_methods) {
        if (method.command) {
          const fixed = fixCommandFormatting(method.command)
          if (fixed !== method.command) {
            installationMethodIssues++
            hasIssues = true
            if (examples.length < 5) {
              examples.push(`📦 ${mcp.name} (${method.type}):\n  Before: ${method.command}\n  After:  ${fixed}\n`)
            }
            break // Only count once per MCP
          }
        }
      }
    }
  }

  console.log('📊 Analysis Results:')
  console.log(`   Total MCPs: ${totalMCPs}`)
  console.log(`   Endpoint issues: ${endpointIssues}`)
  console.log(`   Installation method issues: ${installationMethodIssues}`)
  console.log(`   Total MCPs needing fixes: ${endpointIssues + installationMethodIssues}\n`)

  if (examples.length > 0) {
    console.log('📝 Example fixes:\n')
    examples.forEach(example => console.log(example))
  }

  if (endpointIssues === 0 && installationMethodIssues === 0) {
    console.log('✅ No formatting issues found!')
  }
}

/**
 * Apply fixes to the database
 */
async function applyFixes(): Promise<void> {
  console.log('🔧 Applying parameter formatting fixes...\n')

  const { data: mcps, error } = await supabase
    .from('mcps')
    .select('id, name, endpoint, installation_methods')

  if (error) {
    console.error('Error fetching MCPs:', error)
    return
  }

  let updated = 0
  let errors = 0

  for (const mcp of mcps) {
    try {
      let needsUpdate = false
      const updates: any = {}

      // Fix endpoint
      if (mcp.endpoint) {
        const fixedEndpoint = fixCommandFormatting(mcp.endpoint)
        if (fixedEndpoint !== mcp.endpoint) {
          updates.endpoint = fixedEndpoint
          needsUpdate = true
        }
      }

      // Fix installation methods
      if (mcp.installation_methods && Array.isArray(mcp.installation_methods)) {
        const fixedMethods = fixInstallationMethods(mcp.installation_methods)
        if (JSON.stringify(fixedMethods) !== JSON.stringify(mcp.installation_methods)) {
          updates.installation_methods = fixedMethods
          needsUpdate = true
        }
      }

      if (needsUpdate) {
        updates.updated_at = new Date().toISOString()
        
        const { error: updateError } = await supabase
          .from('mcps')
          .update(updates)
          .eq('id', mcp.id)

        if (updateError) {
          console.error(`❌ Error updating ${mcp.name}:`, updateError)
          errors++
        } else {
          console.log(`✅ Fixed ${mcp.name}`)
          updated++
        }
      }
    } catch (err) {
      console.error(`❌ Error processing ${mcp.name}:`, err)
      errors++
    }
  }

  console.log(`\n📊 Migration Results:`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Errors: ${errors}`)
  console.log(`   Total processed: ${mcps.length}`)

  if (updated > 0) {
    console.log('\n✅ Parameter formatting migration completed successfully!')
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run') || args.includes('--analyze')
  const isForced = args.includes('--force')

  console.log('🛠️  Parameter Formatting Migration Script')
  console.log('=========================================\n')

  if (isDryRun) {
    await analyzeChanges()
    console.log('\n💡 Run with --force to apply these fixes to the database.')
    return
  }

  if (!isForced) {
    console.log('⚠️  This will modify the database. Run with --dry-run first to preview changes.')
    console.log('   Use --force to apply fixes.\n')
    return
  }

  console.log('⚠️  Applying fixes to production database...\n')
  await applyFixes()
}

// Execute if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { fixCommandFormatting, fixInstallationMethods, analyzeChanges, applyFixes }