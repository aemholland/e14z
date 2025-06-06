#!/usr/bin/env node

/**
 * Check database status and recent activity
 */

const { createClient } = require('@supabase/supabase-js');

async function checkDatabaseStatus() {
  console.log('🗄️ CHECKING DATABASE STATUS');
  console.log('='.repeat(40));
  
  const supabase = createClient(
    'https://zmfvcqjtubfclkhsdqjx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZnZjcWp0dWJmY2xraHNkcWp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUzMTU3NCwiZXhwIjoyMDY0MTA3NTc0fQ.omJ8EFyeEifFMQP1J-6ariQGAl3xxy6YDXJ2NgMaxs0'
  );
  
  try {
    // Check total count
    const { count, error: countError } = await supabase
      .from('mcps')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error(`❌ Error getting count: ${countError.message}`);
      return;
    }
    
    console.log(`📊 Total MCPs in database: ${count}`);
    
    if (count > 0) {
      // Get recent entries
      const { data, error } = await supabase
        .from('mcps')
        .select('name, description, use_cases, tags, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error(`❌ Error fetching recent data: ${error.message}`);
        return;
      }
      
      console.log('\n📋 Recent MCPs:');
      data.forEach((mcp, index) => {
        console.log(`${index + 1}. ${mcp.name}`);
        console.log(`   Created: ${new Date(mcp.created_at).toLocaleString()}`);
        console.log(`   Description: "${mcp.description.substring(0, 80)}..."`);
        console.log(`   Use Cases: ${mcp.use_cases?.length || 0}`);
        console.log(`   Tags: ${mcp.tags?.length || 0}`);
        
        // Quick quality check
        const hasGoodDesc = mcp.description && !mcp.description.includes('Empowers AI agents');
        const hasUseCases = mcp.use_cases && mcp.use_cases.length > 0;
        console.log(`   Quality: Desc=${hasGoodDesc ? '✅' : '❌'} UseCases=${hasUseCases ? '✅' : '❌'}`);
        console.log('');
      });
      
      // Check for the problematic patterns
      const { data: badDesc } = await supabase
        .from('mcps')
        .select('name, description')
        .ilike('description', '%Empowers AI agents%');
      
      console.log(`🔍 MCPs with "Empowers AI agents" language: ${badDesc?.length || 0}`);
      
      const { data: noUseCases } = await supabase
        .from('mcps')
        .select('name, use_cases')
        .is('use_cases', null)
        .or('use_cases.eq.{}');
      
      console.log(`🔍 MCPs without use cases: ${noUseCases?.length || 0}`);
      
    } else {
      console.log('ℹ️ No MCPs found in database - either:');
      console.log('   1. Crawler is running in dry-run mode');
      console.log('   2. Storage is failing');
      console.log('   3. Database is empty');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

if (require.main === module) {
  checkDatabaseStatus();
}