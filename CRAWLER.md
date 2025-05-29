# 🕷️ MCP Automated Crawler System

**Status: INACTIVE** ⏸️ (Requires manual activation)

## Overview

The MCP Crawler is an automated system that discovers new MCP servers, generates comprehensive AI-optimized tags, and keeps the E14Z database up-to-date without manual intervention.

## 🔧 System Components

### 1. **MCP Crawler** (`/lib/crawler/mcpCrawler.ts`)
- **Discovers MCPs** from multiple sources using Firecrawl
- **Extracts information** from GitHub repositories and awesome lists
- **Integrates with AI tag generation** for comprehensive searchability
- **Handles deduplication** to avoid processing existing MCPs

### 2. **Scheduler** (`/lib/crawler/scheduler.ts`)
- **Daily scheduling** at 6 AM UTC (configurable)
- **Retry logic** with exponential backoff
- **Run logging** and history tracking
- **Notification system** (webhook + email support)

### 3. **Control Scripts** (`/scripts/crawlerControl.ts`)
- **Manual control interface** for safe activation/testing
- **Status monitoring** and run history
- **Safety confirmations** for all activation commands

## 🚀 Quick Start

### Prerequisites

Set up your environment variables in `.env`:

```bash
# Required
FIRECRAWL_API_KEY=your_firecrawl_key
OPENAI_API_KEY=your_openai_key  # OR ANTHROPIC_API_KEY
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# Optional
GITHUB_TOKEN=your_github_token  # For enhanced discovery
```

### Database Setup

Run the SQL to create the crawler runs table:

```bash
# Apply the schema to your Supabase database
psql -f sql/crawler_runs_table.sql
```

### Commands

```bash
# Check system status
npm run crawler:status

# Test configuration
npm run crawler:test

# Enable the crawler (REQUIRES CONFIRMATION)
npm run crawler enable

# Run once manually
npm run crawler run-once

# Enable daily scheduling
npm run crawler schedule enable

# View run history
npm run crawler:history

# Disable everything
npm run crawler disable
```

## 🔍 Discovery Sources

The crawler monitors these sources for new MCPs:

1. **Official MCP Servers** - `github.com/modelcontextprotocol/servers`
2. **Awesome MCP List** - `github.com/punkpeye/awesome-mcp-servers`
3. **MCP Documentation** - `modelcontextprotocol.io/servers`
4. **GitHub Search - Popular** - `github.com/search?q=mcp&type=repositories&s=stars&o=desc`
5. **GitHub Search - Recent** - `github.com/search?q=mcp&type=repositories&s=updated&o=desc`

The GitHub search sources discover:
- ⭐ **Popular MCPs** sorted by GitHub stars (proven quality)
- 🔄 **Recently updated MCPs** sorted by last activity (active development)
- 🌟 **Community MCPs** not in official lists
- 📈 **Trending repositories** with MCP in name/description

Additional sources can be configured in the crawler config.

## 🏥 Health Checking

**NEW**: Before adding MCPs to the database, the crawler verifies they're actually live and working:

### Health Check Process
1. **Docker MCPs** - Tests if image exists and responds to `--help`
2. **NPX MCPs** - Validates package exists on npm and contains MCP keywords
3. **HTTP MCPs** - Checks endpoint responds and handles auth requirements
4. **UVX MCPs** - Verifies UV package is accessible
5. **Generic MCPs** - Falls back to GitHub repository accessibility

### Health Detection
- ✅ **Healthy** - MCP responds properly to protocol requests
- 🔑 **Requires Auth** - MCP responds but needs API keys (still healthy)
- ❌ **Down/Error** - MCP server not responding or broken
- ⚠️ **Unreachable** - Cannot contact MCP (skipped from database)

### Authentication Detection
The health checker can detect authentication requirements even without API keys:
- **API Key** - Detects "API key" in help/error messages
- **Token** - Identifies token-based authentication
- **OAuth** - Recognizes OAuth flows
- **Credentials** - Finds username/password requirements

