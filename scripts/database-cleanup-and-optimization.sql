-- Database Schema Cleanup and Optimization
-- Remove redundant columns and optimize for agent queries

-- 1. Remove redundant auth column (keep auth_methods array, remove single auth_method)
-- We'll keep auth_method for now as some queries might depend on it, but consolidate the logic

-- 2. Remove redundant tool columns (keep tools, remove tool_endpoints)
ALTER TABLE mcps DROP COLUMN IF EXISTS tool_endpoints;

-- 3. Remove rarely used columns that add complexity
ALTER TABLE mcps DROP COLUMN IF EXISTS clean_command;
ALTER TABLE mcps DROP COLUMN IF EXISTS source_type;
ALTER TABLE mcps DROP COLUMN IF EXISTS claim_verification;
ALTER TABLE mcps DROP COLUMN IF EXISTS verified_at;
ALTER TABLE mcps DROP COLUMN IF EXISTS rating; -- We have quality_score instead

-- 4. Add constraint to ensure health_status values are valid
ALTER TABLE mcps ADD CONSTRAINT mcps_health_status_check 
  CHECK (health_status IN ('healthy', 'down', 'unknown', 'pending'));

-- 5. Add constraint for auth_method consistency  
ALTER TABLE mcps ADD CONSTRAINT mcps_auth_method_check
  CHECK (auth_method IN ('none', 'api_key', 'oauth', 'oauth2', 'bearer_token', 'credentials', 'webhook_secret'));

-- 6. Add indexes for agent queries
CREATE INDEX IF NOT EXISTS idx_mcps_health_verified ON mcps(health_status, verified) 
  WHERE health_status = 'healthy' AND verified = true;

CREATE INDEX IF NOT EXISTS idx_mcps_search_ready ON mcps(health_status, verified, auth_required);

-- 7. Update search_vector trigger to include more relevant fields
DROP TRIGGER IF EXISTS update_mcps_search_vector ON mcps;

CREATE OR REPLACE FUNCTION update_mcps_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(NEW.tags, ARRAY[]::text[]), ' ')), 'C') ||
    setweight(to_tsvector('english', array_to_string(COALESCE(NEW.use_cases, ARRAY[]::text[]), ' ')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'D') ||
    setweight(to_tsvector('english', COALESCE(NEW.author, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mcps_search_vector
  BEFORE INSERT OR UPDATE ON mcps
  FOR EACH ROW EXECUTE FUNCTION update_mcps_search_vector();

-- 8. Add comments for key agent-facing fields
COMMENT ON COLUMN mcps.health_status IS 'Primary filter for showing MCPs in search - only healthy MCPs should be visible';
COMMENT ON COLUMN mcps.verified IS 'Whether MCP passed validation tests (installation + MCP protocol communication)';
COMMENT ON COLUMN mcps.tools IS 'JSONB array of tools with name, description, category, parameters';
COMMENT ON COLUMN mcps.use_cases IS 'Array of specific use cases to help agents understand when to use this MCP';
COMMENT ON COLUMN mcps.auth_summary IS 'Human-readable auth requirements for quick agent assessment';

-- 9. Create view for agent-ready MCPs (only show working ones)
CREATE OR REPLACE VIEW agent_ready_mcps AS
SELECT 
  id,
  slug,
  name,
  description,
  category,
  tags,
  use_cases,
  tools,
  auth_required,
  auth_methods,
  required_env_vars,
  optional_env_vars,
  auth_summary,
  setup_complexity,
  installation_methods,
  github_url,
  documentation_url,
  website_url,
  author,
  company,
  license,
  quality_score,
  created_at,
  updated_at
FROM mcps 
WHERE health_status = 'healthy' 
  AND verified = true
  AND tools IS NOT NULL
  AND array_length(use_cases, 1) > 0; -- Must have use cases

COMMENT ON VIEW agent_ready_mcps IS 'MCPs that are ready for agent consumption - validated, healthy, with complete data';