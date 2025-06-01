/**
 * E14Z Auto-Wrapping Processor - Automatically generate clean commands for new MCPs
 */

class AutoWrappingProcessor {
  constructor() {
    this.commonPatterns = [
      // NPM packages
      { pattern: /^npm install -g (.+)$/, template: 'npx $1' },
      { pattern: /^npm install (.+)$/, template: 'npx $1' },
      { pattern: /^npx (.+)$/, template: 'npx $1' },
      
      // Python packages
      { pattern: /^pip install (.+)$/, template: 'uvx $1' },
      { pattern: /^uv add (.+)$/, template: 'uvx $1' },
      { pattern: /^python -m (.+)$/, template: 'python -m $1' },
      
      // Direct commands
      { pattern: /^([a-zA-Z][a-zA-Z0-9_-]+)$/, template: '$1' },
      
      // GitHub repos
      { pattern: /^git clone .+\/([^\/]+)\.git$/, template: 'git clone && cd $1 && npm start' },
      
      // Docker
      { pattern: /^docker run (.+)$/, template: 'docker run $1' },
      
      // Node scripts
      { pattern: /^node (.+)$/, template: 'node $1' }
    ];
  }

  /**
   * Generate clean command from endpoint
   */
  generateCleanCommand(endpoint, metadata = {}) {
    if (!endpoint || typeof endpoint !== 'string') {
      return null;
    }

    const cleaned = endpoint.trim();
    
    // Try pattern matching
    for (const { pattern, template } of this.commonPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        return template.replace(/\$(\d+)/g, (_, num) => match[parseInt(num)] || '');
      }
    }

    // Try to extract package name for npm/python
    if (cleaned.includes('npm') && cleaned.includes('install')) {
      const packageMatch = cleaned.match(/install\s+(?:-g\s+)?([^\s]+)/);
      if (packageMatch) {
        return `npx ${packageMatch[1]}`;
      }
    }

    if (cleaned.includes('pip') && cleaned.includes('install')) {
      const packageMatch = cleaned.match(/install\s+([^\s]+)/);
      if (packageMatch) {
        return `uvx ${packageMatch[1]}`;
      }
    }

    // Use GitHub repo name if available
    if (metadata.github_url) {
      const repoMatch = metadata.github_url.match(/github\.com\/[^\/]+\/([^\/]+)/);
      if (repoMatch) {
        const repoName = repoMatch[1].replace(/\.git$/, '');
        
        // Common patterns based on repo name
        if (repoName.startsWith('mcp-')) {
          return `npx ${repoName}`;
        }
        
        return repoName.toLowerCase();
      }
    }

    // Fallback: return original if it looks like a simple command
    if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cleaned)) {
      return cleaned;
    }

    return null;
  }

  /**
   * Detect authentication method from various sources
   */
  detectAuthMethod(mcp) {
    const searchTexts = [
      mcp.description || '',
      mcp.endpoint || '',
      ...(mcp.use_cases || []),
      ...(mcp.tags || [])
    ].map(text => text.toLowerCase()).join(' ');

    // OAuth indicators
    if (searchTexts.includes('oauth') || 
        searchTexts.includes('authorization code') ||
        searchTexts.includes('auth flow')) {
      return 'oauth';
    }

    // API key indicators
    if (searchTexts.includes('api key') || 
        searchTexts.includes('api_key') ||
        searchTexts.includes('access token') ||
        searchTexts.includes('bearer token') ||
        searchTexts.includes('secret key')) {
      return 'api_key';
    }

    // Credentials indicators
    if (searchTexts.includes('username') || 
        searchTexts.includes('password') ||
        searchTexts.includes('credentials') ||
        searchTexts.includes('connection string') ||
        searchTexts.includes('database url')) {
      return 'credentials';
    }

    // No auth indicators
    if (searchTexts.includes('no auth') || 
        searchTexts.includes('no authentication') ||
        searchTexts.includes('anonymous') ||
        searchTexts.includes('public')) {
      return 'none';
    }

    // Default to none if unclear
    return 'none';
  }

  /**
   * Process newly scraped MCP for auto-wrapping
   */
  processNewMCP(mcpData) {
    const cleanCommand = this.generateCleanCommand(mcpData.endpoint, {
      github_url: mcpData.github_url,
      name: mcpData.name
    });

    const authMethod = this.detectAuthMethod(mcpData);

    return {
      ...mcpData,
      clean_command: cleanCommand,
      auth_method: authMethod || mcpData.auth_method || 'none',
      source_type: 'wrapped',
      auto_wrapped: true,
      wrapped_at: new Date().toISOString()
    };
  }

  /**
   * Batch process multiple MCPs
   */
  processBatch(mcps) {
    return mcps.map(mcp => this.processNewMCP(mcp));
  }

  /**
   * Validate wrapped MCP
   */
  validateWrappedMCP(wrappedMCP) {
    const issues = [];

    if (!wrappedMCP.clean_command) {
      issues.push('No clean command generated');
    }

    if (!wrappedMCP.auth_method) {
      issues.push('Auth method not detected');
    }

    // Check if clean command looks reasonable
    if (wrappedMCP.clean_command) {
      const cmd = wrappedMCP.clean_command;
      
      if (cmd.includes('&&')) {
        issues.push('Complex command detected - may need manual review');
      }
      
      if (cmd.length > 100) {
        issues.push('Command too long - may need simplification');
      }
      
      if (/[;&|<>$`\\]/.test(cmd)) {
        issues.push('Potentially unsafe command characters detected');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      needs_review: issues.length > 0
    };
  }

  /**
   * Generate quality score for wrapped MCP
   */
  calculateQualityScore(wrappedMCP) {
    let score = 5; // Base score

    // Clean command quality
    if (wrappedMCP.clean_command) {
      if (wrappedMCP.clean_command.startsWith('npx ')) score += 2;
      if (wrappedMCP.clean_command.startsWith('uvx ')) score += 2;
      if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(wrappedMCP.clean_command)) score += 1;
    } else {
      score -= 3;
    }

    // Documentation presence
    if (wrappedMCP.github_url) score += 1;
    if (wrappedMCP.documentation_url) score += 1;
    if (wrappedMCP.description && wrappedMCP.description.length > 50) score += 1;

    // Use cases and tags
    if (wrappedMCP.use_cases && wrappedMCP.use_cases.length > 0) score += 1;
    if (wrappedMCP.tags && wrappedMCP.tags.length > 0) score += 1;

    // Auth clarity
    if (wrappedMCP.auth_method && wrappedMCP.auth_method !== 'none') score += 1;

    return Math.max(0, Math.min(10, score));
  }
}

module.exports = { AutoWrappingProcessor };