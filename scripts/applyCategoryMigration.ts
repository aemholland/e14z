/**
 * Apply hardcoded category migration to all MCPs
 * This script ensures all MCPs use only the predefined 20 categories
 */

import { supabase } from '../lib/supabase/client';

const HARDCODED_CATEGORIES = [
  'databases', 'payments', 'ai-tools', 'development-tools', 'cloud-storage',
  'messaging', 'content-creation', 'monitoring', 'project-management', 'security',
  'automation', 'social-media', 'web-apis', 'productivity', 'infrastructure',
  'media-processing', 'finance', 'communication', 'research', 'iot'
];

const CATEGORY_MAPPINGS = {
  'fintech': 'payments',
  'Database': 'databases', 
  'Finance': 'finance',
  'development': 'development-tools',
  'AI Tools': 'ai-tools',
  'LLMOps': 'ai-tools',
  'Cloud Infrastructure': 'infrastructure',
  'cloud-infrastructure': 'infrastructure',
  'Cloud Storage': 'cloud-storage',
  'Communication': 'communication',
  'CRM': 'project-management',
  'Design': 'content-creation',
  'DevOps': 'infrastructure',
  'Gaming': 'content-creation',
  'Infrastructure': 'infrastructure',
  'Media Generation': 'content-creation',
  'Project Management': 'project-management',
  'Smart Home': 'iot',
  'Social Media': 'social-media'
};

async function migrateCategoriesHardcoded() {
  console.log('🔄 Starting hardcoded category migration...\n');

  try {
    // 1. Get current category distribution
    console.log('📊 Current category distribution:');
    const { data: currentCategories, error: currentError } = await supabase
      .from('mcps')
      .select('category')
      .not('category', 'is', null);

    if (currentError) throw currentError;

    const categoryCount = currentCategories.reduce((acc: Record<string, number>, mcp) => {
      acc[mcp.category] = (acc[mcp.category] || 0) + 1;
      return acc;
    }, {});

    Object.entries(categoryCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });

    // 2. Apply category mappings
    console.log('\n🔄 Applying category mappings...');
    
    for (const [oldCategory, newCategory] of Object.entries(CATEGORY_MAPPINGS)) {
      const { data: mcpsToUpdate, error: findError } = await supabase
        .from('mcps')
        .select('id, name, category')
        .eq('category', oldCategory);

      if (findError) throw findError;

      if (mcpsToUpdate && mcpsToUpdate.length > 0) {
        console.log(`  Updating ${mcpsToUpdate.length} MCPs: "${oldCategory}" → "${newCategory}"`);
        
        const { error: updateError } = await supabase
          .from('mcps')
          .update({ category: newCategory })
          .eq('category', oldCategory);

        if (updateError) throw updateError;
        
        mcpsToUpdate.forEach(mcp => {
          console.log(`    ✅ ${mcp.name}`);
        });
      }
    }

    // 3. Get updated category distribution
    console.log('\n📊 Updated category distribution:');
    const { data: updatedCategories, error: updatedError } = await supabase
      .from('mcps')
      .select('category')
      .not('category', 'is', null);

    if (updatedError) throw updatedError;

    const updatedCategoryCount = updatedCategories.reduce((acc: Record<string, number>, mcp) => {
      acc[mcp.category] = (acc[mcp.category] || 0) + 1;
      return acc;
    }, {});

    Object.entries(updatedCategoryCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .forEach(([category, count]) => {
        const isValid = HARDCODED_CATEGORIES.includes(category);
        console.log(`  ${category}: ${count} ${isValid ? '✅' : '❌'}`);
      });

    // 4. Check for invalid categories
    console.log('\n🔍 Checking for invalid categories...');
    const { data: invalidCategories, error: invalidError } = await supabase
      .from('mcps')
      .select('category, name')
      .not('category', 'in', `(${HARDCODED_CATEGORIES.map(c => `'${c}'`).join(',')})`);

    if (invalidError) throw invalidError;

    if (invalidCategories && invalidCategories.length > 0) {
      console.log('❌ Found MCPs with invalid categories:');
      invalidCategories.forEach(mcp => {
        console.log(`  ${mcp.name}: "${mcp.category}"`);
      });
      console.log('\n⚠️ These MCPs need manual category assignment!');
    } else {
      console.log('✅ All MCPs use valid hardcoded categories!');
    }

    console.log('\n🎉 Category migration completed successfully!');
    console.log('📋 All MCPs now use standardized categories for reliable discovery.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  migrateCategoriesHardcoded()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateCategoriesHardcoded };