# MCP Discovery Workflow for Claude Code

## Overview
This workflow guides Claude Code through discovering new MCPs from various sources, properly classifying them as official or community-made, and adding them to the e14z database with complete metadata.

## Pre-Discovery Assessment

### 1. Check Current Database Status
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT COUNT(*) as total_mcps, COUNT(CASE WHEN verified = true THEN 1 END) as official_mcps, COUNT(CASE WHEN verified = false THEN 1 END) as community_mcps FROM mcps;"
})
```

### 2. Review Recent Additions
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT name, github_url, verified, created_at FROM mcps ORDER BY created_at DESC LIMIT 10;"
})
```

## Primary Discovery Sources

### 1. Official MCP Registry
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/modelcontextprotocol/servers",
  "formats": ["markdown"],
  "onlyMainContent": true
})
```
**Look for**: Official company-maintained servers listed in README

### 2. Community Awesome List
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/punkpeye/awesome-mcp-servers",
  "formats": ["markdown"],
  "onlyMainContent": true
})
```
**Look for**: Community-curated list of MCP implementations

### 3. MCP Documentation Site
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://modelcontextprotocol.io/servers",
  "formats": ["markdown"],
  "onlyMainContent": true
})
```
**Look for**: Official documentation with server listings

## GitHub Discovery Search

### 4. Popular MCP Repositories
```javascript
mcp__firecrawl__firecrawl_search({
  "query": "mcp server model context protocol",
  "limit": 20,
  "scrapeOptions": {
    "formats": ["markdown"],
    "onlyMainContent": true
  }
})
```

### 5. Recent MCP Updates
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/search?q=mcp&type=repositories&s=updated&o=desc",
  "formats": ["markdown"]
})
```

### 6. MCP Server Specific Search
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/search?q=mcp-server&type=repositories&s=stars&o=desc",
  "formats": ["markdown"]
})
```

### 7. GitHub Topics
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/topics/mcp",
  "formats": ["markdown"]
})

mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/topics/model-context-protocol", 
  "formats": ["markdown"]
})
```

## Processing Discovery Results

### Step 1: Extract Repository URLs
From scraped content, identify GitHub repository URLs:
- Pattern: `https://github.com/[owner]/[repo]`
- Look for: Repository links, markdown references
- Focus on: Active repositories with recent commits

### Step 2: Validate Against Existing Database
```javascript
// Check if already exists
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT name, github_url FROM mcps WHERE github_url = 'https://github.com/owner/repo';"
})
```

### Step 3: Scrape New Repository
```javascript
mcp__firecrawl__firecrawl_scrape({
  "url": "https://github.com/owner/new-mcp-repo",
  "formats": ["markdown"],
  "onlyMainContent": true
})
```

### Step 4: Analyze Repository Content

#### A. Determine Official vs Community Status
```javascript
// Official criteria - must be from company GitHub org
const officialOrgs = [
  'github', 'stripe', 'notion', 'square', 'buildkite', 
  'circleci', 'cloudflare', 'elevenlabs', 'twilio',
  'anthropic', 'openai'
];

const githubUrl = "https://github.com/owner/repo";
const owner = githubUrl.split('/')[3];
const isOfficial = officialOrgs.includes(owner.toLowerCase());

// Additional checks:
// - Company authentication (API keys from the company)
// - Official documentation style
// - Company branding in README
```

#### B. Extract Installation Methods
Look for installation commands:
- **NPM**: `npx package-name`, `npm install package`
- **Docker**: `docker run`, `docker pull` with proper flags
- **Python**: `uvx package`, `pip install package`, `uv run`
- **Git**: `git clone` with setup steps
- **Binary**: Download links, installation scripts

#### C. Extract Tools and Features
Parse README sections:
- "Tools", "Available Tools", "Features", "Commands"
- Function definitions, API references
- Tool descriptions and capabilities
- Usage examples

#### D. Extract Metadata
- **Name**: Clean repository/package name
- **Description**: Clear functionality description
- **Author**: Company name or developer name
- **License**: From package.json, LICENSE file, or README
- **Category**: Primary use case category

### Step 5: Generate Slug
```javascript
// Create URL-friendly slug
const slug = name
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .trim();
```

