-- Crawler runs tracking table
-- Stores history and results of automated crawler executions

CREATE TABLE IF NOT EXISTS crawler_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')) DEFAULT 'running',
  result JSONB, -- CrawlerResult object
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_crawler_runs_status ON crawler_runs(status);
CREATE INDEX IF NOT EXISTS idx_crawler_runs_started_at ON crawler_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawler_runs_completed_at ON crawler_runs(completed_at DESC);

-- Comments for clarity
COMMENT ON TABLE crawler_runs IS 'Tracks automated MCP crawler execution history and results';
COMMENT ON COLUMN crawler_runs.result IS 'JSON object containing CrawlerResult with discovered, processed, failed counts and details';
COMMENT ON COLUMN crawler_runs.error IS 'Error message if the crawler run failed';
COMMENT ON COLUMN crawler_runs.duration_ms IS 'Total execution time in milliseconds';

-- Optional: Add RLS policy if needed
-- ALTER TABLE crawler_runs ENABLE ROW LEVEL SECURITY;

-- Clean up old runs (keep last 100)
-- This could be run as a scheduled job
-- DELETE FROM crawler_runs 
-- WHERE id NOT IN (
--   SELECT id FROM crawler_runs 
--   ORDER BY started_at DESC 
--   LIMIT 100
-- );