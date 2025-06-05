/**
 * Metadata Extractor - Extract comprehensive metadata from packages
 * Captures everything needed for a complete MCP registry entry
 */

class MetadataExtractor {
  /**
   * Extract all metadata from various sources
   */
  static async extractComplete(packageData, documentation = '') {
    return {
      // Core identification
      ...this.extractIdentification(packageData),
      
      // Technical details
      ...this.extractTechnicalDetails(packageData, documentation),
      
      // Authentication & Setup
      ...this.extractAuthRequirements(packageData, documentation),
      
      // Usage information
      ...this.extractUsageInfo(packageData, documentation),
      
      // Quality indicators
      ...this.extractQualityMetrics(packageData),
      
      // Related information
      ...this.extractRelatedInfo(packageData, documentation)
    };
  }
  
  /**
   * Extract identification info
   */
  static extractIdentification(packageData) {
    const { name, version, description } = packageData;
    
    return {
      name,
      version,
      description: this.cleanDescription(description),
      display_name: this.generateDisplayName(name),
      short_description: this.generateShortDescription(description)
    };
  }
  
  /**
   * Extract technical requirements and compatibility
   */
  static extractTechnicalDetails(packageData, documentation) {
    const details = {
      // Runtime requirements
      runtime_requirements: this.extractRuntimeRequirements(packageData),
      
      // Platform compatibility
      platforms: this.extractPlatforms(packageData, documentation),
      
      // Node/Python/Rust version requirements
      language_version: this.extractLanguageVersion(packageData),
      
      // Protocol version
      protocol_version: this.extractProtocolVersion(documentation),
      
      // Connection types supported
      connection_types: this.extractConnectionTypes(documentation),
      
      // Transport mechanisms
      transports: this.extractTransports(documentation)
    };
    
    return details;
  }
  
  /**
   * Extract authentication requirements
   */
  static extractAuthRequirements(packageData, documentation) {
    const auth = {
      auth_required: false,
      auth_methods: [],
      required_env_vars: [],
      optional_env_vars: [],
      credentials_format: null,
      oauth_config: null
    };
    
    // Check for API keys in docs
    const apiKeyPatterns = [
      /API[_\s]KEY/i,
      /ACCESS[_\s]TOKEN/i,
      /CLIENT[_\s]ID/i,
      /CLIENT[_\s]SECRET/i,
      /AUTH[_\s]TOKEN/i
    ];
    
    // Extract environment variables
    const envVarRegex = /(?:export\s+)?([A-Z][A-Z0-9_]+)(?:\s*=|:)/g;
    const envMatches = documentation.matchAll(envVarRegex);
    
    for (const match of envMatches) {
      const varName = match[1];
      
      // Check if it's auth-related
      if (apiKeyPatterns.some(p => p.test(varName))) {
        auth.auth_required = true;
        auth.required_env_vars.push(varName);
      } else if (varName.includes('_URL') || varName.includes('_ENDPOINT')) {
        auth.optional_env_vars.push(varName);
      }
    }
    
    // Check for OAuth
    if (documentation.toLowerCase().includes('oauth')) {
      auth.auth_methods.push('oauth2');
      
      // Extract OAuth details
      const clientIdMatch = documentation.match(/client[_\s]id[:\s]+([^\s\n]+)/i);
      const scopeMatch = documentation.match(/scope[s]?[:\s]+([^\n]+)/i);
      
      if (clientIdMatch || scopeMatch) {
        auth.oauth_config = {
          client_id_required: !!clientIdMatch,
          scopes: scopeMatch ? scopeMatch[1].split(/[,\s]+/) : []
        };
      }
    }
    
    // Check for API key auth
    if (auth.required_env_vars.some(v => v.includes('KEY') || v.includes('TOKEN'))) {
      auth.auth_methods.push('api_key');
    }
    
    // Extract setup instructions
    const setupSection = this.extractSection(documentation, 'setup', 'configuration', 'authentication');
    if (setupSection) {
      auth.setup_instructions = this.cleanupText(setupSection);
    }
    
    return auth;
  }
  
  /**
   * Extract usage information
   */
  static extractUsageInfo(packageData, documentation) {
    const usage = {
      // Example configurations
      example_configs: this.extractExampleConfigs(documentation),
      
      // Common use cases from docs
      documented_use_cases: this.extractUseCases(documentation),
      
      // Rate limits
      rate_limits: this.extractRateLimits(documentation),
      
      // Pricing info
      pricing_info: this.extractPricingInfo(documentation),
      
      // Prerequisites
      prerequisites: this.extractPrerequisites(documentation),
      
      // Quick start command
      quick_start: this.extractQuickStart(packageData, documentation)
    };
    
    return usage;
  }
  
