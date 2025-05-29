/**
 * Installation Method Detection
 * 
 * Analyzes GitHub repository content to detect the proper installation method
 * and extract the exact command needed to run the MCP server
 */

interface InstallationInfo {
  install_type: 'npm' | 'pip' | 'git' | 'docker' | 'binary' | 'other'
  endpoint: string
  confidence: number
}

/**
 * Detect installation method and extract command from README content
 */
export function detectInstallationMethod(content: string, githubUrl?: string): InstallationInfo {
  const lines = content.toLowerCase().split('\n')
  const originalLines = content.split('\n')
  
  // Look for installation patterns in order of confidence
  
  // 1. Git clone patterns (check first as they're most definitive)
  const gitPatterns = [
    /git\s+clone[^\n]*/g
  ]
  
  for (const pattern of gitPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      let command = matches[0].trim()
      
      // Look for additional setup commands after clone
      const gitIndex = originalLines.findIndex(line => 
        line.toLowerCase().includes('git clone')
      )
      
      if (gitIndex !== -1) {
        // Look for next few lines for setup commands
        const setupCommands = []
        for (let i = gitIndex + 1; i < Math.min(gitIndex + 5, originalLines.length); i++) {
          const line = originalLines[i].trim()
          if (line.startsWith('cd ') || 
              line.includes('npm install') || 
              line.includes('pip install') ||
              line.includes('python ') ||
              line.includes('make ') ||
              line.includes('./') ||
              line.includes('npm run') ||
              line.includes('node ')) {
            setupCommands.push(line)
          } else if (line && !line.startsWith('#') && !line.startsWith('```') && !line.startsWith('`')) {
            break // Stop at first non-setup line
          }
        }
        
        if (setupCommands.length > 0) {
          command = `${command} && ${setupCommands.join(' && ')}`
        }
      }
      
      return {
        install_type: 'git',
        endpoint: command,
        confidence: 0.9 // High confidence for git clone
      }
    }
  }
  
  // 2. NPM/NPX patterns 
  const npmPatterns = [
    /npx\s+[@\w\-\/]+/g,
    /npm\s+install.*[@\w\-\/]+/g,
    /npm\s+run\s+\w+/g
  ]
  
  for (const pattern of npmPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      const command = matches[0].trim()
      return {
        install_type: 'npm',
        endpoint: command,
        confidence: 0.85
      }
    }
  }
  
  // 2. Docker patterns
  const dockerPatterns = [
    /docker\s+run[^\n]*/g,
    /docker\s+build[^\n]*/g,
    /docker-compose[^\n]*/g
  ]
  
  for (const pattern of dockerPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      const command = matches[0].trim()
      return {
        install_type: 'docker',
        endpoint: command,
        confidence: 0.85
      }
    }
  }
  
  // 3. Python/pip patterns
  const pipPatterns = [
    /pip\s+install[^\n]*/g,
    /poetry\s+install[^\n]*/g,
    /uvx\s+[\w\-]+/g,
    /uv\s+run[^\n]*/g,
    /python[^\n]*\.py/g
  ]
  
  for (const pattern of pipPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      let command = matches[0].trim()
      
      // For uvx/uv commands, they're often Python-based
      if (command.includes('uvx') || command.includes('uv run')) {
        return {
          install_type: 'pip',
          endpoint: command,
          confidence: 0.8
        }
      }
      
      // For python commands, might need to include setup
      if (command.includes('python') && githubUrl) {
        const repoName = githubUrl.split('/').pop() || 'repo'
        command = `git clone ${githubUrl} && cd ${repoName} && ${command}`
      }
      
      return {
        install_type: 'pip',
        endpoint: command,
        confidence: 0.8
      }
    }
  }
  
  
  // 5. Binary download patterns
  const binaryPatterns = [
    /curl[^\n]*install[^\n]*/g,
    /wget[^\n]*install[^\n]*/g,
    /curl[^\n]*\.sh/g,
    /wget[^\n]*\.sh/g
  ]
  
  for (const pattern of binaryPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      const command = matches[0].trim()
      return {
        install_type: 'binary',
        endpoint: command,
        confidence: 0.7
      }
    }
  }
  
  // 6. Fallback: try to construct from GitHub URL
  if (githubUrl) {
    const repoName = githubUrl.split('/').pop() || 'repo'
    
    // Check for common patterns in the content
    if (content.includes('package.json') || content.includes('npm')) {
      return {
        install_type: 'npm',
        endpoint: `git clone ${githubUrl} && cd ${repoName} && npm install && npm start`,
        confidence: 0.5
      }
    }
    
    if (content.includes('requirements.txt') || content.includes('setup.py') || content.includes('pyproject.toml')) {
      return {
        install_type: 'pip',
        endpoint: `git clone ${githubUrl} && cd ${repoName} && pip install -r requirements.txt && python server.py`,
        confidence: 0.5
      }
    }
    
    if (content.includes('dockerfile') || content.includes('docker')) {
      return {
        install_type: 'docker',
        endpoint: `git clone ${githubUrl} && cd ${repoName} && docker build -t ${repoName} . && docker run ${repoName}`,
        confidence: 0.4
      }
    }
    
    // Generic git clone
    return {
      install_type: 'git',
      endpoint: `git clone ${githubUrl} && cd ${repoName}`,
      confidence: 0.3
    }
  }
  
  // 7. Last resort
  return {
    install_type: 'other',
    endpoint: 'See GitHub repository for installation instructions',
    confidence: 0.1
  }
}

/**
 * Extract installation command from specific sections of README
 */
export function extractInstallationFromSection(content: string, githubUrl?: string): InstallationInfo {
  const sections = [
    'installation',
    'install',
    'getting started',
    'setup',
    'quickstart',
    'usage'
  ]
  
  // Split content into sections
  const lines = content.split('\n')
  let bestResult: InstallationInfo | null = null
  
  for (const section of sections) {
    const sectionStart = lines.findIndex(line => 
      line.toLowerCase().includes(section) && 
      (line.startsWith('#') || line.startsWith('##'))
    )
    
    if (sectionStart !== -1) {
      // Extract content from this section
      let sectionEnd = lines.length
      for (let i = sectionStart + 1; i < lines.length; i++) {
        if (lines[i].startsWith('#') && !lines[i].startsWith('###')) {
          sectionEnd = i
          break
        }
      }
      
      const sectionContent = lines.slice(sectionStart, sectionEnd).join('\n')
      const result = detectInstallationMethod(sectionContent, githubUrl)
      
      if (!bestResult || result.confidence > bestResult.confidence) {
        bestResult = result
      }
    }
  }
  
  return bestResult || detectInstallationMethod(content, githubUrl)
}

/**
 * Clean and validate the extracted command
 */
export function cleanInstallationCommand(command: string, installType: string): string {
  // Remove markdown code block markers
  command = command.replace(/```[a-z]*\n?/g, '').trim()
  
  // Remove $ or > prompts
  command = command.replace(/^[\$>]\s*/gm, '')
  
  // Clean up extra whitespace
  command = command.replace(/\s+/g, ' ').trim()
  
  // Ensure reasonable length (prevent extremely long commands)
  if (command.length > 500) {
    command = command.substring(0, 500) + '...'
  }
  
  return command
}