-- Add enhanced data collection fields to mcps table
-- This migration adds all the fields needed for comprehensive MCP data quality

-- Core package information
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS install_command TEXT;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS stars INTEGER DEFAULT 0;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS license TEXT;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS topics JSONB DEFAULT '[]'::jsonb;

-- Quality and status fields
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS quality_score FLOAT DEFAULT NULL;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS rating FLOAT DEFAULT NULL;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS official_status TEXT DEFAULT 'community' CHECK (official_status IN ('official', 'community', 'verified'));
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;

-- Additional metadata
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS has_readme BOOLEAN DEFAULT FALSE;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS recent_activity BOOLEAN DEFAULT FALSE;
ALTER TABLE mcps ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcps_website_url ON mcps(website_url);
CREATE INDEX IF NOT EXISTS idx_mcps_stars ON mcps(stars DESC);
CREATE INDEX IF NOT EXISTS idx_mcps_language ON mcps(language);
CREATE INDEX IF NOT EXISTS idx_mcps_license ON mcps(license);
CREATE INDEX IF NOT EXISTS idx_mcps_official_status ON mcps(official_status);
CREATE INDEX IF NOT EXISTS idx_mcps_is_official ON mcps(is_official);
CREATE INDEX IF NOT EXISTS idx_mcps_topics ON mcps USING GIN(topics);

-- Add comments for documentation
COMMENT ON COLUMN mcps.install_command IS 'Command to install this MCP package';
COMMENT ON COLUMN mcps.website_url IS 'Official website or documentation URL';
COMMENT ON COLUMN mcps.stars IS 'GitHub stars count for popularity indication';
COMMENT ON COLUMN mcps.language IS 'Primary programming language';
COMMENT ON COLUMN mcps.license IS 'Software license (MIT, Apache-2.0, etc.)';
COMMENT ON COLUMN mcps.topics IS 'Array of topic tags for categorization';
COMMENT ON COLUMN mcps.quality_score IS 'Reserved for separate quality calculation system';
COMMENT ON COLUMN mcps.rating IS 'User rating score (1-10)';
COMMENT ON COLUMN mcps.official_status IS 'Whether this is official, community, or verified MCP';
COMMENT ON COLUMN mcps.is_official IS 'Quick boolean check for official MCPs';
COMMENT ON COLUMN mcps.has_readme IS 'Whether the package has proper documentation';
COMMENT ON COLUMN mcps.recent_activity IS 'Whether the package has recent development activity';
COMMENT ON COLUMN mcps.last_updated IS 'When this record was last updated';