#!/usr/bin/env node

/**
 * Test Multi-Installation Detection
 */

import { analyzeInstallationMethods } from '../lib/mcp/multiInstallationDetector'

// Test with GitHub MCP content
const githubMCPContent = `
# GitHub MCP Server

## Installation

### Usage with VS Code

\`\`\`json
{
  "mcp": {
    "servers": {
      "github": {
        "command": "docker",
        "args": [
          "run",
          "-i",
          "--rm",
          "-e",
          "GITHUB_PERSONAL_ACCESS_TOKEN",
          "ghcr.io/github/github-mcp-server"
        ]
      }
    }
  }
}
\`\`\`

### Usage with Claude Desktop

\`\`\`json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i", 
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ]
    }
  }
}
\`\`\`

### Build from source

If you don't have Docker, you can use \`go build\` to build the binary in the
\`cmd/github-mcp-server\` directory, and use the \`github-mcp-server stdio\` command with the \`GITHUB_PERSONAL_ACCESS_TOKEN\` environment variable set to your token.

\`\`\`bash
go build cmd/github-mcp-server/main.go
./github-mcp-server stdio
\`\`\`

For example:

\`\`\`json
{
  "mcp": {
    "servers": {
      "github": {
        "command": "/path/to/github-mcp-server",
        "args": ["stdio"],
        "env": {
          "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
        }
      }
    }
  }
}
\`\`\`

## Tools

### Users

- **get_me** - Get details of the authenticated user
  - No parameters required

### Issues

- **get_issue** - Gets the contents of an issue within a repository
  - \`owner\`: Repository owner (string, required)
  - \`repo\`: Repository name (string, required) 
  - \`issue_number\`: Issue number (number, required)

- **create_issue** - Create a new issue in a GitHub repository
  - \`owner\`: Repository owner (string, required)
  - \`repo\`: Repository name (string, required)
  - \`title\`: Issue title (string, required)
  - \`body\`: Issue body content (string, optional)

### Pull Requests

- **get_pull_request** - Get details of a specific pull request
  - \`owner\`: Repository owner (string, required)
  - \`repo\`: Repository name (string, required)
  - \`pullNumber\`: Pull request number (number, required)

- **create_pull_request** - Create a new pull request
  - \`owner\`: Repository owner (string, required)
  - \`repo\`: Repository name (string, required)
  - \`title\`: PR title (string, required)
  - \`head\`: Branch containing changes (string, required)
  - \`base\`: Branch to merge into (string, required)
`

function main() {
  console.log('🧪 Testing Multi-Installation Detection\n')
  
  const result = analyzeInstallationMethods(githubMCPContent, 'https://github.com/github/github-mcp-server')
  
  console.log('📦 Installation Methods Found:')
  result.installation_methods.forEach((method, index) => {
    console.log(`  ${index + 1}. [${method.type.toUpperCase()}] ${method.description}`)
    console.log(`     Command: ${method.command}`)
    console.log(`     Confidence: ${method.confidence}`)
    console.log('')
  })
  
  console.log('🔧 Tools Found:')
  result.tools.forEach(tool => {
    console.log(`  • ${tool.name}: ${tool.description}`)
    if (tool.parameters && tool.parameters.length > 0) {
      console.log(`    Parameters: ${tool.parameters.join(', ')}`)
    }
  })
  
  console.log(`\n🎯 Primary Installation:`)
  console.log(`  Type: ${result.primary_install_type}`)
  console.log(`  Command: ${result.primary_endpoint}`)
  
  console.log(`\n📊 Summary:`)
  console.log(`  Installation methods: ${result.installation_methods.length}`)
  console.log(`  Tools detected: ${result.tools.length}`)
}

main()