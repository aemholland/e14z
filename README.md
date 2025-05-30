# E14Z MCP Server

> The npm for AI agents. Discover, evaluate, and connect to Model Context Protocol (MCP) servers.

[![NPM Version](https://img.shields.io/npm/v/e14z)](https://www.npmjs.com/package/e14z)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-blue)](https://modelcontextprotocol.io)

## 🚀 Quick Start

```bash
# Connect to the E14Z MCP server
npx e14z
```

## 📚 What is E14Z?

E14Z is a discovery platform for Model Context Protocol (MCP) servers - the tools that power AI agents. It provides a centralized registry where developers can:

- **Discover** MCP servers for any use case (payments, databases, APIs, etc.)
- **Evaluate** server quality, reliability, and community reviews  
- **Connect** directly from their AI agent with installation instructions

## 🔧 Usage

### Connect to Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcps": {
    "e14z": {
      "command": "npx",
      "args": ["e14z"]
    }
  }
}
```

### Available Tools

Once connected, your AI agent can use these tools:

#### `discover`
Search and filter MCP servers by capabilities, category, or keywords.

```json
{
  "name": "discover",
  "arguments": {
    "query": "database tools",
    "category": "database",
    "verified": true,
    "limit": 10
  }
}
```

#### `details`
Get detailed information about a specific MCP server.

```json
{
  "name": "details", 
  "arguments": {
    "slug": "stripe-mcp"
  }
}
```

#### `review`
Submit feedback after using an MCP server.

```json
{
  "name": "review",
  "arguments": {
    "mcp_slug": "stripe-mcp",
    "rating": 9,
    "review_text": "Excellent payment integration tools",
    "use_case": "e-commerce checkout"
  }
}
```

## 🌍 Categories

Find MCP servers for any use case:

- **Development** - GitHub, CI/CD, code tools
- **Communication** - Slack, Discord, messaging
- **Database** - MongoDB, SQL, data management  
- **Payment Processing** - Stripe, Square, billing
- **Infrastructure** - Docker, Kubernetes, DevOps
- **Productivity** - Task management, automation

## 🏗️ For Developers

### HTTP Mode (Testing)

```bash
# Start HTTP server for testing
npx e14z --http

# Test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Environment Variables

- `E14Z_API_URL` - Override API endpoint (default: https://e14z.com)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Community

- **Website**: [e14z.com](https://e14z.com)
- **Submit MCPs**: [e14z.com/submit](https://e14z.com/submit)
- **Issues**: [GitHub Issues](https://github.com/aemholland/e14z/issues)

---

**Built for the AI-powered future** 🤖