  /**
   * Extract quality metrics
   */
  static extractQualityMetrics(packageData) {
    const metrics = {
      // Maintenance status
      last_publish: packageData.time?.modified || packageData.updated_at,
      publish_frequency: this.calculatePublishFrequency(packageData),
      
      // Popularity
      downloads_weekly: packageData.downloads?.weekly || 0,
      downloads_total: packageData.downloads?.total || 0,
      stars: packageData.stars || 0,
      
      // Dependencies health
      dependencies_count: Object.keys(packageData.dependencies || {}).length,
      has_vulnerabilities: packageData.vulnerabilities?.length > 0,
      
      // Documentation quality
      has_readme: !!packageData.readme,
      has_changelog: !!packageData.changelog,
      has_examples: this.checkForExamples(packageData),
      documentation_score: this.calculateDocScore(packageData)
    };
    
    return metrics;
  }
  
  /**
   * Extract related information
   */
  static extractRelatedInfo(packageData, documentation) {
    return {
      // Alternative packages
      alternatives: this.extractAlternatives(documentation),
      
      // Related packages  
      related_packages: this.extractRelatedPackages(packageData, documentation),
      
      // Integrations
      integrations: this.extractIntegrations(documentation),
      
      // Known issues
      known_issues: this.extractKnownIssues(documentation),
      
      // Community resources
      community: {
        discord: this.extractLink(documentation, 'discord.com', 'discord.gg'),
        slack: this.extractLink(documentation, 'slack.com'),
        forum: this.extractLink(documentation, 'forum', 'community'),
        chat: this.extractLink(documentation, 'gitter', 'chat')
      }
    };
  }
  
  /**
   * Helper methods
   */
  static extractRuntimeRequirements(packageData) {
    const requirements = [];
    
    // Check engines field
    if (packageData.engines) {
      for (const [engine, version] of Object.entries(packageData.engines)) {
        requirements.push({
          type: engine,
          version: version
        });
      }
    }
    
    // Check for binary dependencies
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };
    const binaryDeps = ['node-gyp', 'prebuild', 'node-pre-gyp'];
    
    if (Object.keys(deps).some(d => binaryDeps.includes(d))) {
      requirements.push({
        type: 'build-tools',
        version: 'required'
      });
    }
    
