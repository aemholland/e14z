#!/usr/bin/env node

/**
 * Check Supabase Schema - See what columns actually exist
 */

// Load environment variables
const fs = require('fs');
const path = require('path');

let rootDir = __dirname;
while (rootDir !== '/' && !fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = path.dirname(rootDir);
}

const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
}

const { createClient } = require('@supabase/supabase-js');

async function checkSupabaseSchema() {
  console.log('🔍 CHECKING SUPABASE SCHEMA: mcps table');
  console.log('='.repeat(50));
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    console.log('✅ Supabase credentials found');
    console.log('🔗 URL:', supabaseUrl);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query the information_schema to get column details
    console.log('\n📊 Querying mcps table schema...');
    
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'mcps')
      .eq('table_schema', 'public');
    
    if (error) {
      console.error('❌ Schema query failed:', error);
      
      // Fallback: Try to get a sample record to see available fields
      console.log('\n🔄 Trying fallback: Get sample record...');
      const { data: sample, error: sampleError } = await supabase
        .from('mcps')
        .select('*')
        .limit(1)
        .single();
      
      if (sampleError) {
        console.error('❌ Sample query failed:', sampleError);
      } else if (sample) {
        console.log('✅ Available columns from sample record:');
        Object.keys(sample).forEach((col, i) => {
          console.log(`   ${i + 1}. ${col}: ${typeof sample[col]}`);
        });
      }
      
    } else if (columns) {
      console.log(`✅ Found ${columns.length} columns in mcps table:`);
      console.log('\n📋 AVAILABLE COLUMNS:');
      
      const intelligenceColumns = [];
      const basicColumns = [];
      
      columns.forEach((col, i) => {
        const isIntelligence = [
          'tool_count', 'working_tools', 'failing_tools', 'auth_setup_complexity',
          'initialization_time', 'average_response_time', 'reliability_score',
          'available_resources', 'available_prompts', 'documentation_quality',
          'integration_complexity', 'common_errors', 'troubleshooting_tips',
          'testing_notes', 'intelligence_collection_method', 'installation_successful'
        ].includes(col.column_name);
        
        if (isIntelligence) {
          intelligenceColumns.push(col);
        } else {
          basicColumns.push(col);
        }
        
        console.log(`   ${i + 1}. ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      
      console.log('\n🧠 INTELLIGENCE COLUMNS AVAILABLE:');
      if (intelligenceColumns.length > 0) {
        intelligenceColumns.forEach(col => {
          console.log(`   ✅ ${col.column_name}`);
        });
      } else {
        console.log('   ❌ No intelligence columns found - need schema update');
      }
      
      console.log('\n📦 BASIC COLUMNS AVAILABLE:');
      basicColumns.slice(0, 10).forEach(col => {
        console.log(`   ✅ ${col.column_name}`);
      });
      if (basicColumns.length > 10) {
        console.log(`   ... and ${basicColumns.length - 10} more basic columns`);
      }
    }
    
    console.log('\n🔧 RECOMMENDATIONS:');
    console.log('1. If no intelligence columns exist → Need schema migration');
    console.log('2. If some exist → Update mapper to use only available columns');
    console.log('3. For production → Add missing intelligence columns to schema');
    
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }
}

if (require.main === module) {
  checkSupabaseSchema().catch(console.error);
}

module.exports = { checkSupabaseSchema };