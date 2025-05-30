# E14Z - AI Tool Discovery Platform

> The npm for AI agents. Discover, evaluate, and connect to Model Context Protocol (MCP) servers.

[![Live Platform](https://img.shields.io/badge/Platform-Live-green)](https://e14z.com)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-blue)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is E14Z?

E14Z is a discovery platform for Model Context Protocol (MCP) servers - the tools that power AI agents. Think of it as "npm for AI tools" where developers can:

- **Discover** MCP servers for any use case (payments, databases, APIs, etc.)
- **Evaluate** server quality, reliability, and community reviews  
- **Connect** directly from their AI agent with installation instructions
- **Contribute** by submitting new MCP servers to the registry

## 🚀 For AI Agent Users

### Connect to E14Z MCP Server

Get access to our entire MCP registry directly from your AI agent:

```bash
# Via NPX (recommended)
npx e14z-mcp

# Via Docker
docker run -i --rm e14z/mcp-server
```

Once connected, your AI agent can:
- Search for MCP servers: *"Find me payment processing tools"*
- Get installation instructions: *"How do I connect to the Stripe MCP?"*
- Discover by category: *"Show me all database tools"*

### Available Tools

- `discover` - Search and filter MCP servers
- `details` - Get detailed info about any MCP
- `review` - Submit feedback after using an MCP

## 🛠️ For MCP Developers

### Submit Your MCP Server

1. Visit [e14z.com/submit](https://e14z.com/submit)
2. Provide your GitHub repository URL
3. Our system automatically extracts:
   - Installation methods (npm, docker, git)
   - Available tools and capabilities
   - Documentation and examples

### Requirements

- GitHub repository with clear README
- Valid MCP server implementation
- Installation instructions
- Tool documentation

## 🏗️ Development Setup

### Prerequisites

- Node.js 18+
- Docker (optional)

### Local Development

```bash
# Clone the repository
git clone https://github.com/aemholland/e14z.git
cd e14z

# Install dependencies
npm install

# Start development server
npm run dev

# Visit http://localhost:3000
```

### Docker Development

```bash
# Start with Docker Compose
npm run docker:dev

# Visit http://localhost:3000
```

## 📚 API Reference

### REST API

```bash
# Search MCPs
GET /api/discover?q=payments&verified=true

# Get MCP details  
GET /api/mcp/{slug}

# Submit new MCP
POST /api/submit
```

### MCP Protocol API

```bash
# Connect via MCP protocol
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "discover",
    "arguments": {
      "query": "database tools",
      "verified": true
    }
  },
  "id": 1
}
```

## 🏢 Categories

- **Development** - GitHub, CI/CD, code tools
- **Communication** - Slack, Discord, messaging
- **Database** - MongoDB, SQL, data management  
- **Payment Processing** - Stripe, Square, billing
- **Infrastructure** - Docker, Kubernetes, DevOps
- **Productivity** - Task management, automation

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Ways to Contribute

- **Submit MCPs** - Add your MCP server to the registry
- **Improve UI/UX** - Enhance the developer experience
- **Report Issues** - Help us fix bugs and improve quality
- **Write Documentation** - Help other developers get started

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Community

- **Website**: [e14z.com](https://e14z.com)
- **Issues**: [GitHub Issues](https://github.com/aemholland/e14z/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aemholland/e14z/discussions)

---

**Built for the AI-powered future** 🤖