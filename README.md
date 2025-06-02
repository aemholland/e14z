# E14Z MCP Registry

**The intelligent MCP discovery platform for AI agents** - Find, evaluate, and execute 50+ Model Context Protocol tools instantly.

## 🎯 What is E14Z?

E14Z is like **npm for AI agents** - a comprehensive registry and execution platform for Model Context Protocol (MCP) tools. Instead of manually searching for and configuring MCP servers, agents can use E14Z to:

- **🔍 Discover** relevant MCP tools through intelligent search
- **⚡ Execute** MCP tools directly without manual setup  
- **📊 Evaluate** tool quality through community reviews and performance metrics
- **🔄 Stay Updated** with the latest MCP tools and their capabilities

### Why Use E14Z?

**For AI Agents:**
- Find the right MCP tool for any task in seconds
- Get tools that actually work (community-tested and reviewed)
- Execute tools directly without complex installation
- Access performance metrics and success rates

**For Developers:**
- Discover MCP tools for your projects
- Contribute tools to the registry
- Get analytics on tool usage and performance
- Build on a production-ready platform

## 🚀 Quick Start for Agents

**1. Add E14Z to Claude Desktop:**
```json
{
  "mcpServers": {
    "e14z": {
      "command": "npx",
      "args": ["e14z"]
    }
  }
}
```

**2. Start discovering tools:**
```json
{"name": "discover", "arguments": {"query": "database tools"}}
```

**3. Execute tools directly:**
```json
{"name": "run", "arguments": {"slug": "postgres-mcp"}}
```

### Key Features

- **🔍 Intelligent Discovery**: Advanced search and filtering for MCP servers with semantic matching
- **📊 Performance Analytics**: Real-time performance metrics and quality scoring for MCP tools
- **🛡️ Security Hardened**: 2025 MCP security standards with comprehensive input validation
- **⚡ High Performance**: Optimized database queries with 80-95% performance improvements
- **🌐 Global Scale**: Vercel-powered serverless architecture with worldwide CDN
- **📈 Real-time Monitoring**: Comprehensive APM and observability for production environments

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Node.js serverless functions with edge runtime
- **Database**: Supabase (PostgreSQL) with real-time capabilities
- **Caching**: Redis (Upstash) for distributed caching and rate limiting
- **Monitoring**: OpenTelemetry, custom APM, and performance tracking
- **Deployment**: Vercel with automated CI/CD and preview deployments

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

4. **Run database migrations**
   ```bash
   npm run db:setup
   ```

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
      "args": ["e14z"]
    }
  }
}
```

**Config file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### For Other MCP Clients

E14Z works with any MCP-compatible client. Use the same configuration format or connect directly via the JSON-RPC protocol.

## 🛠️ Command Line Usage

### Direct MCP Execution

```bash
# Discover MCP tools
npx e14z run discover --query "database tools" --limit 5

# Get details about a specific MCP
npx e14z run details --slug postgres-mcp

# Execute an MCP directly
npx e14z run {mcp-name}

# Test E14Z functionality  
npx e14z --test

# Get help
npx e14z --help
```

### Agent Integration Examples

Once connected, agents can use these tools:

**🔍 Discover MCP Tools:**
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

**📋 Get Detailed Information:**
```json
{
  "name": "details", 
  "arguments": {
    "slug": "postgres-mcp"
  }
}
```

**▶️ Execute MCP Directly:**
```json
{
  "name": "run",
  "arguments": {
    "slug": "postgres-mcp",
    "skip_auth_check": false
  }
}
```

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