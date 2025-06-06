-- Fix tools that have 'schema' property instead of 'inputSchema'
-- This migration updates existing tools to use the correct property name

-- Update tools that have 'schema' property to use 'inputSchema' instead
UPDATE mcps 
SET tools = (
  SELECT jsonb_agg(
    CASE 
      WHEN tool ? 'schema' AND NOT tool ? 'inputSchema' THEN
        tool - 'schema' || jsonb_build_object('inputSchema', tool->'schema')
      ELSE 
        tool
    END
  )
  FROM jsonb_array_elements(tools) AS tool
)
WHERE tools IS NOT NULL 
  AND jsonb_typeof(tools) = 'array'
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(tools) AS tool 
    WHERE tool ? 'schema' AND NOT tool ? 'inputSchema'
  );

-- Add a comment explaining the fix
COMMENT ON COLUMN mcps.tools IS 'JSONB array of tools with name, description, category, and inputSchema (not schema)';