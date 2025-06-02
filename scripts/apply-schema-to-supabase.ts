#!/usr/bin/env tsx

/**
 * Apply Database Schema to Real Supabase Instance
 * This script connects to your actual Supabase database and applies the schema
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SCHEMA_FILE = join(process.cwd(), 'scripts/setup-complete-database-schema.sql')

async function applySchemaToSupabase() {
  console.log('🚀 Applying Database Schema to Supabase')
  console.log('=====================================')
  console.log(`Database: ${SUPABASE_URL}`)
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase credentials. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  }

  // Create Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // Test connection
    console.log('🔍 Testing database connection...')
    const { data: testData, error: testError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1)
    
    if (testError) {
      throw new Error(`Database connection failed: ${testError.message}`)
    }
    
    console.log('✅ Database connection successful')

    // Check existing tables
    console.log('\\n📋 Checking existing tables...')
    const { data: existingTables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    if (tablesError) {
      console.warn('Could not check existing tables:', tablesError.message)
    } else {
      console.log(`Found ${existingTables?.length || 0} existing tables:`)
      existingTables?.forEach(table => console.log(`   - ${table.table_name}`))
    }

    // Read and split the schema file
    console.log('\\n📄 Reading schema file...')
    const schemaSQL = readFileSync(SCHEMA_FILE, 'utf-8')
    
    // Split the SQL into individual statements (avoid issues with large transactions)
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'))
    
    console.log(`Found ${statements.length} SQL statements to execute`)

    // Execute statements individually for better error handling
    console.log('\\n🔧 Applying schema...')
    let successCount = 0
    let errorCount = 0
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      if (statement.includes('CREATE TABLE') || statement.includes('CREATE INDEX') || statement.includes('INSERT INTO')) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
          
          if (error) {
            // Some errors are expected (like table already exists)
            if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
              console.log(`   ⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`)
            } else {
              console.error(`   ❌ Error: ${statement.substring(0, 50)}...`)
              console.error(`      ${error.message}`)
              errorCount++
            }
          } else {
            console.log(`   ✅ Applied: ${statement.substring(0, 50)}...`)
            successCount++
          }
        } catch (err) {
          console.error(`   ❌ Exception: ${statement.substring(0, 50)}...`)
          console.error(`      ${err}`)
          errorCount++
        }
      }
    }

    console.log(`\\n📊 Schema Application Results:`)
    console.log(`   ✅ Successful: ${successCount} statements`)
    console.log(`   ❌ Errors: ${errorCount} statements`)

    // Verify critical tables exist
    console.log('\\n🔍 Verifying critical tables...')
    const criticalTables = [
      'security_events',
      'security_alerts', 
      'roles',
      'user_roles',
      'mcp_execution_analytics',
      'organizations'
    ]

    for (const tableName of criticalTables) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)
      
      if (error) {
        console.log(`   ❌ ${tableName}: ${error.message}`)
      } else {
        console.log(`   ✅ ${tableName}: Ready`)
      }
    }

    // Insert default roles if they don't exist
    console.log('\\n👥 Setting up default roles...')
    const { data: existingRoles } = await supabase
      .from('roles')
      .select('id')
      .limit(1)
    
    if (!existingRoles || existingRoles.length === 0) {
      const defaultRoles = [
        {
          id: 'anonymous',
          name: 'Anonymous',
          description: 'Non-authenticated users',
          level: 0,
          permissions: { 'mcp:read': ['public'], 'analytics:read': ['public'] },
          is_system_role: true
        },
        {
          id: 'community_user',
          name: 'Community User', 
          description: 'Basic authenticated users',
          level: 1,
          permissions: { 'mcp:read': ['public'], 'mcp:execute': ['public'], 'analytics:read': ['own'] },
          is_system_role: true
        },
        {
          id: 'admin',
          name: 'Administrator',
          description: 'System administrators', 
          level: 10,
          permissions: { '*': ['*'] },
          is_system_role: true
        }
      ]

      for (const role of defaultRoles) {
        const { error } = await supabase
          .from('roles')
          .insert(role)
        
        if (error && !error.message.includes('duplicate key')) {
          console.log(`   ❌ Role ${role.id}: ${error.message}`)
        } else {
          console.log(`   ✅ Role ${role.id}: Created`)
        }
      }
    } else {
      console.log('   ✅ Roles already exist')
    }

    console.log('\\n🎉 Database schema application complete!')
    console.log('\\nNext steps:')
    console.log('1. Test API endpoints: npm run dev')
    console.log('2. Verify security: npm run test:security')
    console.log('3. Check admin dashboard: http://localhost:3000/admin')

  } catch (error) {
    console.error('\\n❌ Schema application failed:', error)
    process.exit(1)
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  applySchemaToSupabase().catch(error => {
    console.error('Failed to apply schema:', error)
    process.exit(1)
  })
}

export { applySchemaToSupabase }