# MCP Discovery Workflow for Claude Code

## Quick Discovery Process

### 1. Check Current Database Status
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT COUNT(*) as total_mcps FROM mcps;"
})
```

### 2. Discover New MCPs from Primary Sources

#### Official MCP Servers Repository
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/modelcontextprotocol/servers",
  "formats": ["markdown"]
})
```

#### Awesome MCP Servers List  
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/punkpeye/awesome-mcp-servers",
  "formats": ["markdown"] 
})
```

### 3. Search GitHub for Popular MCPs
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/search?q=mcp&type=repositories&s=stars&o=desc",
  "formats": ["markdown"]
})
```

### 4. Search GitHub for Recent MCPs
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/search?q=mcp&type=repositories&s=updated&o=desc", 
  "formats": ["markdown"]
})
```

### 5. Check for MCP Servers Specifically
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/search?q=mcp-server&type=repositories",
  "formats": ["markdown"]
})
```

## Processing New Discoveries

### 1. Extract GitHub URLs from Results
Look for patterns like:
- `https://github.com/username/repo-name`
- Repository links in markdown format
- References to MCP server implementations

### 2. Validate Against Existing Database
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx", 
  "query": "SELECT github_url FROM mcps WHERE github_url LIKE '%github-url-here%';"
})
```

### 3. Scrape New MCP Repository
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/username/new-mcp-repo",
  "formats": ["markdown"]
})
```

### 4. Extract MCP Details
From the README, extract:
- **Name**: Repository/package name
- **Description**: What the MCP does
- **Installation methods**: npm, docker, git, pip commands
- **Tools**: List of available tools/functions
- **Author**: Repository owner or maintainer
- **License**: License type (MIT, Apache, etc.)

### 5. Add to Database
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "INSERT INTO mcps (name, description, github_url, author, license, installation_methods, tools) VALUES ('MCP Name', 'Description', 'https://github.com/user/repo', 'author', 'MIT', '[{\"type\": \"npm\", \"command\": \"npx package\"}]'::jsonb, '[{\"name\": \"tool\", \"description\": \"desc\"}]'::jsonb);"
})
```

## Target Sources Summary

1. **Official**: `github.com/modelcontextprotocol/servers`
2. **Community**: `github.com/punkpeye/awesome-mcp-servers`  
3. **Popular**: GitHub search by stars
4. **Recent**: GitHub search by recent updates
5. **Specific**: Search for "mcp-server" repositories
6. **Topics**: GitHub topics for `mcp` and `model-context-protocol`

## Success Metrics
- Discover 5-10 new MCPs per discovery session
- Maintain 100% data quality with proper validation
- Ensure all new MCPs have comprehensive installation methods and tools listings