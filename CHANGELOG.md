# Changelog

All notable changes to E14Z will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2025-01-06

### 🧠 Major Release: "Comprehensive Intelligence System"

This release introduces **comprehensive MCP intelligence collection**, providing real-world performance data, tool testing results, and operational health monitoring for all MCPs in the registry.

### ✨ Added

#### 🧠 **Comprehensive Intelligence Collection**
- **12 Intelligence Categories**: Tools, performance, auth, resources, errors, business value, quality scores
- **Real Tool Testing**: Actual execution and validation of MCP tools
- **Performance Metrics**: Initialization time, response times, reliability scores
- **Health Monitoring**: Four-state health system (healthy/degraded/down/unknown)
- **Multi-Package Support**: npm, pipx (Python), cargo (Rust), go install

#### 🏗️ **Production Infrastructure**
- **Resilience Patterns**: Circuit breakers, rate limiting, connection pooling
- **Error Recovery**: Retry logic with exponential backoff
- **Database Optimization**: Connection pooling, query optimization
- **Production Safeguards**: Resource limits, timeout protection
- **Fallback Strategies**: Basic intelligence when comprehensive testing fails

#### 📊 **Enhanced API Responses**
- **Tool Intelligence**: Working/failing tool counts and execution results
- **Performance Data**: Real response times from actual testing
- **Auth Intelligence**: Detected requirements and setup complexity
- **Quality Scores**: Documentation quality, user experience ratings
- **Resource Discovery**: Available resources and prompt templates

### 🔄 Changed
- **Health Status Logic**: Improved to not penalize zero-tool or auth-required MCPs
- **API Response Format**: Now includes comprehensive intelligence fields
- **Database Schema**: Enhanced with 50+ intelligence-related columns
- **Discovery Algorithm**: Incorporates real performance data in ranking

### 🐛 Fixed
- **Tool Count Pipeline**: Fixed data flow from collection to storage
- **Health Assessment**: Proper handling of auth-required and zero-tool MCPs
- **Database Mapping**: Aligned field names with Supabase schema
- **NPM Discovery**: Parallelized for 70% performance improvement

## [3.0.0] - 2025-01-06

### 🚀 Major Release: "The npm for AI Agents"

This is a **complete transformation** of E14Z from a discovery platform into a full execution and publishing platform for MCPs.

### ✨ Added

#### 🏃 **Direct Execution Platform**
- **CLI Tool**: New `e14z` command-line interface
- **Secure Execution**: Run MCPs directly with `e14z run <name>`
- **Authentication Detection**: Automatic detection of auth requirements
- **Security First**: CVE-2024-27980 mitigations and input validation
- **Command Validation**: Prevents path traversal and injection attacks

#### 🔐 **Authentication System**
- **GitHub OAuth**: Device flow authentication for CLI
- **Encrypted Storage**: XDG-compliant local credential management
- **Auth Detection**: Smart detection of API keys, OAuth, credentials
- **Setup Guidance**: Automatic instructions for required authentication

#### 📦 **Publishing System**
- **MCP Publishing**: Publish MCPs to registry with GitHub integration
- **Package Templates**: Generate standardized MCP packages
- **Validation System**: Comprehensive package validation
- **Verification Process**: Review system for published MCPs
- **Interactive Publishing**: Step-by-step MCP creation wizard

#### 🏷️ **Claiming System**
- **Ownership Claims**: Claim wrapped MCPs you actually own
- **GitHub Verification**: Automatic verification via repository access
- **NPM Verification**: Verify ownership through package maintainer status
- **Auto-Approval**: Instant approval for verified ownership

#### 🤖 **Auto-Wrapping System**
- **NPM Packages**: Automatic `npm install` → `npx` conversion
- **Python Packages**: `pip install` → `uvx` conversion
- **Command Generation**: Smart extraction from various sources
- **Quality Scoring**: Algorithmic assessment of MCP quality

