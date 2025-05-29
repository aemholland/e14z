# Quick Start: MCP Rescraping

## For New Claude Code Session

1. **Read the comprehensive guide first**:
   ```
   Read the file: /Users/antony/Documents/e14z/e14z/CLAUDE_MCP_RESCRAPING.md
   ```

2. **Check current status**:
   ```javascript
   mcp__supabase__execute_sql({
     "project_id": "zmfvcqjtubfclkhsdqjx",
     "query": "SELECT COUNT(*) as total_mcps, COUNT(CASE WHEN installation_methods IS NOT NULL AND jsonb_array_length(installation_methods) > 0 THEN 1 END) as enhanced_mcps FROM mcps;"
   })
   ```

3. **Get MCPs that need enhancement**:
   ```javascript
   mcp__supabase__execute_sql({
     "project_id": "zmfvcqjtubfclkhsdqjx", 
     "query": "SELECT id, name, github_url FROM mcps WHERE installation_methods IS NULL OR jsonb_array_length(installation_methods) = 0 ORDER BY name LIMIT 5;"
   })
   ```

4. **Start scraping** each MCP's GitHub repository and enhancing the database

## Discovery Sources for New MCPs
If looking for new MCPs to add, check these sources:
```javascript
// Primary official sources
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/modelcontextprotocol/servers",
  "formats": ["markdown"]
})

mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/punkpeye/awesome-mcp-servers", 
  "formats": ["markdown"]
})

// Discovery via GitHub search
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/search?q=mcp&type=repositories&s=stars&o=desc",
  "formats": ["markdown"]
})
```

## Goal
Enhance all MCPs with:
- ✅ Multiple installation methods (npm, docker, git, etc.)
- ✅ Comprehensive tools listings with categories
- ✅ Updated descriptions, licenses, and authors

## Database Project ID
`zmfvcqjtubfclkhsdqjx`

## Reference Files
- Main guide: `CLAUDE_MCP_RESCRAPING.md`
- Working directory: `/Users/antony/Documents/e14z/e14z`