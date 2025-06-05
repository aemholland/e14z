/**
 * AI-Powered Slug Generator
 * Intelligently determines official vs community packages for clean slug generation
 */

class AIPoweredSlugGenerator {
  /**
   * Generate intelligent slug based on package officialness
   * @param {Object} packageData - Complete package information
   * @param {string} installType - npm, pipx, cargo, go
   * @returns {Promise<string>} Clean slug
   */
  static async generateIntelligentSlug(packageData, installType) {
    const packageName = packageData.name;
    
    // Quick fallback for invalid data
    if (!packageName) return this.generateFallbackSlug('unknown', installType);
    
    // Step 1: Determine if this is an official package using AI
    const isOfficial = await this.isOfficialPackage(packageData);
    
    if (isOfficial.official) {
      // Official packages get clean, branded slugs
      return this.generateCleanSlug(packageName, isOfficial.serviceName);
    } else {
      // Community packages get attributed slugs
      return this.generateAttributedSlug(packageData, installType);
    }
  }
  
  /**
   * Use AI to determine if package is official
   */
  static async isOfficialPackage(packageData) {
    const { name, author, company, repository, description } = packageData;
    
    // Prepare context for AI analysis
    const analysisContext = {
      packageName: name,
      author: author || 'unknown',
      company: company || 'unknown',
      githubRepo: this.extractGitHubInfo(repository),
      description: description || '',
      npmScope: name.startsWith('@') ? name.split('/')[0].replace('@', '') : null
    };
    
    // AI prompt for package classification
    const prompt = `
    Analyze this package to determine if it's OFFICIAL (from the service company) or COMMUNITY (third-party):

    Package: ${analysisContext.packageName}
    Author: ${analysisContext.author}
    Company: ${analysisContext.company}
    GitHub: ${analysisContext.githubRepo || 'unknown'}
    Description: ${analysisContext.description}
    NPM Scope: ${analysisContext.npmScope || 'none'}

    OFFICIAL examples:
    - @stripe/stripe-js (Stripe's official JS SDK)
    - notion (Notion's official package)
    - @anthropic-ai/sdk (Anthropic's official SDK)
    - @modelcontextprotocol/server-* (MCP protocol official servers)

    COMMUNITY examples:
    - @johndoe/stripe-helper (third-party Stripe tool)
    - @acme/notion-integration (community Notion tool)
    - stripe-payment-processor-v2 (third-party Stripe tool)

    Key indicators of OFFICIAL:
    1. Package name matches service name (stripe from Stripe)
    2. GitHub repo owned by service company (stripe/stripe-js)
    3. NPM scope matches company (@stripe, @anthropic-ai)
    4. Author/company is the service provider

    Respond with JSON:
    {
      "official": true/false,
      "serviceName": "stripe|notion|github|etc" (if official),
      "reasoning": "explanation",
      "confidence": 0.0-1.0
    }
    `;

    try {
      // For now, implement rule-based logic (can be upgraded to actual AI later)
      return this.ruleBasedOfficialDetection(analysisContext);
    } catch (error) {
      console.warn(`   ⚠️ AI slug analysis failed: ${error.message}`);
      // Fallback to conservative community classification
      return { official: false, serviceName: null, reasoning: 'AI failed, defaulting to community' };
    }
  }
  