### Step 6: Add to Database
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": `INSERT INTO mcps (
    name, slug, description, github_url, author, license, verified,
    endpoint, installation_methods, tools, use_cases, category,
    connection_type, protocol_version, created_at, updated_at
  ) VALUES (
    '${name}',
    '${slug}',
    '${description}',
    '${github_url}',
    '${author}',
    '${license}',
    ${verified},
    '${primary_install_command}',
    '${JSON.stringify(installation_methods)}'::jsonb,
    '${JSON.stringify(tools)}'::jsonb,
    '${JSON.stringify(use_cases)}'::jsonb,
    '${category}',
    'stdio',
    '2024-11-05',
    NOW(),
    NOW()
  );`
})
```

## Quality Standards for New MCPs

### ✅ Required Information
- [ ] **Name**: Clear, descriptive name (no "Official" suffix)
- [ ] **Description**: Comprehensive functionality description
- [ ] **GitHub URL**: Valid, accessible repository
- [ ] **Installation methods**: At least one complete installation method
- [ ] **Author**: Accurate author/company attribution
- [ ] **Official status**: Correctly classified based on GitHub organization

### ✅ Enhanced Information (Preferred)
- [ ] **Multiple installation methods**: NPM, Docker, Git options when available
- [ ] **Tools enumeration**: Complete list of available tools
- [ ] **License information**: Proper license attribution
- [ ] **Use cases**: Clear use case categories
- [ ] **Authentication requirements**: API keys, tokens needed

### ✅ Quality Checks
- [ ] **No duplicates**: Not already in database
- [ ] **Active repository**: Recent commits, maintained
- [ ] **Proper documentation**: README with clear instructions
- [ ] **Working installation**: Commands appear functional
- [ ] **Parameter formatting**: Proper spacing in commands

## Official vs Community Classification Rules

### Official MCPs (verified=true)
**Strict criteria - must meet ALL:**
1. **Company GitHub organization**: `github.com/company/repo`
2. **Company authentication**: Uses company-provided API keys
3. **Official documentation**: Company-style README and docs
4. **Company maintenance**: Active company developer commits

**Examples**:
- ✅ `github.com/stripe/agent-toolkit` (Official Stripe)
- ✅ `github.com/github/github-mcp-server` (Official GitHub)
- ❌ `github.com/box-community/mcp-server-box` (Community org, not official)

### Community MCPs (verified=false)
**Any of these:**
1. **Individual developer**: Personal GitHub account
2. **Community organization**: Non-company community group
3. **Third-party integration**: Unofficial implementation
4. **Fork/adaptation**: Modified version of official server

## Discovery Target Goals

### Per Discovery Session
- **Discover**: 5-10 new potential MCPs
- **Quality filter**: Only add high-quality, documented MCPs
- **Classification accuracy**: 100% correct official/community status
- **Complete metadata**: All required fields populated

### Ongoing Maintenance
- **Weekly discovery**: Check for new repositories
- **Monthly validation**: Verify existing MCPs still active
- **Quarterly enhancement**: Update descriptions and tools

## Validation Commands

### Check Discovery Success
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": `SELECT 
    COUNT(*) as total_mcps,
    COUNT(CASE WHEN verified = true THEN 1 END) as official_count,
    COUNT(CASE WHEN verified = false THEN 1 END) as community_count,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_additions
  FROM mcps;`
})
```

### Verify New Addition Quality
```javascript
mcp__supabase__execute_sql({
  "project_id": "zmfvcqjtubfclkhsdqjx",
  "query": "SELECT name, verified, author, installation_methods IS NOT NULL as has_install, tools IS NOT NULL as has_tools FROM mcps ORDER BY created_at DESC LIMIT 5;"
})
```

## Error Handling & Edge Cases

### Common Issues
- **Private repositories**: Skip inaccessible repos
- **Incomplete documentation**: Flag for manual review
- **Ambiguous classification**: Default to community, review manually
- **Duplicate detection**: Check name similarity and GitHub URL

### Quality Filters
- **Minimum stars**: Consider repositories with >5 stars
- **Recent activity**: Prefer repositories updated within last year
- **Documentation quality**: Require clear README with installation instructions
- **Functional commands**: Installation methods should be complete and functional

## Success Metrics
- **Discovery rate**: 5-10 quality MCPs per session
- **Classification accuracy**: 100% correct official/community status
- **Data completeness**: All new MCPs have installation methods and tools
- **Zero duplicates**: No duplicate entries in database
- **Quality maintenance**: Only high-quality, documented MCPs added