### 🏗️ **Architecture Changes**

#### **Separated Components**
- **CLI Tool** (`bin/cli.js`): User-facing command interface
- **MCP Server** (`bin/mcp-server.js`): AI agent discovery tool
- **Modular Libraries**: Auth, execution, publishing, claiming modules

#### **Database Enhancements**
- **Users Table**: GitHub integration and publishing permissions
- **Claims Table**: Ownership verification and tracking
- **Enhanced MCPs**: Execution commands and auth standardization

#### **Security Framework**
- **Input Validation**: Comprehensive slug and command validation
- **Command Injection Prevention**: Blocks dangerous shell characters
- **Path Traversal Protection**: Prevents `../` and similar attacks
- **Environment Sanitization**: Safe execution environment

### 🔧 **Enhanced Commands**

#### **Discovery & Execution**
```bash
e14z discover payments --verified    # Enhanced discovery with filters
e14z info stripe                     # Detailed MCP information with auth
e14z run stripe                      # Direct execution with security
e14z list --executable-only         # Show runnable MCPs
```

#### **Publishing & Management**
```bash
e14z auth login                      # GitHub authentication
e14z publish new my-mcp              # Interactive MCP publishing
e14z publish template my-mcp         # Generate package template
e14z publish list                    # Your published MCPs
```

#### **Claiming & Ownership**
```bash
e14z claim list                      # Available MCPs to claim
e14z claim mcp package-name          # Claim with verification
e14z claim status                    # Check claim status
```

### 🧪 **Testing & Quality**
- **24/24 Tests Passing**: Comprehensive test suite
- **Security Validation**: Command injection and path traversal tests
- **Auto-Wrapping Tests**: NPM/Python package conversion tests
- **Core Functionality**: End-to-end workflow validation
- **CI/CD Ready**: Production-ready with full test coverage

### 📚 **Documentation**
- **Complete README**: Full documentation for all features
- **Usage Examples**: Comprehensive command examples
- **Security Guide**: Security features and best practices
- **Developer Guide**: Publishing and claiming workflows
- **Troubleshooting**: Common issues and solutions

### 🔄 **Migration from v2.x**

**Breaking Changes:**
- Main CLI command changed from `npx e14z` to `e14z` (install globally)
- MCP server now available as `e14z-mcp` 
- New authentication system (requires `e14z auth login` for publishing)

**Backward Compatibility:**
- Existing MCP server functionality preserved
- All discovery tools remain available
- API endpoints unchanged

### 🛡️ **Security Improvements**
- **CVE-2024-27980**: Mitigations for Node.js command injection
- **Input Sanitization**: All user inputs validated
- **Secure Defaults**: Safe-by-default execution mode
- **Audit Trail**: All actions logged and traceable

## [2.0.7] - 2024-12-XX

### Fixed
- Multi-word search query issues
- Review system optimization for agents
- Category alignment between examples and database

### Changed
- Enhanced structured review system
- Improved agent discoverability
- Updated MCP server to v2.0.7

## [2.0.0] - 2024-11-XX

### Added
- Initial MCP server implementation
- Discovery tools for AI agents
- Review and rating system
- 50+ MCP server registry

### Features
- `discover` tool for finding MCPs
- `details` tool for MCP information
- `review` tool for feedback submission

---

## Release Notes

### v3.0.0 Summary

E14Z v3.0.0 represents a complete evolution from a discovery platform to "the npm for AI agents." This major release adds direct execution, publishing, and claiming capabilities while maintaining all existing discovery functionality.

**Key Benefits:**
- **Developers**: Publish and manage MCPs with GitHub integration
- **Users**: Run MCPs directly with authentication guidance
- **Security**: Enterprise-grade security with comprehensive validation
- **Ecosystem**: Complete MCP lifecycle management platform

This release positions E14Z as the definitive platform for the MCP ecosystem, providing everything needed to discover, execute, publish, and manage AI agent tools.