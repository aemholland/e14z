# Claude Code MCP Comprehensive Rescraping Guide

## Overview
This guide enables Claude Code to perform comprehensive MCP rescraping using Firecrawl and Supabase MCP tools to enhance the e14z MCP database with detailed installation methods, tools listings, and metadata.

## MCP Discovery Sources
These are the key GitHub URLs where new MCPs can be discovered:

### Primary Sources
1. **Official MCP Servers**: `https://github.com/modelcontextprotocol/servers`
2. **Awesome MCP List**: `https://github.com/punkpeye/awesome-mcp-servers`
3. **MCP Documentation**: `https://modelcontextprotocol.io/servers`

### GitHub Search Sources
4. **Popular MCPs**: `https://github.com/search?q=mcp&type=repositories&s=stars&o=desc`
5. **Recent MCPs**: `https://github.com/search?q=mcp&type=repositories&s=updated&o=desc`
6. **MCP Server Repositories**: `https://github.com/search?q=mcp-server&type=repositories`
7. **Model Context Protocol**: `https://github.com/search?q="model context protocol"&type=repositories`

### Additional Discovery URLs
- GitHub topics: `https://github.com/topics/mcp`
- GitHub topics: `https://github.com/topics/model-context-protocol`
- NPM packages: Search for packages containing "mcp" keywords

## Prerequisites
- Claude Code with Supabase and Firecrawl MCP tools configured
- Access to e14z Supabase project: `zmfvcqjtubfclkhsdqjx`
- Working directory: `/Users/antony/Documents/e14z/e14z`

## Process Overview

### 1. Get List of MCPs to Process
```sql
SELECT id, name, github_url FROM mcps WHERE installation_methods IS NULL OR jsonb_array_length(installation_methods) = 0 ORDER BY name LIMIT 10;
```

### 2. For Each MCP, Scrape GitHub Repository
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/owner/repo-name",
  "formats": ["markdown"]
})
```

### 3. Extract Enhanced Data
From the scraped content, extract:
- **Installation Methods**: npm, pip, docker, git commands with descriptions
- **Tools**: List of available tools with names, descriptions, and categories
- **Metadata**: License, author, updated description

### 4. Update Database with Enhanced Data
```sql
UPDATE mcps SET 
  description = 'Enhanced description based on README',
  installation_methods = '[
    {
      "type": "npm",
      "command": "npx package-name",
      "description": "Run directly via NPX"
    },
    {
      "type": "git",
      "command": "git clone https://github.com/owner/repo",
      "description": "Clone for local development"
    }
  ]'::jsonb,
  tools = '[
    {
      "name": "tool_name",
      "description": "What the tool does",
      "category": "appropriate_category"
    }
  ]'::jsonb,
  license = 'MIT',
  author = 'author_name'
WHERE id = 'mcp-uuid-here';
```

## Tool Categories
Use these categories for tools:
- `infrastructure` - Kubernetes, Docker, CI/CD
- `communication` - Slack, Discord, messaging
- `database` - MongoDB, SQL operations
- `project_management` - Trello, Linear, Todoist
- `payment_processing` - Stripe, Square
- `web_scraping` - Web content extraction
- `device_management` - IoT, smart home
- `collaboration` - GitHub, team tools
- `analytics` - Metrics, reporting
- `automation` - Workflow, scripting
- `search` - Search and discovery
- `debugging` - Logs, diagnostics
- `documentation` - Help, guides
- `system` - System operations
- `networking` - Network tools
- `utilities` - General utilities

## Installation Method Types
- `npm` - NPM/NPX packages
- `pip` - Python packages
- `docker` - Docker containers
- `git` - Git repositories
- `binary` - Compiled binaries
- `cargo` - Rust packages

## Example Workflow

1. **Start with listing MCPs**:
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT id, name, github_url FROM mcps WHERE installation_methods IS NULL ORDER BY name LIMIT 5;"
})
```

2. **Scrape first MCP**:
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/owner/repo-name",
  "formats": ["markdown"]
})
```

3. **Analyze content and update database** with enhanced data

4. **Continue systematically** through all MCPs

## Success Metrics
- All MCPs should have `installation_methods` with multiple options
- All MCPs should have comprehensive `tools` listings
- Enhanced descriptions based on actual README content
- Proper license and author attribution

## Database Connection
Project ID: `zmfvcqjtubfclkhsdqjx`

Use this project ID for all Supabase MCP operations.

## Tips for Success
- Always read the full README content carefully
- Extract multiple installation methods when available
- Categorize tools appropriately
- Include parameter information for tools when available
- Verify license and author information from repository
- Add delays between requests to avoid rate limiting
- Handle SQL escaping for apostrophes and quotes

## Validation Query
After completing, verify success:
```sql
SELECT COUNT(*) as total_mcps, 
       COUNT(CASE WHEN installation_methods IS NOT NULL AND jsonb_array_length(installation_methods) > 0 THEN 1 END) as enhanced_mcps,
       COUNT(CASE WHEN tools IS NOT NULL AND jsonb_array_length(tools) > 0 THEN 1 END) as mcps_with_tools
FROM mcps;
```

Target: 100% enhancement rate for all MCPs.