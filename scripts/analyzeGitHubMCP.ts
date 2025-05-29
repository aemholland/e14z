#!/usr/bin/env node

import { analyzeInstallationMethods } from '../lib/mcp/multiInstallationDetector'

const githubMCPContent = `
# GitHub MCP Server

The GitHub MCP Server is a Model Context Protocol (MCP) server that provides seamless integration with GitHub APIs.

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

If you don't have Docker, you can use \`go build\` to build the binary in the \`cmd/github-mcp-server\` directory, and use the \`github-mcp-server stdio\` command.

\`\`\`bash
go build cmd/github-mcp-server/main.go
./github-mcp-server stdio
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
- **add_issue_comment** - Add a comment to an issue
  - \`owner\`: Repository owner (string, required)
  - \`repo\`: Repository name (string, required)
  - \`issue_number\`: Issue number (number, required)
  - \`body\`: Comment text (string, required)

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

### Repositories

- **create_or_update_file** - Create or update a single file in a repository
  - \`owner\`: Repository owner (string, required)
  - \`repo\`: Repository name (string, required)
  - \`path\`: File path (string, required)
  - \`message\`: Commit message (string, required)
  - \`content\`: File content (string, required)
- **get_file_contents** - Get contents of a file or directory
  - \`owner\`: Repository owner (string, required)
  - \`repo\`: Repository name (string, required)
  - \`path\`: File path (string, required)

### Code Scanning

- **get_code_scanning_alert** - Get a code scanning alert
  - \`owner\`: Repository owner (string, required)
  - \`repo\`: Repository name (string, required)
  - \`alertNumber\`: Alert number (number, required)
`

function main() {
  console.log('🔍 Analyzing GitHub MCP Server...\n')
  
  const result = analyzeInstallationMethods(githubMCPContent, 'https://github.com/github/github-mcp-server')
  
  console.log('📦 Installation Methods Found:')
  result.installation_methods.forEach((method, index) => {
    console.log(`  ${index + 1}. [${method.type.toUpperCase()}] ${method.description}`)
    console.log(`     Command: ${method.command}`)
    console.log(`     Priority: ${method.priority}, Confidence: ${method.confidence}`)
    console.log('')
  })
  
  console.log('🔧 Tools Found:')
  result.tools.forEach(tool => {
    console.log(`  • ${tool.name} (${tool.category}): ${tool.description}`)
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
  
  // Show the JSON structure that would be stored
  console.log(`\n💾 Database Update Structure:`)
  console.log(JSON.stringify({
    installation_methods: result.installation_methods,
    tools: result.tools,
    primary_install_type: result.primary_install_type,
    primary_endpoint: result.primary_endpoint
  }, null, 2))
}

main()