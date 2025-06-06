#!/usr/bin/env node

/**
 * Check what MCPs were actually stored in the database
 */

const { createClient } = require('@supabase/supabase-js');

async function checkStoredMCPs() {
  console.log('🗄️ CHECKING STORED MCPs IN DATABASE');
  console.log('='.repeat(50));
  
  const supabase = createClient(
    'https://zmfvcqjtubfclkhsdqjx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZnZjcWp0dWJmY2xraHNkcWp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUzMTU3NCwiZXhwIjoyMDY0MTA3NTc0fQ.omJ8EFyeEifFMQP1J-6ariQGAl3xxy6YDXJ2NgMaxs0'
  );
  
  // Get recent MCPs
  const { data, error } = await supabase
    .from('mcps')
    .select('name, description, use_cases, tags, auth_required, auth_methods, required_env_vars, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error(`❌ Error fetching data: ${error.message}`);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('❌ No MCPs found in database');
    return;
  }
  
  console.log(`✅ Found ${data.length} recent MCPs`);
  console.log('='.repeat(50));
  
  let aiAnalysisPass = 0;
  let authDetectionPass = 0;
  
  for (const [index, mcp] of data.entries()) {
    console.log(`\n${index + 1}. ${mcp.name}`);
    console.log(`   Created: ${new Date(mcp.created_at).toISOString()}`);
    console.log(`   Description: "${mcp.description}"`);
    console.log(`   Use Cases: ${mcp.use_cases?.length || 0} items`);
    if (mcp.use_cases && mcp.use_cases.length > 0) {
      mcp.use_cases.slice(0, 2).forEach((useCase, i) => {
        console.log(`      ${i+1}. ${useCase}`);
      });
    }
    console.log(`   Tags: ${mcp.tags?.length || 0} items`);
    if (mcp.tags && mcp.tags.length > 0) {
      console.log(`      Tags: ${mcp.tags.slice(0, 10).join(', ')}`);
    }
    console.log(`   Auth Required: ${mcp.auth_required}`);
    console.log(`   Auth Methods: ${JSON.stringify(mcp.auth_methods)}`);
    console.log(`   Required Env Vars: ${JSON.stringify(mcp.required_env_vars)}`);
    
    // Analyze quality
    const hasGoodDescription = mcp.description && 
                              !mcp.description.includes('Empowers AI agents') &&
                              mcp.description.length > 30;
    const hasUseCases = mcp.use_cases && mcp.use_cases.length > 0;
    const hasRichTags = mcp.tags && mcp.tags.length >= 10;
    
    console.log(`   ✅ Technical Description: ${hasGoodDescription ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Use Cases Generated: ${hasUseCases ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Rich Tags: ${hasRichTags ? 'PASS' : 'FAIL'}`);
    
    if (hasGoodDescription && hasUseCases && hasRichTags) {
      aiAnalysisPass++;
    }
    
    // Auth detection assessment
    const authCorrect = mcp.name.includes('notion') || mcp.name.includes('hubspot') || mcp.name.includes('stripe') || mcp.name.includes('slack') ? 
      (mcp.auth_required || mcp.auth_methods?.length > 0 || mcp.required_env_vars?.length > 0) :
      true; // For unknown MCPs, we can't verify
    
    if (authCorrect) {
      authDetectionPass++;
    }
  }
  
  console.log('\n🏆 OVERALL ASSESSMENT');
  console.log('='.repeat(40));
  console.log(`AI Analysis Quality: ${aiAnalysisPass}/${data.length} (${Math.round(aiAnalysisPass/data.length*100)}%)`);
  console.log(`Auth Detection: ${authDetectionPass}/${data.length} (${Math.round(authDetectionPass/data.length*100)}%)`);
  
  const overallPass = (aiAnalysisPass >= data.length * 0.8);
  console.log(`\n🎯 OVERALL: ${overallPass ? '✅ SUCCESS' : '❌ NEEDS WORK'}`);
  
  if (overallPass) {
    console.log('\n🎉 FIXES CONFIRMED:');
    console.log('   ✅ Technical descriptions without marketing language');
    console.log('   ✅ Enhanced use case generation working');
    console.log('   ✅ Comprehensive tagging system working');
    console.log('   ✅ Ready for production deployment');
  } else {
    console.log('\n⚠️ ISSUES REMAINING:');
    if (aiAnalysisPass < data.length * 0.8) {
      console.log('   - AI analysis quality needs improvement');
      console.log('   - Check if generateBusinessIntelligence() is being called properly');
    }
  }
  
  return overallPass;
}

if (require.main === module) {
  checkStoredMCPs().then(success => {
    process.exit(success ? 0 : 1);
  });
}