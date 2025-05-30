# Claude Code MCP Comprehensive Rescraping Guide

## Overview
This guide enables Claude Code to perform comprehensive MCP rescraping using Firecrawl and Supabase MCP tools to enhance the e14z MCP database with detailed installation methods, tools listings, proper official/community classification, and complete metadata.

## Critical Enhancement Areas

### 🎯 Official vs Community Classification
**MOST IMPORTANT**: Properly classify MCPs as official or community-made:

#### Official MCP Criteria (verified=true):
- **GitHub organization**: Must be from the actual company's GitHub org
  - ✅ `github/github-mcp-server` (Official GitHub)
  - ✅ `stripe/agent-toolkit` (Official Stripe)
  - ❌ `box-community/mcp-server-box` (Community, not official Box)
- **Company authentication**: Uses company-provided API keys/tokens
- **Official documentation**: Company-maintained README and docs

#### Community MCP Criteria (verified=false):
- **Individual developers**: Personal GitHub accounts
- **Community organizations**: Non-company community groups  
- **Third-party integrations**: Unofficial implementations

### 🔧 Installation Method Enhancement
Extract and format ALL installation methods properly:

#### Parameter Formatting Rules:
- **Correct**: `docker run -i --rm -e TOKEN=value`
- **Incorrect**: `docker run-i--rm-eTOKEN=value`
- **Include auth**: Environment variables and API keys
- **Complete commands**: Setup steps for git clones

#### Installation Types:
- `npm` - NPX/NPM packages
- `docker` - Docker containers with proper flags
- `pip` - Python packages (uvx, pip install)  
- `git` - Git repositories with build steps
- `binary` - Compiled binaries and installers

### 🛠️ Tools Extraction
Extract comprehensive tools listings:
- **Tool names**: Exact function/method names
- **Descriptions**: What each tool does
- **Categories**: Proper categorization
- **Parameters**: Input parameters when available

## MCP Discovery Sources

### Primary Sources
1. **Official MCP Registry**: `https://github.com/modelcontextprotocol/servers`
2. **Awesome MCP List**: `https://github.com/punkpeye/awesome-mcp-servers`
3. **MCP Documentation**: `https://modelcontextprotocol.io/servers`

### GitHub Search Sources
4. **Popular MCPs**: `https://github.com/search?q=mcp&type=repositories&s=stars&o=desc`
5. **Recent MCPs**: `https://github.com/search?q=mcp&type=repositories&s=updated&o=desc`
6. **MCP Server Repos**: `https://github.com/search?q=mcp-server&type=repositories`
7. **Model Context Protocol**: `https://github.com/search?q="model context protocol"&type=repositories`

### Additional Discovery
- GitHub topics: `https://github.com/topics/mcp`
- GitHub topics: `https://github.com/topics/model-context-protocol`
- NPM packages: Search for "mcp" keywords

## Step-by-Step Process

### 1. Check Current Database Status
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT COUNT(*) as total, COUNT(CASE WHEN verified = true THEN 1 END) as official, COUNT(CASE WHEN installation_methods IS NOT NULL THEN 1 END) as enhanced FROM mcps;"
})
```

### 2. Get MCPs Needing Enhancement
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT id, name, github_url, verified, author FROM mcps WHERE installation_methods IS NULL OR tools IS NULL ORDER BY name LIMIT 5;"
})
```

### 3. Scrape GitHub Repository
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/owner/repo-name",
  "formats": ["markdown"],
  "onlyMainContent": true
})
```

### 4. Analyze and Classify
For each scraped repository:

#### A. Determine Official Status
```javascript
// Check GitHub URL pattern
const isOfficial = github_url.match(/github\.com\/(github|stripe|notion|square|buildkite|circleci|cloudflare|elevenlabs|twilio)\//);
const verified = !!isOfficial;
```

#### B. Extract Installation Methods
Look for:
- **Docker commands**: `docker run`, `docker pull`
- **NPM commands**: `npx`, `npm install`
- **Python commands**: `uvx`, `pip install`, `uv run`
- **Git commands**: `git clone` with setup steps
- **Setup instructions**: Multi-step installation processes

#### C. Extract Tools
Parse README sections like:
- "Tools", "Available Tools", "Features"
- Function lists, API references
- Tool descriptions and categories

#### D. Extract Metadata
- **Description**: Clear functionality description
- **License**: From package.json or LICENSE file
- **Author**: Company name or developer name

### 5. Update Database with Enhanced Data
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": `UPDATE mcps SET 
    verified = ${verified},
    description = '${enhanced_description}',
    installation_methods = '[
      {
        "type": "docker",
        "command": "docker run -i --rm -e API_TOKEN=your_token repo:latest",
        "description": "Run via Docker with authentication",
        "priority": 1
      },
      {
        "type": "npm", 
        "command": "npx package-name",
        "description": "Run directly via NPX",
        "priority": 2
      }
    ]'::jsonb,
    tools = '[
      {
        "name": "tool_function",
        "description": "What this tool does",
        "category": "appropriate_category"
      }
    ]'::jsonb,
    license = '${license}',
    author = '${author}',
    updated_at = NOW()
  WHERE id = '${mcp_id}';`
})
```

