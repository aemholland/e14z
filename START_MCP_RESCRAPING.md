# Quick Start: MCP Rescraping & Enhancement

## For New Claude Code Session

1. **Read the comprehensive guide first**:
   ```
   Read the file: /Users/antony/Documents/e14z/e14z/CLAUDE_MCP_RESCRAPING.md
   ```

2. **Check current database status**:
   ```javascript
   mcp__supabase__execute_sql({
     "project_id": "zmfvcqjtubfclkhsdqjx",
     "query": "SELECT COUNT(*) as total_mcps, COUNT(CASE WHEN verified = true THEN 1 END) as official_mcps, COUNT(CASE WHEN installation_methods IS NOT NULL AND jsonb_array_length(installation_methods) > 0 THEN 1 END) as enhanced_mcps FROM mcps;"
   })
   ```

3. **Get MCPs that need enhancement**:
   ```javascript
   mcp__supabase__execute_sql({
     "project_id": "zmfvcqjtubfclkhsdqjx", 
     "query": "SELECT id, name, github_url, verified, installation_methods FROM mcps WHERE installation_methods IS NULL OR jsonb_array_length(installation_methods) = 0 OR tools IS NULL ORDER BY name LIMIT 5;"
   })
   ```

4. **Start rescraping** each MCP's GitHub repository for complete enhancement

## Key Enhancement Goals

### ✅ Installation Methods
- **Multiple formats**: npm, docker, git, python (uvx/pip), binary
- **Proper parameter spacing**: `docker run -i --rm -e TOKEN=value`
- **Authentication included**: Environment variables, API keys
- **Complete commands**: Include setup steps for git clones

### ✅ Official vs Community Classification  
- **Official**: Only from verified company GitHub organizations
  - Examples: `github/repo`, `stripe/repo`, `notion/repo`
- **Community**: Individual developers or community organizations
  - Examples: `username/repo`, `community-org/repo`
- **Database field**: `verified` boolean

### ✅ Complete Metadata
- **Clean names**: Remove "Official" suffix (handled by UI)
- **Proper descriptions**: Clear, concise functionality descriptions
- **Tools enumeration**: Extract all available tools with categories
- **License information**: MIT, Apache, etc.
- **Author attribution**: Company name or developer name

### ✅ Parameter Formatting
- **Space-separated**: `-i --rm -e` not `-i--rm-e`
- **Environment variables**: Include placeholder values
- **Authentication**: Show required tokens/keys

## Discovery Sources for New MCPs

```javascript
// Official MCP registry
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/modelcontextprotocol/servers",
  "formats": ["markdown"]
})

// Community awesome list
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/punkpeye/awesome-mcp-servers", 
  "formats": ["markdown"]
})

// GitHub search for new MCPs
mcp__firecrawl__firecrawl_search({
  "query": "mcp server model context protocol",
  "limit": 20
})
```

## Verification Process

### Official MCP Criteria:
1. **GitHub organization**: Must be from company's official GitHub org
2. **Repository naming**: Usually `{company}-mcp-server` or similar
3. **Maintenance**: Active commits, official documentation
4. **Authentication**: Company-provided API keys/tokens

### Community MCP Criteria:
1. **Individual developers**: Personal GitHub accounts
2. **Community organizations**: Non-company community groups
3. **Forks/adaptations**: Modified versions of official servers

## Current Database Status
- **Project ID**: `zmfvcqjtubfclkhsdqjx`
- **Total MCPs**: ~20 
- **Official MCPs**: 9 (verified companies only)
- **Community MCPs**: 11 (individual/community developers)

## Reference Files
- **Main guide**: `CLAUDE_MCP_RESCRAPING.md`
- **Discovery workflow**: `MCP_DISCOVERY_WORKFLOW.md`
- **Working directory**: `/Users/antony/Documents/e14z/e14z`

## Quick Commands

**Check parameter formatting issues**:
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT name, endpoint FROM mcps WHERE endpoint LIKE '%run-i%' OR endpoint LIKE '%-e%' LIMIT 5;"
})
```

**Verify official status**:
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT name, verified, author, github_url FROM mcps WHERE verified = true ORDER BY name;"
})
```