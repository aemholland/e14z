-- Add authentication requirements columns to mcps table
-- This migration adds comprehensive auth data that agents can use to understand MCP requirements

-- Add auth requirement columns
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS auth_required BOOLEAN DEFAULT FALSE;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS auth_methods JSONB DEFAULT '[]'::jsonb;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS required_env_vars JSONB DEFAULT '[]'::jsonb;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS optional_env_vars JSONB DEFAULT '[]'::jsonb;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS credentials_needed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS setup_complexity TEXT DEFAULT 'simple' CHECK (setup_complexity IN ('simple', 'moderate', 'complex'));
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS auth_summary TEXT;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS setup_instructions TEXT;

-- Add indexes for filtering by auth requirements
CREATE INDEX IF NOT EXISTS idx_mcps_auth_required ON mcps(auth_required);
CREATE INDEX IF NOT EXISTS idx_mcps_setup_complexity ON mcps(setup_complexity);
CREATE INDEX IF NOT EXISTS idx_mcps_auth_methods ON mcps USING GIN(auth_methods);
CREATE INDEX IF NOT EXISTS idx_mcps_required_env_vars ON mcps USING GIN(required_env_vars);

-- Add comments for documentation
COMMENT ON COLUMN mcps.auth_required IS 'Whether this MCP requires authentication to function';
COMMENT ON COLUMN mcps.auth_methods IS 'Array of authentication methods supported (api_key, oauth2, bearer_token, etc.)';
COMMENT ON COLUMN mcps.required_env_vars IS 'Array of required environment variables (e.g., ["STRIPE_API_KEY", "SLACK_BOT_TOKEN"])';
COMMENT ON COLUMN mcps.optional_env_vars IS 'Array of optional environment variables for enhanced functionality';
COMMENT ON COLUMN mcps.credentials_needed IS 'Array of credential types needed (api_key, service_account, etc.)';
COMMENT ON COLUMN mcps.setup_complexity IS 'How complex the setup is: simple, moderate, or complex';
COMMENT ON COLUMN mcps.auth_summary IS 'Human-readable summary of auth requirements for agents';
COMMENT ON COLUMN mcps.setup_instructions IS 'Extracted setup instructions from documentation';