  /**
   * Rule-based official package detection (fallback for AI)
   */
  static ruleBasedOfficialDetection(context) {
    const { packageName, npmScope, githubRepo, author, company } = context;
    
    // Official MCP protocol packages
    if (packageName.startsWith('@modelcontextprotocol/') || 
        packageName.startsWith('@anthropic-ai/')) {
      return {
        official: true,
        serviceName: packageName.includes('server-') ? 
          packageName.replace('@modelcontextprotocol/server-', '') : 'mcp',
        reasoning: 'Official MCP protocol package',
        confidence: 0.95
      };
    }
    
    // Well-known official patterns
    const officialPatterns = [
      // Exact matches (service owns the exact name)
      { pattern: /^stripe$/, service: 'stripe', confidence: 0.9 },
      { pattern: /^notion$/, service: 'notion', confidence: 0.9 },
      { pattern: /^github$/, service: 'github', confidence: 0.9 },
      { pattern: /^openai$/, service: 'openai', confidence: 0.9 },
      { pattern: /^discord\.js$/, service: 'discord', confidence: 0.9 },
      
      // Official scoped packages
      { pattern: /^@stripe\//, service: 'stripe', confidence: 0.95 },
      { pattern: /^@openai\//, service: 'openai', confidence: 0.95 },
      { pattern: /^@anthropic-ai\//, service: 'anthropic', confidence: 0.95 },
      { pattern: /^@supabase\//, service: 'supabase', confidence: 0.95 },
      { pattern: /^@vercel\//, service: 'vercel', confidence: 0.95 },
      { pattern: /^@slack\//, service: 'slack', confidence: 0.95 },
      { pattern: /^@microsoft\//, service: 'microsoft', confidence: 0.95 },
      { pattern: /^@google\//, service: 'google', confidence: 0.95 },
      { pattern: /^@notionhq\//, service: 'notion', confidence: 0.95 },
      { pattern: /^@discordjs\//, service: 'discord', confidence: 0.95 },
      
      // GitHub repo ownership validation
      { pattern: /^axios$/, service: 'axios', confidence: 0.8, requiresRepo: 'axios/axios' },
    ];
    
    for (const { pattern, service, confidence, requiresRepo } of officialPatterns) {
      if (pattern.test(packageName)) {
        // If requires repo validation, check it
        if (requiresRepo && githubRepo !== requiresRepo) {
          continue;
        }
        
        return {
          official: true,
          serviceName: service,
          reasoning: `Matches official pattern: ${pattern}`,
          confidence
        };
      }
    }
    
    // GitHub repo analysis
    if (githubRepo) {
      const [owner, repo] = githubRepo.split('/');
      
      // Check if repo owner matches package/service name
      const packageBase = packageName.replace(/^@[^/]+\//, '').replace(/[^a-z0-9]/g, '');
      const serviceName = this.inferServiceFromPackage(packageName);
      
      if (owner.toLowerCase() === serviceName?.toLowerCase()) {
        return {
          official: true,
          serviceName,
          reasoning: `GitHub owner matches service: ${owner}`,
          confidence: 0.85
        };
      }
    }
    
    // NPM scope analysis
    if (npmScope) {
      const knownOfficialScopes = [
        'stripe', 'openai', 'anthropic-ai', 'supabase', 'vercel', 
        'slack', 'microsoft', 'google', 'github', 'discord', 'notionhq', 'discordjs'
      ];
      
      if (knownOfficialScopes.includes(npmScope)) {
        return {
          official: true,
          serviceName: npmScope.replace('-ai', ''), // anthropic-ai → anthropic
          reasoning: `Known official NPM scope: @${npmScope}`,
          confidence: 0.9
        };
      }
    }
    
    // Default to community
    return {
      official: false,
      serviceName: null,
      reasoning: 'No official indicators found, treating as community package',
      confidence: 0.8
    };
  }
  
  /**
   * Generate clean slug for official packages
   */
  static generateCleanSlug(packageName, serviceName) {
    // Use service name if available, otherwise clean up package name
    if (serviceName && serviceName !== 'mcp') {
      return serviceName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }
    
    // For MCP servers, extract the service part
    if (packageName.includes('server-')) {
      const service = packageName.replace('@modelcontextprotocol/server-', '');
      return service.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }
    
    // Clean up the package name
    return packageName
      .replace(/^@[^/]+\//, '')  // Remove scope
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  /**
   * Generate attributed slug for community packages
   */
  static generateAttributedSlug(packageData, installType) {
    const { name, repository } = packageData;
    
    // Extract GitHub username/org
    const githubInfo = this.extractGitHubInfo(repository);
    let attribution = null;
    
    if (githubInfo) {
      const [owner] = githubInfo.split('/');
      attribution = owner.toLowerCase();
    } else if (name.startsWith('@')) {
      // Use NPM scope as attribution
      attribution = name.split('/')[0].replace('@', '');
    }
    
    // Clean package name
    const cleanName = name
      .replace(/^@[^/]+\//, '')  // Remove scope
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Combine attribution with package name
    if (attribution && attribution !== cleanName) {
      return `${attribution}-${cleanName}`;
    }
    
    return cleanName;
  }
  
  /**
   * Extract GitHub repository info
   */
  static extractGitHubInfo(repository) {
    if (!repository) return null;
    
    const repoUrl = typeof repository === 'string' ? repository : repository.url;
    if (!repoUrl) return null;
    
    const match = repoUrl.match(/github\.com[\/:]([^\/]+\/[^\/]+)/);
    return match ? match[1].replace(/\.git$/, '') : null;
  }
  
  /**
   * Infer service name from package name
   */
  static inferServiceFromPackage(packageName) {
    const name = packageName.toLowerCase();
    
    // Common service patterns
    if (name.includes('stripe')) return 'stripe';
    if (name.includes('notion')) return 'notion';
    if (name.includes('github')) return 'github';
    if (name.includes('slack')) return 'slack';
    if (name.includes('openai')) return 'openai';
    if (name.includes('anthropic')) return 'anthropic';
    if (name.includes('supabase')) return 'supabase';
    if (name.includes('vercel')) return 'vercel';
    
    return null;
  }
  
  /**
   * Fallback slug generation
   */
  static generateFallbackSlug(packageName, installType) {
    return packageName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      + (installType !== 'npm' ? `-${installType}` : '');
  }
}

module.exports = { AIPoweredSlugGenerator };