**Only live, working MCPs are added to the database!** 🛡️

## 🧠 AI Integration

For each discovered MCP, the system:

1. **Health checks** to verify it's live and working
2. **Analyzes** name, description, and GitHub content
3. **Generates 25-35 comprehensive tags** covering:
   - Action verbs (create, send, manage, deploy)
   - Use case descriptions (issue tracking, team communication)
   - Problem-solution mapping (natural language → capabilities)
   - Alternative terminology and synonyms
   - Domain-specific terms

4. **Validates and cleans** tags for optimal search
5. **Updates database** with complete MCP information

## 📊 Monitoring & Logging

### Run History
- All crawler executions are logged in `crawler_runs` table
- Success/failure tracking with detailed results
- Performance metrics (duration, discovery counts)

### Status Monitoring
```bash
npm run crawler:status
```

Shows:
- ✅/❌ Component status (crawler, scheduler)
- 🔧 Configuration status (API keys, database)
- 📅 Last successful run information
- 📊 Performance metrics

### Notifications
- **Webhook notifications** for run completion/failure
- **Email alerts** (configurable)
- **Detailed error reporting** with retry information

## 🛡️ Safety Features

### Multiple Safety Layers
1. **Disabled by default** - Requires explicit activation
2. **Confirmation required** for all activation commands
3. **Rate limiting** to avoid API throttling
4. **Deduplication** to prevent processing existing MCPs
5. **Error handling** with graceful fallbacks

### Testing
```bash
# Safe configuration test
npm run crawler:test

# Test tag generation
npm run generate-tags:test

# Manual single run
npm run crawler run-once
```

## ⚙️ Configuration

### Crawler Config
```typescript
{
  enabled: false,           // Disabled by default
  rateLimitMs: 2000,       // 2 second delay between requests
  maxNewMCPsPerRun: 20,    // Limit discoveries per run
  healthCheckEnabled: true, // Health check MCPs before adding
  healthCheckTimeout: 10000, // 10 second timeout per check
  sources: [...],          // Discovery sources
}
```

### Scheduler Config
```typescript
{
  enabled: false,          // Disabled by default
  schedule: "0 6 * * *",   // Daily at 6 AM UTC
  retryAttempts: 3,        // Retry failed runs
  retryDelayMs: 300000,    // 5 minute retry delay
}
```

## 🔄 Workflow

### Daily Automated Run
```
6:00 AM UTC → Scheduler triggers
             ↓
             Crawler discovers new MCPs from all sources
             ↓
             Health check each MCP (skip if unreachable)
             ↓
             AI generates comprehensive tags
             ↓
             Database updated with live servers only
             ↓
             Run logged & notifications sent
```

### Manual Run
```
npm run crawler run-once → Immediate execution
                         ↓
                         Same discovery & processing
                         ↓
                         Results displayed in terminal
```

## 🚨 Activation Process

**⚠️ The crawler is INACTIVE by default for safety**

To activate:

1. **Set up environment** (API keys, database)
2. **Test configuration**: `npm run crawler:test`
3. **Enable crawler**: `npm run crawler enable` (requires confirmation)
4. **Test manual run**: `npm run crawler run-once`
5. **Enable scheduling**: `npm run crawler schedule enable` (requires confirmation)

## 🔮 Future Enhancements

- **Multi-region scheduling** for global coverage
- **Advanced source detection** (RSS feeds, social media)
- **Quality scoring** based on GitHub stars, activity
- **Community contribution** integration
- **Real-time health monitoring** of discovered MCPs

## 📞 Support

- Check status: `npm run crawler:status`
- View logs: `npm run crawler:history`
- Test system: `npm run crawler:test`
- Disable if needed: `npm run crawler disable`

---

**Remember**: The crawler is designed to be safe and controlled. It will not run automatically until you explicitly enable it with proper confirmation. 🛡️