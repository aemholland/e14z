# E14Z v3.0.1 - Unified Binary 🔄

## ✨ What's New in v3.0.1

### 🚀 **Simplified Binary Architecture**
- **Unified Command**: `e14z` now serves both CLI and MCP server functions
- **Smart Context Detection**: Automatically detects whether to run as CLI tool or MCP server
- **Simplified Configuration**: Same command for users and AI agents

**Updated Claude Desktop Config:**
```json
{
  "mcps": {
    "e14z": {
      "command": "e14z"
    }
  }
}
```

The same `e14z` binary intelligently switches modes:
- **CLI Mode**: When run with arguments or in a TTY (interactive terminal)
- **MCP Server Mode**: When used via stdin from AI agents

---

# E14Z v3.0.0 - "The npm for AI Agents" 🚀

## 🎉 Major Release: Complete Platform Transformation

E14Z has evolved from a simple discovery platform into **the definitive execution and publishing platform for MCP servers**. Think "npm for AI agents" - a complete ecosystem for discovering, running, and publishing AI tools.

---

## ✨ What's New in v3.0.0

### 🏃 **Direct Execution Platform**
```bash
# Run any MCP instantly with security checks
e14z run stripe
e14z run github
e14z run notion
```

- **Secure Execution**: CVE-2024-27980 mitigations and input validation
- **Smart Authentication**: Automatic detection of auth requirements with setup guidance
- **Safety First**: Command injection and path traversal protection

### 📦 **Publishing System**
```bash
# Publish your MCP to the registry
e14z auth login
e14z publish new my-awesome-mcp
e14z publish list
```

- **GitHub Integration**: OAuth authentication and verification
- **Interactive Publishing**: Step-by-step MCP creation wizard
- **Package Templates**: Standardized MCP package generation
- **Validation System**: Comprehensive package validation before publishing

### 🏷️ **Claiming System**
```bash
# Claim ownership of wrapped MCPs you actually own
e14z claim list
e14z claim mcp stripe
```

- **Ownership Verification**: Automatic GitHub repository and npm package verification
- **Auto-Approval**: Instant approval for verified owners
- **Developer Rights**: Full publishing control for claimed MCPs

### 🔐 **Advanced Authentication**
- **GitHub OAuth**: Secure device flow authentication
- **Encrypted Storage**: XDG-compliant local credential management  
- **Smart Detection**: Automatic identification of API keys, OAuth, credentials needed
- **Setup Guidance**: Clear instructions for required authentication

---

## 🏗️ Architecture Transformation

### **Unified Binary Architecture**
- **`e14z`** - Smart unified binary that auto-detects CLI vs MCP server mode
- **Context Detection** - Same command works for users and AI agents
- **Modular Libraries** - Auth, execution, publishing, claiming modules

### **Enhanced Database**
- **Users Table**: GitHub integration and publishing permissions
- **Claims Table**: Ownership verification and tracking system
- **Enhanced MCPs**: Execution commands and standardized authentication

### **Security Framework**
- **Input Validation**: Comprehensive slug and command validation
- **Command Injection Prevention**: Blocks dangerous shell characters
- **Path Traversal Protection**: Prevents `../` and similar attacks
- **Environment Sanitization**: Safe execution environment

---

## 🔧 Complete Command Reference

### **Discovery & Execution**
```bash
e14z discover payments --verified    # Enhanced discovery with filters
e14z info stripe                     # Detailed MCP info with auth requirements
e14z run stripe                      # Secure direct execution
e14z list --executable-only         # Show only runnable MCPs
e14z diagnose                        # System health check
```

### **Publishing & Management**
```bash
e14z auth login                      # GitHub authentication
e14z auth status                     # Check auth status
e14z publish new my-mcp              # Interactive MCP publishing
e14z publish template my-mcp         # Generate package template
e14z publish list                    # Your published MCPs with stats
e14z publish update my-mcp           # Update existing MCP
```

### **Claiming & Ownership**
```bash
e14z claim list                      # Available MCPs to claim
e14z claim mcp package-name          # Claim with automatic verification
e14z claim status                    # Check your claim status
```

---

## 🛡️ Security & Testing

### **24/24 Tests Passing (100% Success Rate)**
- ✅ **Security Validation**: Command injection and path traversal prevention
- ✅ **Auto-Wrapping**: NPM/Python package command generation
- ✅ **Core Functionality**: End-to-end workflow validation
- ✅ **Component Integration**: All modules working together seamlessly

### **Security Features**
- **CVE-2024-27980 Mitigations**: Protection against Node.js command injection
- **Input Sanitization**: All user inputs validated and sanitized
- **Secure Defaults**: Safe-by-default execution mode
- **Audit Trail**: All actions logged and traceable

---

## 🚀 Migration from v2.x

### **Breaking Changes**
- **CLI Command**: Changed from `npx e14z` to `e14z` (install globally)
- **MCP Server**: Now uses unified `e14z` binary with auto-detection
- **Authentication**: New GitHub-based auth system for publishing

### **Migration Steps**
```bash
# 1. Install globally
npm install -g e14z

# 2. Test functionality
e14z discover payments

# 3. Authenticate for publishing (optional)
e14z auth login

# 4. Update Claude Desktop config
{
  "mcps": {
    "e14z": {
      "command": "e14z"  // Unified binary auto-detects MCP server mode
    }
  }
}
```

### **Backward Compatibility**
✅ All existing MCP server functionality preserved  
✅ All discovery tools remain available  
✅ API endpoints unchanged  
✅ Existing integrations continue working  

---

## 📦 Installation & Usage

### **Quick Start**
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

### **For AI Agents (Claude Desktop)**
```json
{
  "mcps": {
    "e14z": {
      "command": "e14z"
    }
  }
}
```

---

## 🌟 What This Means for You

### **For Developers**
- **Publish MCPs**: Share your tools with the community via GitHub integration
- **Claim Ownership**: Take control of wrapped versions of your MCPs
- **Professional Workflow**: Complete MCP lifecycle management

### **For Users** 
- **Instant Execution**: Run any MCP directly without setup complexity
- **Smart Auth**: Automatic detection and guidance for required authentication
- **Comprehensive Discovery**: 50+ MCPs across 16 categories

### **For AI Agents**
- **Enhanced Discovery**: Same powerful discovery tools with improved examples
- **Execution Guidance**: Direct execution commands in discovery results
- **Quality Indicators**: Authentication status and execution compatibility

---

## 🔗 Resources

- **NPM Package**: [npmjs.com/package/e14z](https://npmjs.com/package/e14z)
- **GitHub Repository**: [github.com/aemholland/e14z](https://github.com/aemholland/e14z)
- **Documentation**: [e14z.com/docs](https://e14z.com/docs)
- **Registry**: [e14z.com/browse](https://e14z.com/browse)

---

## 🙏 Thank You

This massive transformation represents months of development to create the definitive platform for the MCP ecosystem. E14Z v3.0.0 establishes the foundation for how developers will discover, execute, and publish AI agent tools.

**Welcome to the future of AI agent tooling!** 🤖✨

---

*E14Z v3.0.0 - Built for the AI-powered future*