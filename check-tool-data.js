#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

async function checkToolData() {
  const supabase = createClient(
    'https://zmfvcqjtubfclkhsdqjx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZnZjcWp0dWJmY2xraHNkcWp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUzMTU3NCwiZXhwIjoyMDY0MTA3NTc0fQ.omJ8EFyeEifFMQP1_J-6ariQGAl3xxy6YDXJ2NgMaxs0'
  );

  console.log('🔍 Checking Tool Data Structure');
  console.log('==================================');
  
  const { data, error } = await supabase
    .from('mcps')
    .select('*')
    .eq('slug', '@playwright/mcp')
    .single();
    
  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }
  
  console.log('📋 Tools data type:', typeof data.tools);
  console.log('📋 Tools length:', data.tools?.length);
  console.log('📋 First tool structure:');
  if (data.tools && data.tools.length > 0) {
    const firstTool = data.tools[0];
    console.log('  - name:', firstTool.name);
    console.log('  - description:', firstTool.description);
    console.log('  - inputSchema exists:', !!firstTool.inputSchema);
    console.log('  - input_schema exists:', !!firstTool.input_schema);
    console.log('  - parameters exists:', !!firstTool.parameters);
    
    if (firstTool.inputSchema) {
      console.log('  - inputSchema type:', typeof firstTool.inputSchema);
      console.log('  - inputSchema.properties exists:', !!firstTool.inputSchema.properties);
      if (firstTool.inputSchema.properties) {
        console.log('  - properties keys:', Object.keys(firstTool.inputSchema.properties));
      }
    }
    
    if (firstTool.input_schema) {
      console.log('  - input_schema type:', typeof firstTool.input_schema);
      console.log('  - input_schema.properties exists:', !!firstTool.input_schema.properties);
    }
    
    console.log('  - Full tool object keys:', Object.keys(firstTool));
  }
  
  console.log('\n📋 Available tools count:', data.available_tools?.length || 0);
  if (data.available_tools && data.available_tools.length > 0) {
    console.log('Available tools sample:', data.available_tools.slice(0, 3));
  }
}

checkToolData().catch(console.error);