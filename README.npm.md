# E14Z MCP Server

> AI Tool Discovery Platform. Discover, evaluate, and connect to 50+ Model Context Protocol (MCP) servers.

[![NPM Version](https://img.shields.io/npm/v/e14z)](https://www.npmjs.com/package/e14z)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-blue)](https://modelcontextprotocol.io)

## 🚀 Quick Start

```bash
# Connect to the E14Z MCP server
npx e14z
```

## 📚 What is E14Z?

E14Z is a discovery platform for Model Context Protocol (MCP) servers - the tools that power AI agents. With over 50 verified MCP servers, it provides a centralized registry where developers can:

- **Discover** MCP servers for any use case (payments, databases, APIs, etc.)
- **Evaluate** server quality, reliability, and community reviews  
- **Connect** directly from their AI agent with installation instructions

## 🔧 Usage

### Connect to Claude Desktop

Add this to your `claude_desktop_config.json`:

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

### Available Tools

Once connected, your AI agent can use these tools:

#### `discover`
Search and filter MCP servers by capabilities, category, or keywords.

```json
{
  "name": "discover",
  "arguments": {
    "query": "databases",
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
    "slug": "stripe"
  }
}
```

#### `review`
Submit feedback after using an MCP server.

```json
{
  "name": "review",
  "arguments": {
    "mcp_id": "d2127d6c-a314-47b1-ba80-8b95ca934e01",
    "rating": 9,
    "review_text": "Excellent payment integration tools",
    "use_case": "e-commerce checkout"
  }
}
```

## 🌍 Categories

Find MCP servers across 16 standardized categories:

- **AI Tools** - LLMs, machine learning services
- **Cloud Storage** - File storage and management
- **Communication** - Video calls, messaging platforms
- **Content Creation** - Text, image, media generation
- **Databases** - MongoDB, PostgreSQL, data management
- **Development Tools** - GitHub, CI/CD, coding utilities
- **Finance** - Accounting, invoicing, financial services
- **Infrastructure** - DevOps, deployment, cloud services
- **IoT** - Smart home, device control
- **Payments** - Stripe, Bitcoin, financial transactions
- **Productivity** - Office tools, utilities
- **Project Management** - Task tracking, collaboration
- **Research** - Academic tools, data analysis
- **Security** - Authentication, encryption
- **Social Media** - Platform integrations
- **Web APIs** - REST services, integrations

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

- `E14Z_API_URL` - Override API endpoint (default: https://www.e14z.com)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Community

- **Website**: [e14z.com](https://e14z.com)
- **Submit MCPs**: [e14z.com/submit](https://e14z.com/submit)
- **Issues**: [GitHub Issues](https://github.com/aemholland/e14z/issues)

---

**Built for the AI-powered future** 🤖