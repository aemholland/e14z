# E14Z - MCP Discovery Platform

**The universal registry for MCP tools** - Discover, evaluate, and submit Model Context Protocol servers with intelligent analysis of their capabilities, performance, and reliability.

## 🎯 What is E14Z?

E14Z is a **focused MCP discovery platform** that makes finding and evaluating MCP tools as easy as searching npm. Instead of manually hunting through repositories, agents can use E14Z to:

- **🔍 Discover** relevant MCP tools through intelligent search with AI-powered analysis
- **📊 Evaluate** tool quality through comprehensive metadata and community reviews
- **🧠 Get Intelligence** Real-world performance data, authentication requirements, and health status
- **📝 Submit** community MCP discoveries to grow the ecosystem

### Why Use E14Z?

**For AI Agents:**
- Find the right MCP tool for any task in seconds
- Get comprehensive intelligence: performance, reliability, authentication needs
- Access community reviews and success rates
- Discover tools with detailed parameter schemas

**For Developers:**
- Submit your MCP tools to the registry
- Contribute to community tool discovery
- Access detailed tool metadata and schemas
- Build on a clean, focused platform

## 🚀 Quick Start for Agents

**1. Add E14Z to Claude Desktop:**
```json
{
  "mcpServers": {
    "e14z": {
      "command": "npx",
      "args": ["e14z@latest"]
    }
  }
}
```

**2. Start discovering tools:**
```json
{"name": "discover", "arguments": {"query": "database tools"}}
```

**3. Get detailed information:**
```json
{"name": "details", "arguments": {"slug": "postgres-mcp"}}
```

**4. Review and rate tools:**
```json
{"name": "review", "arguments": {"mcp_id": "mcp_123", "rating": 9, "success": true}}
```

## 🛠️ CLI Usage

**For Developers and Direct Use:**

```bash
# Install the E14Z MCP server for Claude Desktop
npx e14z@latest

# Or install globally for direct access
npm install -g e14z

# Discover MCP tools
e14z discover "database tools" --verified --limit 5

# Get detailed information about a specific MCP
e14z details postgres-mcp

# Submit reviews for MCPs
e14z review mcp_123 --rating 9 --success

# Submit new MCP discoveries
e14z submit my-awesome-mcp
```

### Core Features

- **🔍 Intelligent Discovery**: Advanced search with AI-powered analysis and tool categorization
- **📊 Comprehensive Metadata**: Detailed tool schemas, authentication requirements, and performance data
- **🛡️ Quality Assurance**: Community reviews, ratings, and reliability scores
- **📝 Community Submissions**: Easy submission system for new MCP discoveries
- **🌐 Production Ready**: Vercel-powered serverless architecture with global availability
- **🔄 Real-time Updates**: Live health monitoring and status tracking

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Node.js serverless functions
- **Database**: Supabase (PostgreSQL) with 9 core tables
- **Search**: Full-text search with intelligent ranking
- **Crawlers**: Multi-source discovery (npm, PyPI, Cargo, Go, GitHub)
- **Deployment**: Vercel with automated CI/CD
- **API**: 6 focused endpoints for core functionality

## 📋 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Vercel account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/e14z.git
   cd e14z
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Database is ready** (9 core tables in Supabase)
   - No local setup required

5. **Start development server**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🔧 Environment Configuration

### Required Environment Variables

```env
# Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Redis for caching and rate limiting
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Optional: Monitoring and analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
```

## 🚀 Getting Started for AI Agents

### For Claude Desktop Users