## Tool Categories Reference
- `infrastructure` - Kubernetes, Docker, CI/CD systems
- `communication` - Slack, Discord, messaging platforms
- `database` - MongoDB, SQL operations, data management
- `project_management` - Trello, Linear, Todoist, task management
- `payment_processing` - Stripe, Square, financial services
- `web_scraping` - Web content extraction, crawling
- `device_management` - IoT, smart home, hardware control
- `collaboration` - GitHub, version control, team tools
- `analytics` - Metrics, reporting, data analysis
- `automation` - Workflow automation, scripting
- `search` - Search engines, discovery tools
- `debugging` - Logs, diagnostics, troubleshooting
- `documentation` - Help systems, guides, references
- `system` - System operations, administration
- `networking` - Network tools, connectivity
- `utilities` - General purpose utilities

## Parameter Formatting Logic

### Docker Commands
```javascript
// Fix common concatenation issues
command = command
  .replace(/([a-zA-Z0-9])(-[a-zA-Z])/g, '$1 $2')        // Add space before flags
  .replace(/([a-zA-Z0-9])(--[a-zA-Z])/g, '$1 $2')       // Add space before long flags
  .replace(/([a-zA-Z0-9])(-e\s+)/g, '$1 $2')            // Fix -e spacing
  .replace(/([a-zA-Z0-9])(-i)/g, '$1 $2')               // Fix -i spacing
  .replace(/([a-zA-Z0-9])(--rm)/g, '$1 $2')             // Fix --rm spacing
```

### NPM Commands  
```javascript
// Fix NPM parameter spacing
command = command
  .replace(/([a-zA-Z0-9])(-y)/g, '$1 $2')               // Fix -y flag
  .replace(/([a-zA-Z0-9])(@[a-zA-Z])/g, '$1 $2')        // Fix package scoping
```

## Verification Checklist

### ✅ Official Classification
- [ ] GitHub URL from actual company organization
- [ ] Not from community/individual accounts
- [ ] Uses company-provided authentication
- [ ] Official company documentation

### ✅ Installation Methods
- [ ] Multiple installation options when available
- [ ] Proper parameter spacing (no concatenation)
- [ ] Authentication environment variables included
- [ ] Complete setup steps for git clones
- [ ] Priority ordering (1=recommended, 2=alternative, etc.)

### ✅ Tools Enumeration
- [ ] All available tools extracted
- [ ] Clear descriptions for each tool
- [ ] Appropriate categories assigned
- [ ] Parameters documented when available

### ✅ Metadata Quality
- [ ] Clean, descriptive functionality description
- [ ] Accurate license information
- [ ] Proper author attribution (company or developer name)
- [ ] No "Official" in name (handled by UI via verified flag)

## Success Validation

### Final Database Check
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx", 
  "query": `SELECT 
    COUNT(*) as total_mcps,
    COUNT(CASE WHEN verified = true THEN 1 END) as official_mcps,
    COUNT(CASE WHEN installation_methods IS NOT NULL AND jsonb_array_length(installation_methods) > 0 THEN 1 END) as enhanced_methods,
    COUNT(CASE WHEN tools IS NOT NULL AND jsonb_array_length(tools) > 0 THEN 1 END) as enhanced_tools,
    COUNT(CASE WHEN installation_methods IS NOT NULL AND tools IS NOT NULL THEN 1 END) as fully_enhanced
  FROM mcps;`
})
```

### Target Metrics
- **100% official classification accuracy**
- **100% installation methods enhancement**  
- **100% tools extraction completion**
- **100% proper parameter formatting**
- **Clean, consistent metadata**

## Database Connection
- **Project ID**: `zmfvcqjtubfclkhsdqjx`
- **Working Directory**: `/Users/antony/Documents/e14z/e14z`

## Best Practices
- **Read full README content** carefully before classification
- **Verify GitHub organization ownership** for official status
- **Extract all installation methods** available in documentation
- **Categorize tools meaningfully** based on functionality
- **Include authentication requirements** in commands
- **Handle SQL escaping** properly for quotes and apostrophes
- **Add delays between requests** to avoid rate limiting
- **Double-check parameter formatting** for proper spacing

## Error Handling
- Handle missing README files gracefully
- Skip repositories with insufficient documentation
- Log unclear official/community classifications for manual review
- Validate JSON structure before database updates