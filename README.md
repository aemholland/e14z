# E14Z - The npm for AI Agents

> Discover, run, and publish Model Context Protocol (MCP) servers. The definitive registry and execution platform for AI agent tools.

[![NPM Version](https://img.shields.io/npm/v/e14z)](https://www.npmjs.com/package/e14z)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-blue)](https://modelcontextprotocol.io)
[![Tests](https://img.shields.io/badge/Tests-24%2F24%20Passing-green)](https://github.com/aemholland/e14z)

## 🚀 Quick Start

```bash
# Install globally
npm install -g e14z

# Discover MCPs
e14z discover payments

# Run an MCP directly
e14z run stripe

# Authenticate for publishing
e14z auth login
```

## 🌟 What is E14Z?

E14Z transforms how developers work with Model Context Protocol (MCP) servers. Think "npm for AI agents" - a complete platform for discovering, executing, and publishing AI tools.

### 🔥 **NEW in v3.0**: Full Execution Platform

- **🏃 Direct Execution**: Run MCPs instantly with `e14z run <name>`
- **🔐 Smart Authentication**: Automatic auth detection and setup guidance
- **📦 Publishing System**: Publish your MCPs with GitHub integration
- **🏷️ Claiming System**: Claim ownership of community-wrapped MCPs
- **🛡️ Security First**: CVE-2024-27980 mitigations and input validation

## 🔧 Usage

### Discovery & Execution

```bash
# Find MCPs by category
e14z discover payments --verified

# Get detailed information
e14z info stripe

# Execute directly (with auth detection)
e14z run stripe

# List all MCPs with execution status
e14z list --executable-only
```

### Publishing & Management

```bash
# Authenticate with GitHub
e14z auth login

# Publish a new MCP
e14z publish new my-awesome-mcp

# Generate package template
e14z publish template my-mcp

# List your published MCPs
e14z publish list
```

### Claiming Wrapped MCPs

```bash
# See available MCPs to claim
e14z claim list

# Claim ownership with verification
e14z claim mcp package-name

# Check claim status
e14z claim status
```

### MCP Server (AI Agent Interface)

E14Z provides a comprehensive MCP server for autonomous agents with 4 powerful tools:

```json
{
  "mcpServers": {
    "e14z": {
      "command": "e14z"
    }
  }
}
```

#### 🔍 **Agent Tools Available**

**Discovery with Auth Intelligence:**
```javascript
// Find MCPs that work immediately (no auth required)
{"name": "discover", "arguments": {"no_auth": true, "limit": 10}}

// Find MCPs by category and auth requirements  
{"name": "discover", "arguments": {"category": "payments", "auth_required": true}}

// Find executable MCPs only
{"name": "discover", "arguments": {"executable": true, "verified": true}}
```

**Direct Execution:**
```javascript
// Execute compatible MCPs with smart auth handling
{"name": "run", "arguments": {"slug": "weather-mcp"}}

// Skip auth checks for testing (may fail)
{"name": "run", "arguments": {"slug": "stripe", "skip_auth_check": true}}
```

**Detailed Information:**
```javascript
// Get comprehensive MCP details including tools and setup
{"name": "details", "arguments": {"slug": "bitcoin-mcp"}}
```

**Performance Feedback:**
```javascript
// Submit structured reviews to improve ecosystem quality
{"name": "review", "arguments": {
  "mcp_id": "abc123", "rating": 8, "success": true,
  "rating_breakdown": {"setup_difficulty": 3, "reliability": 3},
  "use_case_category": "payments"
}}
```

## 🏗️ Architecture

E14Z v3.0 is built with a modular, security-first architecture:

### Core Components

- **🖥️ CLI Tool** (`e14z`): User-facing command interface
- **🤖 MCP Server** (`e14z`): AI agent discovery tool (same binary, different mode)
- **⚡ Execution Engine**: Secure MCP execution with auth detection
- **🔐 Auth Manager**: GitHub OAuth with encrypted local storage
- **📦 Publishing System**: Full MCP lifecycle management
- **🏷️ Claiming System**: Ownership verification for wrapped MCPs

### Security Features

- **Command Injection Prevention**: Blocks dangerous shell characters
- **Path Traversal Protection**: Prevents `../` and similar attacks
- **Input Validation**: Comprehensive slug and command validation
- **Environment Sanitization**: Safe execution environment
- **Encrypted Storage**: XDG-compliant credential management

## 📚 Available MCPs

Discover 50+ verified MCP servers across 16 categories:

| Category | Examples | Auth Required |
|----------|----------|---------------|
| **Payments** | Stripe, Square, Bitcoin | 🔐 API Keys |
| **Databases** | MongoDB, ClickHouse, BigQuery | 🔐 Credentials |
| **AI Tools** | ElevenLabs, LangFuse, Memory | 🔓 Mixed |
| **Development** | GitHub, CircleCI, Docker | 🔐 OAuth/Tokens |
| **Cloud Storage** | Google Drive, Box | 🔐 OAuth |
| **Communication** | Twilio, Slack | 🔐 API Keys |
| **Productivity** | Notion, Linear, Todoist | 🔐 OAuth |
| **Infrastructure** | AWS, Kubernetes, CloudFlare | 🔐 Credentials |

## 🔐 Authentication

E14Z provides intelligent authentication detection and management:

### Supported Auth Methods

- **None**: Public APIs and services
- **API Key**: Service-specific keys and tokens  
- **OAuth**: GitHub, Google, and social providers
- **Credentials**: Username/password, connection strings

### Authentication Flow

```bash
# 1. Login with GitHub
e14z auth login

# 2. Run MCP with auth detection
e14z run stripe
# → Detects API key requirement
# → Provides setup instructions
# → Offers to run anyway with --skip-auth-check

# 3. Check auth status
e14z auth status
```

## 🏗️ For Developers

### Publishing Your MCP

1. **Create Package Template**
   ```bash
   e14z publish template my-mcp
   # Edit e14z-package.json
   ```

2. **Publish to Registry**
   ```bash
   e14z publish new -f e14z-package.json
   ```

3. **Your MCP is Live!**
   - Available via `e14z discover`
   - Executable via `e14z run your-mcp`
   - Listed in registry with verification pending

### Claiming Existing MCPs

If we've already wrapped your MCP from public sources:

```bash
# Find claimable MCPs
e14z claim list

# Claim with GitHub verification
e14z claim mcp your-package
# → Automatically verifies GitHub ownership
# → Grants you publishing rights
```

### Auto-Wrapping System

E14Z automatically wraps new MCPs from various sources:

- **NPM packages**: `npm install package` → `npx package`
- **Python packages**: `pip install package` → `uvx package`  
- **GitHub repos**: Extracts install commands from README
- **Auth detection**: Analyzes descriptions for auth requirements

## 🔧 Advanced Usage

### Environment Configuration

```bash
# Custom API endpoint
export E14Z_API_URL=https://your-instance.com

# GitHub client ID for OAuth
export E14Z_GITHUB_CLIENT_ID=your_client_id
```

### Command Examples

```bash
# Discovery with filters
e14z discover "bitcoin payments" --category finance --verified

# Execution with auth bypass
e14z run stripe --skip-auth-check

# Publishing with custom template
e14z publish new my-mcp --file custom-package.json

# Claiming with category filter
e14z claim list --category payments
```

### Integration with CI/CD

```yaml
# GitHub Actions example
- name: Publish MCP
  run: |
    echo "${{ secrets.GITHUB_TOKEN }}" | e14z auth login
    e14z publish new --file mcp-package.json
```

## 🧪 Testing & Diagnostics

### Built-in Diagnostics

```bash
# System health check
e14z diagnose

# Connectivity test
e14z discover --limit 1

# MCP server test
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | e14z
```

### Test Results

E14Z v3.0 passes **24/24 security and functionality tests**:

- ✅ **Security**: Command injection, path traversal, input validation
- ✅ **Execution**: Safe command parsing and environment setup
- ✅ **Auth Detection**: Accurate requirement identification
- ✅ **Auto-Wrapping**: NPM/Python package command generation

## 🔧 Troubleshooting

### Common Issues

**Command not found: e14z**
```bash
npm install -g e14z
# or
npx e14z discover
```

**Authentication failed**
```bash
e14z auth logout
e14z auth login
```

**MCP execution failed**
```bash
# Check auth requirements
e14z info <mcp-name>

# Run diagnostics
e14z diagnose

# Skip auth check for testing
e14z run <mcp-name> --skip-auth-check
```

**Publishing errors**
```bash
# Ensure authenticated
e14z auth status

# Validate package
e14z publish template test && cat e14z-package.json
```

### Getting Help

- **Documentation**: [e14z.com/docs](https://e14z.com/docs)
- **Issues**: [GitHub Issues](https://github.com/aemholland/e14z/issues)
- **Diagnostics**: `e14z diagnose`


## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🌟 Community

- **Website**: [e14z.com](https://e14z.com)
- **Registry**: [e14z.com/browse](https://e14z.com/browse)
- **Publishing**: `e14z publish new`
- **Issues**: [GitHub Issues](https://github.com/aemholland/e14z/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aemholland/e14z/discussions)

---

**Built for the AI-powered future** 🤖 | **Powered by Model Context Protocol** ⚡