Add E14Z to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "e14z": {
      "command": "npx",
      "args": ["e14z@latest"]
    }
  }
}
```

**Config file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### For Other MCP Clients

E14Z works with any MCP-compatible client. Use the same configuration format or connect directly via the JSON-RPC protocol.

## 🔧 Comprehensive Intelligence System

E14Z provides **12 categories of intelligence** collected from real-world MCP testing:

### Intelligence Categories

1. **🛠️ Tool Intelligence**: Working/failing tool counts, success rates, schemas
2. **⚡ Performance Intelligence**: Response times, initialization speed, reliability scores  
3. **🔐 Authentication Intelligence**: Requirements, setup complexity, error patterns
4. **🏥 Health Intelligence**: Operational status, uptime, testing strategies
5. **📊 Quality Intelligence**: Documentation quality, user experience ratings
6. **💼 Business Intelligence**: Use cases, value propositions, pricing models
7. **🚨 Error Intelligence**: Common issues, troubleshooting guides, support availability
8. **📦 Resource Intelligence**: Available resources, prompt templates, example configs
9. **🔗 Protocol Intelligence**: MCP version compatibility, connection stability
10. **📈 Usage Intelligence**: Popularity scores, community adoption
11. **🧪 Testing Intelligence**: Validation strategies, compatibility checks
12. **📋 Metadata Intelligence**: Collection timestamps, crawler versions, data freshness

### Real-World Testing

Unlike other registries that rely on static descriptions, E14Z **actually tests each MCP**:

- **Tool Execution**: Tests each tool with sample parameters to verify functionality
- **Performance Measurement**: Records real initialization and response times
- **Health Monitoring**: Continuous monitoring of MCP operational status
- **Authentication Detection**: Identifies auth requirements through actual testing
- **Error Pattern Analysis**: Captures and categorizes common failure modes

### Agent Integration Examples

Once connected, agents can use these tools:

**🔍 Discover MCP Tools with Intelligence:**
```json
{
  "name": "discover",
  "arguments": {
    "query": "database postgres",
    "verified": true,
    "limit": 10,
    "no_auth": true
  }
}
```

Returns **structured JSON data** with comprehensive intelligence including:
- ✅ Working/failing tool counts and success rates
- ⚡ Real performance metrics (response times, initialization speed)
- 🏥 Health status (healthy/degraded/down/unknown) 
- 📊 Quality scores and reliability ratings
- 🔐 Authentication requirements and setup instructions
- 💼 Business information (use cases, value propositions)
- 🚨 Error patterns and troubleshooting guides

**📋 Get Detailed Information:**
```json
{
  "name": "details", 
  "arguments": {
    "slug": "postgres-mcp"
  }
}
```

Returns **complete structured data** including all 12 intelligence categories, tool schemas, performance metrics, and operational insights.

**▶️ Execute MCP Server:**
```json
{
  "name": "run",
  "arguments": {
    "slug": "postgres-mcp",
    "skip_auth_check": false
  }
}
```

The `run` tool automatically:
- **Auto-installs** the MCP if not locally available
- **Detects** the best package manager (npm, pipx, cargo, go)
- **Validates** authentication requirements
- **Returns** execution status and any auth setup needed

**⭐ Submit Performance Review:**
```json
{
  "name": "review",
  "arguments": {
    "mcp_id": "mcp_123",
    "rating": 9,
    "success": true,
    "use_case": "Database queries",
    "tasks_completed": 5,
    "tasks_failed": 0,
    "rating_breakdown": {
      "setup_difficulty": 3,
      "documentation_quality": 3,
      "reliability": 3,
      "performance": 3
    },
    "discovery_effectiveness": "perfect_match"
  }
}
```

### Smart Discovery Features

**Filter by Requirements:**
```json
// Find MCPs that work immediately (no auth needed)
{"name": "discover", "arguments": {"no_auth": true}}

// Find only verified/official MCPs
{"name": "discover", "arguments": {"verified": true}}

// Find MCPs that can be executed directly
{"name": "discover", "arguments": {"executable": true}}

// Search by category and capability
{"name": "discover", "arguments": {"query": "payment stripe API"}}
```

**Get Actionable Results:**
- **Installation commands** ready to copy/paste
- **Authentication requirements** clearly specified
- **Tool parameters** with examples
- **Performance metrics** from real usage
- **Community reviews** and success rates

## 🔄 Complete Agent Workflow

**1. Discover MCPs:**
```json
{"name": "discover", "arguments": {"query": "database"}}
```

**2. Get Details:**
```json
{"name": "details", "arguments": {"slug": "postgres-mcp"}}
```

**3. Run MCP Server:**
```json
{"name": "run", "arguments": {"slug": "postgres-mcp"}}
```
*→ Returns session ID and available tools*

**4. Execute MCP Tools:**
```json
{
  "name": "call",
  "arguments": {
    "session_id": "mcp_session_123",
    "tool_name": "query_database",
    "tool_arguments": {"query": "SELECT * FROM users"}
  }
}
```

**5. Manage Sessions:**
```json
{"name": "sessions", "arguments": {}}
```
*→ View active sessions and their tools*

**6. Submit Review:**
```json
{
  "name": "review",
  "arguments": {
    "mcp_id": "mcp_123",
    "rating": 9,
    "success": true
  }
}
```

### Session Management (2025 Standards)
- **Automatic initialization** - Complete MCP lifecycle (initialize → tools/list → tools/call)
- **Session security** - Enhanced validation and timeout enforcement
- **Resource protection** - Memory limits, nesting controls, and content filtering
- **Session isolation** - Each MCP runs independently with proper cleanup
- **Smart timeouts** - 30 minutes inactivity, 2 hours maximum session age

## 🤖 Multi-Source Discovery

E14Z discovers MCPs from multiple package ecosystems with intelligent analysis:

### Supported Package Managers

| Language | Package Manager | Reliability | Performance | Key Benefits |
|----------|----------------|-------------|-------------|--------------|
| **JavaScript/TypeScript** | npm/npx | Good | Baseline | Industry standard, wide ecosystem |
| **Python** | pipx | **Excellent** | 1x | Isolated environments, auto PATH management |
| **Rust** | cargo | **Excellent** | **High** | Static binaries, zero dependencies |
| **Go** | go install | **Excellent** | **High** | Ultra-simple, instant startup |

### Automatic Package Manager Detection

E14Z automatically detects and uses the optimal package manager for each MCP:

```bash
# Python MCPs automatically use pipx for reliability and isolation
e14z run python-mcp-server

