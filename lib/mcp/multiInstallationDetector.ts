/**
 * Multi-Installation Method Detection
 * 
 * Detects ALL installation methods available for an MCP server,
 * not just the first one found. Also extracts tools information.
 */

interface InstallationMethod {
  type: 'npm' | 'pip' | 'git' | 'docker' | 'binary' | 'other'
  command: string
  description?: string
  priority: number // Lower = higher priority for display
  confidence: number
}

interface ToolInfo {
  name: string
  description?: string
  category?: string
  parameters?: string[]
}

interface MCPAnalysisResult {
  installation_methods: InstallationMethod[]
  tools: ToolInfo[]
  primary_install_type: string
  primary_endpoint: string
}

/**
 * Analyze README content to extract ALL installation methods and tools
 */
export function analyzeInstallationMethods(content: string, githubUrl?: string): MCPAnalysisResult {
  const methods: InstallationMethod[] = []
  const tools: ToolInfo[] = []
  
  // Find all installation methods
  
  // 1. NPM/NPX patterns (highest priority)
  const npmMatches = content.match(/(?:npx|npm)\s+[^\s\n]+(?:\s+[^\n]*)?/gi) || []
  npmMatches.forEach(match => {
    const cleanCommand = cleanCommand(match)
    if (cleanCommand && !isDuplicate(methods, cleanCommand)) {
      methods.push({
        type: 'npm',
        command: cleanCommand,
        description: 'Install via npm/npx',
        priority: 1,
        confidence: 0.9
      })
    }
  })
  
  // 2. Docker patterns (look for actual docker run commands in code blocks)
  const dockerMatches = content.match(/docker\s+run[^\n]*/gi) || []
  
  // Also look for docker in JSON configurations
  if (content.includes('"command": "docker"') && content.includes('ghcr.io')) {
    const dockerImageMatch = content.match(/ghcr\.io\/[^\s"]+/i)
    if (dockerImageMatch) {
      const dockerImage = dockerImageMatch[0]
      const dockerCommand = `docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN=${process.env.GITHUB_PERSONAL_ACCESS_TOKEN || 'your_token_here'} ${dockerImage}`
      methods.push({
        type: 'docker',
        command: dockerCommand,
        description: 'Run via Docker with GitHub authentication',
        priority: 2,
        confidence: 0.9
      })
    }
  }
  
  dockerMatches.forEach(match => {
    const cleanCommand = cleanCommand(match)
    if (cleanCommand && !isDuplicate(methods, cleanCommand)) {
      methods.push({
        type: 'docker',
        command: cleanCommand,
        description: 'Run via Docker',
        priority: 2,
        confidence: 0.9
      })
    }
  })
  
  // 3. Python/UV patterns  
  const pythonMatches = content.match(/(?:uvx|uv\s+run|pip\s+install|poetry\s+install)[^\n]*/gi) || []
  pythonMatches.forEach(match => {
    const cleanCommand = cleanCommand(match)
    if (cleanCommand && !isDuplicate(methods, cleanCommand)) {
      methods.push({
        type: 'pip',
        command: cleanCommand,
        description: 'Install via Python package manager',
        priority: 3,
        confidence: 0.85
      })
    }
  })
  
  // 4. Git clone patterns
  const gitMatches = content.match(/git\s+clone[^\n]*/gi) || []
  gitMatches.forEach(match => {
    let gitCommand = cleanCommand(match)
    if (gitCommand) {
      // Look for setup commands after git clone
      const setupCommands = extractSetupCommands(content, match)
      if (setupCommands.length > 0) {
        gitCommand += ' && ' + setupCommands.join(' && ')
      }
      
      if (!isDuplicate(methods, gitCommand)) {
        methods.push({
          type: 'git',
          command: gitCommand,
          description: 'Clone and build from source',
          priority: 4,
          confidence: 0.8
        })
      }
    }
  })
  
  // 5. Build from source patterns
  const buildMatches = content.match(/(?:go\s+build|cargo\s+build|make\s+build|npm\s+run\s+build)[^\n]*/gi) || []
  buildMatches.forEach(match => {
    const cleanCmd = cleanCommand(match)
    if (cleanCmd && !isDuplicate(methods, cleanCmd)) {
      // If we have git clone, combine them
      const hasGitClone = methods.some(m => m.type === 'git')
      if (!hasGitClone && githubUrl) {
        const repoName = githubUrl.split('/').pop() || 'repo'
        const fullCommand = `git clone ${githubUrl} && cd ${repoName} && ${cleanCmd}`
        methods.push({
          type: 'git',
          command: fullCommand,
          description: 'Build from source',
          priority: 4,
          confidence: 0.7
        })
      }
    }
  })
  
  // Special case: look for "Build from source" sections
  if (content.toLowerCase().includes('build from source') && githubUrl) {
    const buildSection = content.match(/### Build from source[\s\S]*?(?=\n###|\n##|\n#\s|$)/i)
    if (buildSection) {
      const sectionContent = buildSection[0]
      const goBuildMatch = sectionContent.match(/go\s+build[^\n]*/i)
      if (goBuildMatch) {
        const repoName = githubUrl.split('/').pop() || 'repo'
        const fullCommand = `git clone ${githubUrl} && cd ${repoName} && ${cleanCommand(goBuildMatch[0])}`
        methods.push({
          type: 'git',
          command: fullCommand,
          description: 'Build from source',
          priority: 4,
          confidence: 0.8
        })
      }
    }
  }
  
  // 6. Binary download patterns
  const binaryMatches = content.match(/(?:curl|wget)[^\n]*(?:install|\.sh)[^\n]*/gi) || []
  binaryMatches.forEach(match => {
    const cleanCommand = cleanCommand(match)
    if (cleanCommand && !isDuplicate(methods, cleanCommand)) {
      methods.push({
        type: 'binary',
        command: cleanCommand,
        description: 'Install via script',
        priority: 5,
        confidence: 0.75
      })
    }
  })
  
  // Extract tools information
  const extractedTools = extractToolsFromContent(content)
  tools.push(...extractedTools)
  
  // Sort methods by priority
  methods.sort((a, b) => a.priority - b.priority)
  
  // Determine primary method (highest priority with good confidence)
  const primaryMethod = methods.find(m => m.confidence > 0.7) || methods[0]
  
  return {
    installation_methods: methods,
    tools,
    primary_install_type: primaryMethod?.type || 'other',
    primary_endpoint: primaryMethod?.command || 'See GitHub repository for installation instructions'
  }
}

/**
 * Extract setup commands that follow git clone
 */
function extractSetupCommands(content: string, gitCloneMatch: string): string[] {
  const lines = content.split('\n')
  const gitIndex = lines.findIndex(line => 
    line.toLowerCase().includes('git clone') && 
    line.includes(gitCloneMatch.toLowerCase())
  )
  
  if (gitIndex === -1) return []
  
  const setupCommands: string[] = []
  for (let i = gitIndex + 1; i < Math.min(gitIndex + 5, lines.length); i++) {
    const line = lines[i].trim()
    if (line.startsWith('cd ') || 
        line.includes('npm install') || 
        line.includes('pip install') ||
        line.includes('uv ') ||
        line.includes('python ') ||
        line.includes('go build') ||
        line.includes('make ') ||
        line.includes('cargo ') ||
        line.includes('./') ||
        line.includes('npm run') ||
        line.includes('node ')) {
      setupCommands.push(cleanCommand(line))
    } else if (line && !line.startsWith('#') && !line.startsWith('```') && !line.startsWith('`')) {
      break // Stop at first non-setup line
    }
  }
  
  return setupCommands.filter(cmd => cmd.length > 0)
}

/**
 * Extract tools information from README content
 */
function extractToolsFromContent(content: string): ToolInfo[] {
  const tools: ToolInfo[] = []
  
  // Look for tools sections - be more flexible with patterns
  const toolSectionPatterns = [
    /## Tools?\s*\n([\s\S]*?)(?=\n##|\n#\s|$)/gi,
    /### Tools?\s*\n([\s\S]*?)(?=\n###|\n##|\n#\s|$)/gi,
    /## Available Tools?\s*\n([\s\S]*?)(?=\n##|\n#\s|$)/gi,
    /## Features?\s*\n([\s\S]*?)(?=\n##|\n#\s|$)/gi
  ]
  
  for (const pattern of toolSectionPatterns) {
    let match
    const regex = new RegExp(pattern.source, pattern.flags)
    while ((match = regex.exec(content)) !== null) {
      const extractedTools = parseToolsFromSection(match[1])
      tools.push(...extractedTools)
    }
  }
  
  // Look for specific subsections like "Issues", "Pull Requests", etc.
  const subsectionPatterns = [
    /### (Issues?|Pull Requests?|Repositories?|Users?|Code Scanning|Secret Scanning|Notifications?)\s*\n([\s\S]*?)(?=\n###|\n##|\n#\s|$)/gi
  ]
  
  for (const pattern of subsectionPatterns) {
    let match
    const regex = new RegExp(pattern.source, pattern.flags)
    while ((match = regex.exec(content)) !== null) {
      const category = match[1]
      const sectionContent = match[2]
      const extractedTools = parseToolsFromSection(sectionContent, category)
      tools.push(...extractedTools)
    }
  }
  
  // Look for function/method patterns like get_issue, create_branch, etc.
  const functionPatterns = content.match(/[-*]\s*\*\*([a-z_]+(?:_[a-z]+)*)\*\*\s*[-–]\s*([^\n]+)/gi) || []
  functionPatterns.forEach(match => {
    const matchResult = match.match(/[-*]\s*\*\*([a-z_]+(?:_[a-z]+)*)\*\*\s*[-–]\s*([^\n]+)/i)
    if (matchResult) {
      const [, name, description] = matchResult
      if (name && description && !tools.some(t => t.name === name)) {
        tools.push({
          name: name.trim(),
          description: description.trim(),
          category: 'function'
        })
      }
    }
  })
  
  return tools
}

/**
 * Parse tools from a specific section of content
 */
function parseToolsFromSection(sectionContent: string, category?: string): ToolInfo[] {
  const tools: ToolInfo[] = []
  const lines = sectionContent.split('\n')
  
  let currentTool: Partial<ToolInfo> | null = null
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Tool name patterns: - **tool_name** - description
    const toolNameMatch = trimmed.match(/^[-*]\s*\*\*([a-z_][a-z0-9_]*)\*\*\s*[-–]\s*(.+)/i)
    if (toolNameMatch) {
      // Save previous tool
      if (currentTool?.name) {
        tools.push(currentTool as ToolInfo)
      }
      
      currentTool = {
        name: toolNameMatch[1].trim(),
        description: toolNameMatch[2].trim(),
        category: category || 'tool',
        parameters: []
      }
    }
    // Parameter patterns: - `param`: description
    else if (currentTool && trimmed.match(/^\s*[-*]\s*[`"](\w+)[`"]\s*[:(].*?[)]?\s*:?\s*(.+)/)) {
      const paramMatch = trimmed.match(/^\s*[-*]\s*[`"](\w+)[`"]\s*[:(].*?[)]?\s*:?\s*(.+)/)
      if (paramMatch && currentTool.parameters) {
        currentTool.parameters.push(paramMatch[1])
      }
    }
  }
  
  // Save last tool
  if (currentTool?.name) {
    tools.push(currentTool as ToolInfo)
  }
  
  return tools
}

/**
 * Clean and normalize commands
 */
function cleanCommand(command: string): string {
  return command
    .replace(/```[a-z]*\n?/g, '')
    .replace(/^[\$>]\s*/gm, '')
    // Fix common parameter concatenation issues
    .replace(/([a-zA-Z0-9])(-[a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--[a-zA-Z])/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(-e\s+)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(-p\s+)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(-v\s+)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(-i)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(--rm)/g, '$1 $2')
    .replace(/([a-zA-Z0-9])(@[a-zA-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if command is already in methods array
 */
function isDuplicate(methods: InstallationMethod[], command: string): boolean {
  return methods.some(m => m.command === command)
}

export { InstallationMethod, ToolInfo, MCPAnalysisResult }