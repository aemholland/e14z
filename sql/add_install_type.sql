-- Add install_type field to mcps table
-- This tracks the installation method for each MCP

ALTER TABLE mcps 
ADD COLUMN install_type TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN mcps.install_type IS 'Installation method: npm, pip, git, docker, binary, other';

-- Update existing records with sensible defaults based on current endpoint patterns
UPDATE mcps 
SET install_type = CASE 
  WHEN endpoint LIKE 'npx %' OR endpoint LIKE 'npm %' THEN 'npm'
  WHEN endpoint LIKE 'pip %' THEN 'pip'
  WHEN endpoint LIKE 'git clone%' THEN 'git'
  WHEN endpoint LIKE 'docker %' THEN 'docker'
  WHEN endpoint LIKE 'curl %' OR endpoint LIKE 'wget %' THEN 'binary'
  WHEN endpoint LIKE 'uvx %' THEN 'pip'
  ELSE 'other'
END
WHERE install_type IS NULL;