# Rust MCPs use cargo for maximum performance
e14z run rust-mcp-tool  

# Go MCPs use go install for simplicity and reliability
e14z run go-mcp-service

# Node.js MCPs use npm/npx as standard
e14z run node-mcp-server
```

### Key Reliability Improvements

- **Python**: Switched from pip to pipx with isolated environments and automatic PATH management
- **Rust**: Native cargo support with static binaries and superior performance
- **Go**: Ultra-reliable go install with simple installation and instant startup
- **Auto-conversion**: Legacy pip commands automatically converted to pipx for improved reliability

### Security Features

- **Sandboxed execution** with resource limits and timeout protection
- **Package verification** with security scanning and threat detection  
- **Command injection protection** with strict input validation
- **Isolated environments** preventing dependency conflicts and system pollution

## 📊 API Documentation

### REST API Endpoints

- `GET /api/discover` - Search and discover MCP servers
- `GET /api/mcp/[slug]` - Get detailed MCP information
- `POST /api/review` - Submit MCP reviews and ratings
- `GET /api/analytics` - Access performance analytics
- `GET /api/health` - System health and status

### Interactive API Documentation

Visit `/api-docs` for the complete OpenAPI documentation with interactive testing capabilities.

## 🔐 Security Features

### MCP Protocol Security
- **Input Validation**: Comprehensive sanitization and validation
- **Rate Limiting**: Multi-tier protection with automatic IP blocking
- **Protocol Compliance**: Strict JSON-RPC 2.0 adherence
- **Method Allowlisting**: Restricted tool execution for security

### Application Security
- **Authentication**: Secure JWT-based authentication
- **Authorization**: Role-based access control
- **Data Protection**: Encryption at rest and in transit
- **Audit Logging**: Comprehensive security event tracking

## 📈 Performance & Monitoring

### Performance Metrics
- **API Response Times**: <200ms for 95% of requests
- **Database Queries**: 80-95% performance improvement over baseline
- **Cache Hit Rates**: >80% for frequently accessed data
- **Uptime**: 99.9% availability with comprehensive monitoring

### Monitoring Stack
- **APM**: Real-time application performance monitoring
- **Database Monitoring**: Query performance and connection pool tracking
- **Security Monitoring**: Threat detection and incident response
- **Business Analytics**: Usage patterns and platform growth metrics

## 🚀 Deployment

### Vercel Deployment

1. **Connect to Vercel**
   ```bash
   vercel link
   ```

2. **Configure environment variables in Vercel dashboard**

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Manual Deployment

See the [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions on self-hosting and alternative deployment options.

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm run test

# Integration tests  
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance
```

### Test Coverage

- **Unit Tests**: Core business logic and utilities
- **Integration Tests**: API endpoints and database operations
- **E2E Tests**: Complete user workflows and MCP interactions
- **Performance Tests**: Database optimization and load testing

## 📚 Documentation

- [Development Guide](./DEVELOPMENT.md) - Comprehensive development documentation
- [API Documentation](./docs/API.md) - Detailed API reference
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment instructions
- [Contributing Guide](./CONTRIBUTING.md) - Guidelines for contributors

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Code of conduct
- Development setup
- Pull request process
- Coding standards
- Testing requirements

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request
5. Automated testing and review

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🌟 Community

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Community discussions and support
- **Discord**: Real-time community chat (coming soon)

## 🙏 Acknowledgments

- Model Context Protocol specification and community
- Open source contributors and maintainers
- Vercel for hosting and deployment platform
- Supabase for database and authentication services

---

Built with ❤️ for the AI and MCP community. E14Z makes MCP discovery intelligent, reliable, and scalable.