-- Migration Script: Update all MCP categories to use hardcoded categories
-- This ensures data consistency and reliable categorization

-- First, let's see what categories we currently have
-- SELECT DISTINCT category, COUNT(*) as count FROM mcps GROUP BY category ORDER BY count DESC;

-- Category mapping rules based on analysis:
-- fintech -> payments
-- Database -> databases  
-- databases -> databases (no change)
-- Finance -> finance
-- productivity -> productivity (no change)
-- development -> development-tools
-- AI Tools -> ai-tools
-- ai-tools -> ai-tools (no change)
-- Cloud Infrastructure -> infrastructure
-- cloud-infrastructure -> infrastructure
-- Cloud Storage -> cloud-storage
-- cloud-storage -> cloud-storage (no change)
-- communication -> communication (no change)
-- Communication -> communication
-- CRM -> project-management
-- Design -> content-creation
-- DevOps -> infrastructure
-- Gaming -> content-creation
-- Infrastructure -> infrastructure
-- iot -> iot (no change)
-- LLMOps -> ai-tools
-- Media Generation -> content-creation
-- Project Management -> project-management
-- Research -> research (no change)
-- Security -> security (no change)
-- Smart Home -> iot
-- Social Media -> social-media
-- web-apis -> web-apis (no change)

BEGIN;

-- Update categories to use hardcoded values
UPDATE mcps SET category = 'payments' WHERE category IN ('fintech');
UPDATE mcps SET category = 'databases' WHERE category IN ('Database');
UPDATE mcps SET category = 'finance' WHERE category IN ('Finance');
UPDATE mcps SET category = 'development-tools' WHERE category IN ('development');
UPDATE mcps SET category = 'ai-tools' WHERE category IN ('AI Tools', 'LLMOps');
UPDATE mcps SET category = 'infrastructure' WHERE category IN ('Cloud Infrastructure', 'cloud-infrastructure', 'DevOps', 'Infrastructure');
UPDATE mcps SET category = 'cloud-storage' WHERE category IN ('Cloud Storage');
UPDATE mcps SET category = 'communication' WHERE category IN ('Communication');
UPDATE mcps SET category = 'project-management' WHERE category IN ('CRM', 'Project Management');
UPDATE mcps SET category = 'content-creation' WHERE category IN ('Design', 'Gaming', 'Media Generation');
UPDATE mcps SET category = 'social-media' WHERE category IN ('Social Media');
UPDATE mcps SET category = 'iot' WHERE category IN ('Smart Home');

-- Verify the migration
SELECT 'After migration - Category distribution:' as status;
SELECT category, COUNT(*) as count FROM mcps GROUP BY category ORDER BY count DESC;

-- Check for any categories that don't match our hardcoded list
SELECT 'Invalid categories (should be empty):' as status;
SELECT DISTINCT category FROM mcps 
WHERE category NOT IN (
  'databases', 'payments', 'ai-tools', 'development-tools', 'cloud-storage',
  'messaging', 'content-creation', 'monitoring', 'project-management', 'security',
  'automation', 'social-media', 'web-apis', 'productivity', 'infrastructure',
  'media-processing', 'finance', 'communication', 'research', 'iot'
);

COMMIT;

-- Success message
SELECT 'Category migration completed successfully!' as result;
SELECT 'All MCPs now use hardcoded categories for consistent data quality.' as note;