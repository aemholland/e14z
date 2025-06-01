# E14Z - Universal MCP Runtime

> NPX-like auto-installation and execution of Model Context Protocol (MCP) servers for AI agents. The definitive registry and execution platform for AI agent tools.

[![NPM Version](https://img.shields.io/npm/v/e14z)](https://www.npmjs.com/package/e14z)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-blue)](https://modelcontextprotocol.io)
[![Tests](https://img.shields.io/badge/Tests-21%2F21%20Passing-green)](https://github.com/aemholland/e14z)

## 🚀 Quick Start

```bash
# Install globally
npm install -g e14z

# Discover MCPs
e14z discover payments

# Auto-install and run any MCP (like npx!)
e14z run stripe

# Check what's cached
e14z cache list

# Authenticate for publishing
e14z auth login
```

## 🌟 What is E14Z?

E14Z is the **Universal MCP Runtime** - think "npx for AI agents". It automatically installs and executes Model Context Protocol (MCP) servers on-demand, just like npx does for npm packages.

### 🔥 **NEW in v4.0**: Auto-Installation Engine

- **🤖 NPX-like Auto-Installation**: Install any MCP on first run
- **🔒 Enterprise-Grade Security**: Multi-layer threat detection and sandboxing  
- **📦 Multi-Package Manager Support**: npm, pip, git repositories
- **⚡ Intelligent Caching**: Fast execution with integrity verification
- **🔄 Transaction Rollback**: Automatic cleanup on installation failures
- **🛡️ Security Scanning**: Typosquatting detection and malicious package protection

### Previous Features (v3.0+)

- **🏃 Direct Execution**: Run MCPs instantly with `e14z run <name>`
- **🔐 Smart Authentication**: Automatic auth detection and setup guidance
- **📦 Publishing System**: Publish your MCPs with GitHub integration
- **🏷️ Claiming System**: Claim ownership of community-wrapped MCPs
- **🛡️ Security First**: CVE-2024-27980 mitigations and input validation

## 🔧 Usage

### Discovery & Auto-Installation

```bash
# Find MCPs by category
e14z discover payments --verified

# Get detailed information
e14z info stripe

# Auto-install and execute (like npx!)
e14z run stripe

# Run without auto-installation (old behavior)
e14z run stripe --no-auto-install

# List all MCPs with execution status
e14z list --executable-only
```

### Cache Management

```bash
# List cached (auto-installed) MCPs
e14z cache list

# Clear specific MCP cache
e14z cache clear stripe

# Clear all cached MCPs
e14z cache clear --all

# Check auto-install capability
e14z cache info stripe

# Show cache statistics
e14z cache info
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

## 🤖 Auto-Installation Engine

E14Z v4.0 introduces a powerful auto-installation engine that works like `npx` for MCP servers:

### How It Works

1. **Discovery**: Run `e14z run package-name`
2. **Detection**: E14Z detects the package isn't locally available
3. **Analysis**: Security scanning and installation method detection
4. **Installation**: Automatic package installation with sandbox protection
5. **Caching**: Future runs use cached installation for speed
6. **Execution**: Seamless MCP execution

### Supported Package Managers

| Manager | Command Format | Example | Cache Location |
|---------|----------------|---------|----------------|
| **NPM** | `npx package[@version]` | `npx @types/node` | `~/.e14z/cache/` |
| **Python** | `pip install package[==version]` | `pip install requests` | `~/.e14z/cache/` |
| **Git** | `git clone url [branch]` | `git clone https://...` | `~/.e14z/cache/` |

### Security Features

- **🔒 Multi-Layer Security**: Command injection prevention, path traversal protection
- **🛡️ Threat Detection**: Typosquatting detection, malicious package database
- **🔍 Script Analysis**: Suspicious post-install script detection
- **📦 Package Verification**: Integrity checking and reputation scoring
- **🚫 Quarantine System**: Automatic isolation of suspicious packages
- **🔄 Transaction Rollback**: Automatic cleanup on installation failures

### Auto-Installation Examples

```bash
# NPM packages (with scoped support)
e14z run lodash              # → npx lodash
e14z run @types/node         # → npx @types/node
e14z run lodash@4.17.21      # → npx lodash@4.17.21

# Python packages  
e14z run requests            # → pip install requests (in isolation)
e14z run pandas==1.5.0       # → pip install pandas==1.5.0

# Git repositories
e14z run my-git-mcp          # → git clone https://github.com/...
```

## 🏗️ Architecture

E14Z v4.0 is built with a modular, security-first architecture:

### Core Components

- **🖥️ CLI Tool** (`e14z`): User-facing command interface
- **🤖 MCP Server** (`e14z`): AI agent discovery tool (same binary, different mode)
- **⚡ Enhanced Execution Engine**: Secure MCP execution with auto-installation
- **🤖 Auto-Installer**: NPX-like package installation with security scanning
- **🗄️ Secure Cache Manager**: Intelligent caching with integrity verification
- **🔐 Auth Manager**: GitHub OAuth with encrypted local storage
- **📦 Publishing System**: Full MCP lifecycle management
- **🏷️ Claiming System**: Ownership verification for wrapped MCPs

### Security Architecture

- **🛡️ Command Sanitization**: Blocks dangerous shell characters and patterns
- **🔒 Process Sandboxing**: Isolated execution environments with resource limits
- **📍 Path Traversal Protection**: Prevents `../` and similar attacks
- **🔍 Input Validation**: Comprehensive slug and command validation
- **🌍 Environment Sanitization**: Safe execution environment setup
- **🔐 Encrypted Storage**: XDG-compliant credential management
- **⚡ Transaction System**: Atomic operations with automatic rollback

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

### Keeping E14Z Updated

```bash
# Always use latest (recommended for occasional users)
npx e14z@latest discover payments

# Update global installation
npm update -g e14z

# Force update to specific version
npm install -g e14z@latest

# Check current version
e14z --version
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

E14Z v4.0 passes **21/21 comprehensive auto-installation tests**:

- ✅ **Core Functionality**: Cache management, package manager selection, command parsing
- ✅ **Security**: Command injection prevention, typosquatting detection, malicious package blocking
- ✅ **Error Handling**: Categorization, transaction rollback, retry logic
- ✅ **Cache System**: Integrity verification, cleanup policies, concurrent access
- ✅ **Performance**: Installation speed, cache hit optimization
- ✅ **Edge Cases**: Large packages, network timeouts, permission errors

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

# Disable auto-installation
e14z run <mcp-name> --no-auto-install
```

**Auto-installation issues**
```bash
# Clear corrupted cache
e14z cache clear <mcp-name>

# Check auto-install capability
e14z cache info <mcp-name>

# View cache contents
e14z cache list

# Clear all cache (nuclear option)
e14z cache clear --all
```

**Security warnings**
```bash
# Package flagged as suspicious
# Review the security warning details
# Consider using alternative packages
# Use --security-level minimal for testing (not recommended)
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