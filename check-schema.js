#!/usr/bin/env node

/**
 * Check Supabase Schema
 */

const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
  console.log('🔍 CHECKING SUPABASE SCHEMA');
  console.log('='.repeat(40));
  
  const supabase = createClient(
    'https://zmfvcqjtubfclkhsdqjx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZnZjcWp0dWJmY2xraHNkcWp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUzMTU3NCwiZXhwIjoyMDY0MTA3NTc0fQ.omJ8EFyeEifFMQP1J-6ariQGAl3xxy6YDXJ2NgMaxs0'
  );
  
  try {
    // First try to get a simple record to see actual fields
    const { data, error } = await supabase
      .from('mcps')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('📋 Available fields in mcps table:');
      const fields = Object.keys(data[0]);
      fields.forEach(field => {
        console.log(`   - ${field}`);
      });
    } else {
      console.log('📋 No data in table, trying minimal insert to check schema...');
      
      // Try minimal insert to see what's required
      const { error: insertError } = await supabase
        .from('mcps')
        .insert([{
          name: 'test-schema-check',
          description: 'Testing schema',
          slug: 'test-schema-check'
        }]);
      
      if (insertError) {
        console.log('❌ Insert error reveals schema requirements:');
        console.log(insertError.message);
      } else {
        console.log('✅ Minimal insert worked');
        
        // Clean up
        await supabase.from('mcps').delete().eq('name', 'test-schema-check');
      }
    }
    
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }
}

if (require.main === module) {
  checkSchema();
}