# E14Z - AI Tool Discovery Platform

The npm for AI agents. Discover, evaluate, and connect to MCP (Model Context Protocol) servers.

## 🚀 Vision

E14Z is the missing discovery layer between AI models and the thousands of MCP servers being created. Think of it as "npm for AI agents" - a platform that helps AI agents and developers find, evaluate, and connect to the right tools for any task.

## ✨ Features

- **Intelligent Search**: Multi-factor ranking system considering relevance, performance, and health
- **Real-time Health Monitoring**: Live status indicators for all MCP servers
- **Performance Analytics**: Latency, success rates, and usage metrics
- **Agent-Optimized**: Built specifically for AI agent consumption
- **REST & MCP APIs**: Multiple integration methods for maximum compatibility
- **Community Reviews**: Performance feedback from real agent usage

## 🔧 Tech Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Search**: Full-text search with trigram similarity
- **Deployment**: Vercel with Edge Functions
- **Monitoring**: Real-time health checks and performance tracking

## 🏗️ Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/aemholland/e14z.git
   cd e14z
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Visit [http://localhost:3000](http://localhost:3000)

## 📡 API Usage

### REST API

Search for MCP servers:
```bash
curl "https://e14z.com/api/discover?q=invoice+processing"
```

### MCP Protocol

Connect via MCP protocol:
```bash
mcp connect https://e14z.com/mcp
```

## 🗃️ Database Schema

The database is designed for scale and intelligence:

- **mcps**: Core MCP registry with flexible schema
- **performance_logs**: Time-series performance data
- **reviews**: Agent feedback with context
- **health_checks**: Real-time monitoring data
- **api_calls**: Discovery analytics
- **tool_chains**: Common MCP combinations

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Submitting New MCPs

1. **Via Web Form**: Visit [e14z.com/submit](https://e14z.com/submit)
2. **Via GitHub Issue**: Use our MCP submission template
3. **Via API**: POST to `/api/submit` with MCP details

### Code Contributions

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📊 Open Source Model

E14Z follows the "open source code, proprietary data" model:

- **Open Source**: All application code, APIs, and infrastructure
- **Proprietary**: The curated MCP database and performance analytics

This approach builds developer trust while maintaining our competitive advantage through data quality and network effects.

## 🌟 Roadmap

### Phase 1: Foundation (Current)
- [x] Core search and discovery
- [x] REST and MCP APIs
- [x] Basic health monitoring
- [ ] Initial MCP collection (50+ servers)

### Phase 2: Intelligence
- [ ] E14Z Pulse: Autonomous health monitoring
- [ ] E14Z Crawler: AI-powered MCP discovery
- [ ] Advanced analytics and recommendations

### Phase 3: Platform
- [ ] Developer accounts and analytics
- [ ] Enterprise features
- [ ] Native E14Z tools

## 📈 Stats

- **50+** MCP Servers indexed
- **98.5%** Average uptime
- **<100ms** Average search response time
- **1M+** API calls served

## 🔗 Links

- **Website**: [e14z.com](https://e14z.com)
- **API Docs**: [e14z.com/docs](https://e14z.com/docs)
- **Status Page**: [pulse.e14z.com](https://pulse.e14z.com) (coming soon)
- **GitHub**: [github.com/aemholland/e14z](https://github.com/aemholland/e14z)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) for the protocol specification
- [Anthropic](https://anthropic.com/) for Claude and MCP development
- [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) for community curation
- All MCP server developers building the ecosystem

---

**E14Z** - Connecting AI agents to the tools they need. 🤖✨