    return requirements;
  }
  
  static extractPlatforms(packageData, documentation) {
    const platforms = [];
    const os = packageData.os;
    
    if (os && Array.isArray(os)) {
      platforms.push(...os);
    } else {
      // Check documentation for platform mentions
      const platformChecks = {
        'windows': /windows|win32|win64/i,
        'macos': /macos|darwin|osx|mac\s+os/i,
        'linux': /linux|ubuntu|debian|fedora/i
      };
      
      for (const [platform, regex] of Object.entries(platformChecks)) {
        if (regex.test(documentation)) {
          platforms.push(platform);
        }
      }
      
      // If no specific platforms mentioned, assume all
      if (platforms.length === 0) {
        platforms.push('windows', 'macos', 'linux');
      }
    }
    
    return platforms;
  }
  
  static extractLanguageVersion(packageData) {
    if (packageData.engines?.node) {
      return { node: packageData.engines.node };
    }
    
    if (packageData.python_requires) {
      return { python: packageData.python_requires };
    }
    
    if (packageData.rust_version) {
      return { rust: packageData.rust_version };
    }
    
    return null;
  }
  
  static extractProtocolVersion(documentation) {
    const versionMatch = documentation.match(/protocol[_\s]version[:\s]+["']?([\d.-]+)["']?/i);
    return versionMatch ? versionMatch[1] : '2024-11-05'; // Default MCP version
  }
  
  static extractConnectionTypes(documentation) {
    const types = [];
    
    if (documentation.includes('stdio') || documentation.includes('standard input')) {
      types.push('stdio');
    }
    
    if (documentation.includes('websocket') || documentation.includes('ws://')) {
      types.push('websocket');
    }
    
    if (documentation.includes('http') && documentation.includes('sse')) {
      types.push('http+sse');
    }
    
    return types.length > 0 ? types : ['stdio']; // Default
  }
  
  static extractTransports(documentation) {
    const transports = [];
    
    const transportPatterns = {
      'stdio': /stdio|standard\s+input|stdin/i,
      'http': /http(?!s)/i,
      'https': /https/i,
      'websocket': /websocket|ws:/i,
      'grpc': /grpc/i,
      'tcp': /tcp\s+server|tcp\s+connection/i
    };
    
    for (const [transport, pattern] of Object.entries(transportPatterns)) {
      if (pattern.test(documentation)) {
        transports.push(transport);
      }
    }
    
    return transports;
  }
  
  static extractExampleConfigs(documentation) {
    const configs = [];
    
    // Look for config examples
    const configRegex = /```(?:json|javascript|yaml)?\n([^`]*config[^`]*)\n```/gi;
    const matches = documentation.matchAll(configRegex);
    
    for (const match of matches) {
      configs.push({
        content: match[1].trim(),
        format: this.detectConfigFormat(match[1])
      });
    }
    
    return configs.slice(0, 3); // Limit to 3 examples
  }
  
  static extractUseCases(documentation) {
    const useCases = [];
    
    // Look for use case sections
    const useCaseSection = this.extractSection(documentation, 'use cases', 'examples', 'usage');
    
    if (useCaseSection) {
      // Extract bullet points
      const bullets = useCaseSection.match(/[-*]\s+(.+)/g);
      if (bullets) {
        useCases.push(...bullets.map(b => b.replace(/[-*]\s+/, '').trim()));
      }
    }
    
    return useCases.slice(0, 5); // Limit to 5
  }
  
  static extractRateLimits(documentation) {
    const limits = {};
    
    // Common rate limit patterns
    const patterns = [
      /(\d+)\s*requests?\s*per\s*(second|minute|hour|day)/i,
      /rate\s*limit[:\s]+(\d+)\s*\/\s*(second|minute|hour|day)/i,
      /limited\s+to\s+(\d+)\s+(requests?)\s+per\s+(second|minute|hour|day)/i
    ];
    
    for (const pattern of patterns) {
      const match = documentation.match(pattern);
      if (match) {
        const amount = parseInt(match[1]);
        const period = match[2] || match[3];
        limits[period] = amount;
      }
    }
    
    return Object.keys(limits).length > 0 ? limits : null;
  }
  
  static extractPricingInfo(documentation) {
    const pricing = {
      model: 'unknown',
      details: null
    };
    
    if (documentation.match(/free|open[_\s]source|no[_\s]cost/i)) {
      pricing.model = 'free';
    } else if (documentation.match(/pricing|subscription|paid|premium/i)) {
      pricing.model = 'paid';
      
      // Extract pricing details
      const pricingSection = this.extractSection(documentation, 'pricing', 'cost', 'subscription');
      if (pricingSection) {
        pricing.details = this.cleanupText(pricingSection);
      }
    }
    
    return pricing;
  }
  
  static extractPrerequisites(documentation) {
    const prereqs = [];
    
    const prereqSection = this.extractSection(documentation, 'prerequisites', 'requirements', 'before you begin');
    
    if (prereqSection) {
      const bullets = prereqSection.match(/[-*]\s+(.+)/g);
      if (bullets) {
        prereqs.push(...bullets.map(b => b.replace(/[-*]\s+/, '').trim()));
      }
    }
    
    return prereqs;
  }
  
  static extractQuickStart(packageData, documentation) {
    // Look for quick start command
    const quickStartMatch = documentation.match(/(?:quick\s*start|getting\s*started)[:\s]+[`']?([^`'\n]+)[`']?/i);
    
    if (quickStartMatch) {
      return quickStartMatch[1].trim();
    }
    
    // Generate based on package type
    const name = packageData.name;
    
    if (packageData.bin) {
      return `npx ${name}`;
    }
    
    return null;
  }
  
  static extractSection(text, ...keywords) {
    for (const keyword of keywords) {
      const regex = new RegExp(`#{1,3}\\s*${keyword}[\\s\\S]*?(?=#{1,3}|$)`, 'i');
      const match = text.match(regex);
      if (match) {
        return match[0];
      }
    }
    return null;
  }
  
  static extractLink(text, ...patterns) {
    for (const pattern of patterns) {
      const regex = new RegExp(`https?://[^\\s]*${pattern}[^\\s]*`, 'i');
      const match = text.match(regex);
      if (match) {
        return match[0];
      }
    }
    return null;
  }
  
  static cleanDescription(description) {
    if (!description) return '';
    
    return description
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[*_]/g, '')
      .trim();
  }
  
  static generateDisplayName(name) {
    // @org/package -> Package
    // mcp-server-stripe -> Stripe Server
    
    return name
      .replace(/^@[^/]+\//, '')
      .replace(/^mcp-server-/, '')
      .replace(/-mcp-server$/, '')
      .replace(/-mcp$/, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  static generateShortDescription(description) {
    if (!description) return '';
    
    const cleaned = this.cleanDescription(description);
    if (cleaned.length <= 100) return cleaned;
    
    return cleaned.substring(0, 97) + '...';
  }
  
  static cleanupText(text) {
    return text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\n+/g, '\n')
      .replace(/^\s+|\s+$/gm, '')
      .trim();
  }
  
  static detectConfigFormat(content) {
    if (content.includes('{') && content.includes('}')) return 'json';
    if (content.includes('export ') || content.includes('const ')) return 'javascript';
    if (content.includes(':') && !content.includes('{')) return 'yaml';
    return 'text';
  }
  
  static calculatePublishFrequency(packageData) {
    if (!packageData.time) return 'unknown';
    
    const versions = Object.values(packageData.time).filter(t => t !== packageData.time.created);
    if (versions.length < 2) return 'rare';
    
    const daysBetween = versions.slice(-5).map((date, i, arr) => {
      if (i === 0) return 0;
      const diff = new Date(date) - new Date(arr[i-1]);
      return diff / (1000 * 60 * 60 * 24);
    }).filter(d => d > 0);
    
    const avgDays = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
    
    if (avgDays < 7) return 'weekly';
    if (avgDays < 30) return 'monthly';
    if (avgDays < 90) return 'quarterly';
    return 'rare';
  }
  
  static checkForExamples(packageData) {
    const readme = packageData.readme || '';
    return readme.includes('example') || readme.includes('Example') || 
           readme.includes('```') || !!packageData.examples;
  }
  
  static calculateDocScore(packageData) {
    let score = 0;
    
    if (packageData.readme) score += 3;
    if (packageData.readme?.length > 1000) score += 2;
    if (this.checkForExamples(packageData)) score += 2;
    if (packageData.homepage) score += 1;
    if (packageData.repository) score += 1;
    if (packageData.bugs) score += 1;
    
    return Math.min(score, 10);
  }
  
  static extractAlternatives(documentation) {
    const alternatives = [];
    
    const altSection = this.extractSection(documentation, 'alternatives', 'similar', 'see also');
    if (altSection) {
      // Extract package names
      const packageRegex = /[@\w/-]+/g;
      const matches = altSection.match(packageRegex);
      
      if (matches) {
        alternatives.push(...matches.filter(m => 
          m.includes('/') || m.includes('-') || m.startsWith('@')
        ));
      }
    }
    
    return alternatives.slice(0, 5);
  }
  
  static extractRelatedPackages(packageData, documentation) {
    const related = [];
    
    // From package keywords
    if (packageData.keywords) {
      const mcpKeywords = packageData.keywords.filter(k => 
        k.includes('mcp') || k.includes('model-context')
      );
      related.push(...mcpKeywords);
    }
    
    // From documentation
    const seeAlso = this.extractSection(documentation, 'see also', 'related');
    if (seeAlso) {
      const packages = seeAlso.match(/[@\w/-]+/g);
      if (packages) {
        related.push(...packages);
      }
    }
    
    return [...new Set(related)].slice(0, 5);
  }
  
  static extractIntegrations(documentation) {
    const integrations = [];
    
    const services = [
      'slack', 'discord', 'github', 'gitlab', 'jira', 'notion',
      'google', 'aws', 'azure', 'stripe', 'twilio', 'sendgrid'
    ];
    
    for (const service of services) {
      if (documentation.toLowerCase().includes(service)) {
        integrations.push(service);
      }
    }
    
    return integrations;
  }
  
  static extractKnownIssues(documentation) {
    const issues = [];
    
    const issueSection = this.extractSection(documentation, 'known issues', 'limitations', 'caveats');
    
    if (issueSection) {
      const bullets = issueSection.match(/[-*]\s+(.+)/g);
      if (bullets) {
        issues.push(...bullets.map(b => b.replace(/[-*]\s+/, '').trim()));
      }
    }
    
    return issues.slice(0, 5);
  }
}

module.exports = { MetadataExtractor };