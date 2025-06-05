/**
 * Go Package Scraper Module
 * Extracts detailed MCP information from Go packages for Go install
 */

const https = require('https');
const path = require('path');
const { AIEnhancedScraper } = require('./ai-enhanced-scraper');
const { WebScraper } = require('./web-scraper');

class GoScraper {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.userAgent = 'e14z-mcp-crawler/1.0.0';
    this.githubToken = process.env.GITHUB_TOKEN; // Optional for higher rate limits
    this.useAI = options.useAI !== false; // Enable AI by default
    this.useWebScraper = options.useWebScraper !== false; // Enable web scraping by default
    this.aiScraper = new AIEnhancedScraper(options);
    this.webScraper = new WebScraper(options);
  }

  /**
   * Scrape detailed MCP information from Go package
   */
  async scrapeMCPPackage(packageInfo) {
    console.log(`🔍 Scraping Go package: ${packageInfo.name}`);

    try {
      // Get detailed package info from pkg.go.dev
      const goDetails = await this.getGoPackageDetails(packageInfo.importPath || packageInfo.name);
      
      // Get additional info from GitHub if available
      let githubInfo = null;
      const repoUrl = packageInfo.repository || this.extractRepositoryFromPath(packageInfo.importPath || packageInfo.name);
      if (repoUrl) {
        githubInfo = await this.getGitHubInfo(repoUrl);
      }

      // Enhanced documentation scraping with web scraper
      let webScrapedDocs = null;
      if (this.useWebScraper) {
        webScrapedDocs = await this.scrapeDocumentationSites(goDetails, githubInfo, packageInfo);
      }

      // Extract MCP-specific information
      let mcpData;
      
      // Use AI-enhanced extraction if enabled
      if (this.useAI) {
        console.log(`   🤖 Using AI to analyze ${packageInfo.name}...`);
        const aiAnalysis = await this.aiScraper.analyzePackageWithAI(packageInfo, goDetails, githubInfo, webScrapedDocs);
        
        // Transform AI analysis to mcpData format
        mcpData = {
          tools: aiAnalysis.tools || [],
          authMethod: aiAnalysis.authentication?.method || 'none',
          connectionType: 'stdio',
          protocolVersion: this.detectProtocolVersion(goDetails, githubInfo),
          enhancedDescription: aiAnalysis.enhancedDescription,
          comprehensiveTags: aiAnalysis.comprehensiveTags,
          detailedUseCases: aiAnalysis.useCases,
          aiCategory: aiAnalysis.category,
          qualitySignals: aiAnalysis.qualitySignals
        };
      } else {
        // Fallback to traditional extraction
        mcpData = await this.extractMCPData(goDetails, githubInfo, packageInfo);
      }

      return {
        // Basic package info
        name: packageInfo.importPath || packageInfo.name,
        slug: this.generateSlug(packageInfo.name, { repository: repoUrl }),
        description: mcpData.enhancedDescription || this.enhanceDescription(goDetails, githubInfo, mcpData.tools, packageInfo) || goDetails?.synopsis || packageInfo.description,
        version: packageInfo.version || goDetails?.version || 'latest',
        
        // Installation
        install_type: 'go',
        endpoint: this.extractInstallCommand(packageInfo),
        auto_install_command: this.extractInstallCommand(packageInfo),
        
        // MCP specific
        tools: mcpData.tools,
        auth_method: mcpData.authMethod,
        connection_type: mcpData.connectionType,
        protocol_version: mcpData.protocolVersion,
        
        // Categorization
        category: mcpData.aiCategory?.category || this.categorizePackage(goDetails, githubInfo, mcpData.tools),
        tags: mcpData.comprehensiveTags || this.extractTags(goDetails, githubInfo, mcpData, packageInfo),
        use_cases: mcpData.detailedUseCases || this.generateUseCases(mcpData.tools, goDetails?.synopsis || packageInfo.description),
        
        // Quality & Trust
        verified: false, // Will be validated later
        health_status: 'unknown',
        auto_discovered: true,
        discovery_source: 'pkg.go.dev',
        quality_score: mcpData.qualitySignals ? this.calculateAIQualityScore(mcpData.qualitySignals, goDetails, githubInfo) : this.calculateQualityScore(goDetails, githubInfo, packageInfo),
        
        // Links & Documentation
        github_url: this.extractGitHubUrl(repoUrl),
        documentation_url: packageInfo.documentation || `https://pkg.go.dev/${packageInfo.importPath || packageInfo.name}`,
        website_url: githubInfo?.homepage || repoUrl,
        
        // Author & License
        author: this.extractAuthor(githubInfo),
        company: this.extractCompany(githubInfo),
        license: goDetails?.licenseType || githubInfo?.license?.name || 'Unknown',
        
        // Go specific
        import_path: packageInfo.importPath || packageInfo.name,
        go_version: this.extractGoVersion(goDetails, githubInfo),
        
        // GitHub metrics (if available)
        stars: githubInfo?.stars,
        forks: githubInfo?.forks,
        topics: githubInfo?.topics || [],
        
        // Pricing
        pricing_model: 'free', // Go packages are free by default
        pricing_details: {},
        
        // Metadata
        created_at: githubInfo?.created_at || new Date().toISOString(),
        updated_at: packageInfo.lastUpdate || goDetails?.commitTime || githubInfo?.updated_at || new Date().toISOString(),
        last_scraped_at: new Date().toISOString(),
        
        // Raw data for debugging
        _raw_go_data: {
          import_path: packageInfo.importPath || packageInfo.name,
          topics: githubInfo?.topics || [],
          go_mod_info: goDetails,
          github_language: githubInfo?.language
        }
      };

    } catch (error) {
      console.error(`❌ Failed to scrape ${packageInfo.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get detailed package information from pkg.go.dev
   */
  async getGoPackageDetails(importPath) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'pkg.go.dev',
        path: `/${encodeURIComponent(importPath)}`,
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: this.timeout
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              resolve(null);
              return;
            }
            
            const packageInfo = this.parseGoPackageInfo(data);
            resolve(packageInfo);
          } catch (error) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.end();
    });
  }

  /**
   * Parse package information from pkg.go.dev HTML
   */
  parseGoPackageInfo(html) {
    const info = {};
    
    // Extract synopsis
    const synopsisMatch = html.match(/<div[^>]*class="[^"]*Overview-synopsis[^"]*"[^>]*>([^<]+)<\/div>/);
    if (synopsisMatch) {
      info.synopsis = synopsisMatch[1].trim();
    }
    
    // Extract version
    const versionMatch = html.match(/<span[^>]*class="[^"]*DetailsHeader-version[^"]*"[^>]*>([^<]+)<\/span>/);
    if (versionMatch) {
      info.version = versionMatch[1].trim();
    }
    
    // Extract license
    const licenseMatch = html.match(/<span[^>]*data-test-id="DetailsHeader-license"[^>]*>([^<]+)<\/span>/);
    if (licenseMatch) {
      info.licenseType = licenseMatch[1].trim();
    }
    
    // Extract commit time
    const commitTimeMatch = html.match(/<span[^>]*data-test-id="DetailsHeader-commitTime"[^>]*title="([^"]+)"/);
    if (commitTimeMatch) {
      info.commitTime = commitTimeMatch[1];
    }
    
    // Extract repository URL
    const repoMatch = html.match(/<a[^>]*data-test-id="DetailsHeader-repositoryLink"[^>]*href="([^"]+)"/);
    if (repoMatch) {
      info.repository = repoMatch[1];
    }
    
    return info;
  }

  /**
   * Get GitHub repository information
   */
  async getGitHubInfo(repositoryUrl) {
    if (!repositoryUrl) return null;

    try {
      // Extract owner/repo from various GitHub URL formats
      const match = repositoryUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
      if (!match) return null;

      const [, owner, repo] = match;
      
      return new Promise((resolve) => {
        const options = {
          hostname: 'api.github.com',
          path: `/repos/${owner}/${repo}`,
          method: 'GET',
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/vnd.github.v3+json'
          }
        };

        if (this.githubToken) {
          options.headers['Authorization'] = `token ${this.githubToken}`;
        }

        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const repoInfo = JSON.parse(data);
                resolve({
                  stars: repoInfo.stargazers_count,
                  forks: repoInfo.forks_count,
                  issues: repoInfo.open_issues_count,
                  language: repoInfo.language,
                  lastUpdate: repoInfo.updated_at,
                  created_at: repoInfo.created_at,
                  updated_at: repoInfo.updated_at,
                  description: repoInfo.description,
                  topics: repoInfo.topics || [],
                  defaultBranch: repoInfo.default_branch,
                  owner: repoInfo.owner?.login,
                  isArchived: repoInfo.archived,
                  hasPages: repoInfo.has_pages,
                  homepage: repoInfo.homepage,
                  license: repoInfo.license
                });
              } else {
                resolve(null);
              }
            } catch (error) {
              resolve(null);
            }
          });
        });

        req.on('error', () => resolve(null));
        req.setTimeout(this.timeout, () => {
          req.destroy();
          resolve(null);
        });

        req.end();
      });
    } catch (error) {
      console.warn(`   Failed to get GitHub info: ${error.message}`);
      return null;
    }
  }

  /**
   * Scrape documentation sites for additional information
   */
  async scrapeDocumentationSites(goDetails, githubInfo, packageInfo) {
    if (!this.webScraper) return null;

    const urlsToScrape = [];
    
    // Add pkg.go.dev documentation
    if (packageInfo.importPath || packageInfo.name) {
      urlsToScrape.push(`https://pkg.go.dev/${packageInfo.importPath || packageInfo.name}`);
    }

    // Add repository
    if (goDetails?.repository || packageInfo.repository) {
      urlsToScrape.push(goDetails.repository || packageInfo.repository);
    }

    // Add GitHub README
    if (githubInfo && githubInfo.owner) {
      const repoName = (packageInfo.importPath || packageInfo.name).split('/').pop();
      urlsToScrape.push(`https://raw.githubusercontent.com/${githubInfo.owner}/${repoName}/main/README.md`);
      urlsToScrape.push(`https://raw.githubusercontent.com/${githubInfo.owner}/${repoName}/master/README.md`);
    }

    // Add homepage if available
    if (githubInfo?.homepage) {
      urlsToScrape.push(githubInfo.homepage);
    }

    try {
      const scrapedContent = [];
      
      for (const url of urlsToScrape.slice(0, 4)) { // Limit to prevent overload
        try {
          const content = await this.webScraper.scrapeUrl(url, {
            waitFor: 2000,
            extractText: true
          });
          
          if (content && content.text && content.text.length > 100) {
            scrapedContent.push({
              url,
              content: content.text,
              title: content.title
            });
          }
        } catch (error) {
          console.warn(`   Failed to scrape ${url}: ${error.message}`);
        }
      }

      return scrapedContent.length > 0 ? scrapedContent : null;
    } catch (error) {
      console.warn(`   Web scraping failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract repository URL from Go module path
   */
  extractRepositoryFromPath(importPath) {
    if (!importPath) return null;
    
    // Handle common Go hosting patterns
    if (importPath.startsWith('github.com/')) {
      const parts = importPath.split('/');
      if (parts.length >= 3) {
        return `https://${parts[0]}/${parts[1]}/${parts[2]}`;
      }
    }
    
    if (importPath.startsWith('gitlab.com/')) {
      const parts = importPath.split('/');
      if (parts.length >= 3) {
        return `https://${parts[0]}/${parts[1]}/${parts[2]}`;
      }
    }
    
    if (importPath.startsWith('bitbucket.org/')) {
      const parts = importPath.split('/');
      if (parts.length >= 3) {
        return `https://${parts[0]}/${parts[1]}/${parts[2]}`;
      }
    }
    
    return null;
  }

  /**
   * Generate unique slug for the package
   */
  generateSlug(packageName, options = {}) {
    // For Go packages, use the last part of the import path as the base name
    const baseName = packageName.split('/').pop() || packageName;
    
    // Check if this is an official package
    const isOfficial = this.isOfficialPackage(baseName, options);
    
    if (isOfficial) {
      // Official: use clean slug without username
      return baseName.toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    } else {
      // Community: try to extract maintainer info for {package-name}-{username} format
      const maintainerInfo = this.extractMaintainerInfo(packageName, options);
      
      if (maintainerInfo) {
        const cleanPackageName = baseName.toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        const cleanUsername = maintainerInfo.toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        return `${cleanPackageName}-${cleanUsername}`;
      } else {
        // Fallback to package name only
        return baseName.toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      }
    }
  }

  /**
   * Check if this is an official package
   */
  isOfficialPackage(packageName, options = {}) {
    const name = packageName.toLowerCase();
    
    // Official MCP packages (if they exist in Go)
    const officialMCPPackages = [
      'mcp-server-filesystem',
      'mcp-server-git',
      'mcp-server-postgres'
    ];
    
    // Well-known service official packages
    const serviceOfficialPatterns = [
      'anthropic',
      'openai',
      'google',
      'microsoft',
      'amazon',
      'stripe',
      'github',
      'slack',
      'discord',
      'notion'
    ];
    
    // Check if it's in the official list
    if (officialMCPPackages.includes(name)) {
      return true;
    }
    
    // Check if it's a known service's official package
    if (serviceOfficialPatterns.some(service => name.includes(service))) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract maintainer information from import path or repository URL
   */
  extractMaintainerInfo(importPath, options = {}) {
    // Try repository URL first
    const repoUrl = options.repository;
    if (repoUrl) {
      try {
        const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
        if (match) {
          return match[1]; // GitHub username
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
    
    // Try import path
    if (importPath && importPath.startsWith('github.com/')) {
      const parts = importPath.split('/');
      if (parts.length >= 2) {
        return parts[1]; // GitHub username from import path
      }
    }
    
    return null;
  }

  /**
   * Extract installation command for Go package
   */
  extractInstallCommand(packageInfo) {
    const importPath = packageInfo.importPath || packageInfo.name;
    return `go install ${importPath}@latest`;
  }

  /**
   * Detect MCP protocol version from package details
   */
  detectProtocolVersion(goDetails, githubInfo) {
    const texts = [
      goDetails?.synopsis || '',
      githubInfo?.description || ''
    ].join(' ').toLowerCase();
    
    // Look for version patterns in description
    const versionPatterns = [
      /protocol[:\s]+v?(\d{4}-\d{2}-\d{2})/,
      /mcp[:\s]+v?(\d{4}-\d{2}-\d{2})/,
      /version[:\s]+v?(\d{4}-\d{2}-\d{2})/
    ];
    
    for (const pattern of versionPatterns) {
      const match = texts.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    // Default to current MCP version
    return '2024-11-05';
  }

  /**
   * Extract MCP data using traditional methods (fallback)
   */
  async extractMCPData(goDetails, githubInfo, packageInfo) {
    const tools = this.extractToolsFromDescription(goDetails, githubInfo, packageInfo);
    
    return {
      tools,
      authMethod: this.detectAuthMethod(goDetails, githubInfo),
      connectionType: 'stdio', // Default for Go MCP servers
      protocolVersion: this.detectProtocolVersion(goDetails, githubInfo)
    };
  }

  /**
   * Extract tools from package description
   */
  extractToolsFromDescription(goDetails, githubInfo, packageInfo) {
    const text = [
      goDetails?.synopsis || '',
      githubInfo?.description || '',
      packageInfo?.description || ''
    ].join(' ').toLowerCase();

    const tools = [];
    
    // Common tool patterns
    const toolPatterns = [
      { pattern: /file|filesystem|directory|path/g, name: 'File System Access', description: 'Access and manipulate local files and directories' },
      { pattern: /database|sql|postgres|mysql|sqlite/g, name: 'Database Operations', description: 'Execute database queries and operations' },
      { pattern: /api|rest|http|request|client/g, name: 'API Client', description: 'Make HTTP requests and API calls' },
      { pattern: /search|query|find|index/g, name: 'Search Operations', description: 'Search and query external services' },
      { pattern: /email|mail|smtp/g, name: 'Email Operations', description: 'Send and manage email communications' },
      { pattern: /git|version control|repository/g, name: 'Git Operations', description: 'Interact with Git repositories' },
      { pattern: /calendar|schedule|event/g, name: 'Calendar Management', description: 'Manage calendar events and schedules' },
      { pattern: /chat|message|communication/g, name: 'Communication Tools', description: 'Send messages and communications' },
      { pattern: /crypto|encryption|hash|security/g, name: 'Cryptography', description: 'Cryptographic operations and security tools' },
      { pattern: /network|tcp|udp|socket|grpc/g, name: 'Network Operations', description: 'Network communication and socket operations' },
      { pattern: /json|yaml|toml|config/g, name: 'Configuration Management', description: 'Parse and manage configuration files' },
      { pattern: /log|logging|monitor/g, name: 'Logging & Monitoring', description: 'Logging and monitoring capabilities' }
    ];

    for (const { pattern, name, description } of toolPatterns) {
      if (pattern.test(text)) {
        tools.push({ name, description });
      }
    }

    return tools;
  }

  /**
   * Detect authentication method
   */
  detectAuthMethod(goDetails, githubInfo) {
    const text = [
      goDetails?.synopsis || '',
      githubInfo?.description || ''
    ].join(' ').toLowerCase();

    if (text.includes('api key') || text.includes('token')) return 'api_key';
    if (text.includes('oauth') || text.includes('auth')) return 'oauth';
    if (text.includes('username') && text.includes('password')) return 'basic_auth';
    
    return 'none';
  }

  /**
   * Enhanced description generation
   */
  enhanceDescription(goDetails, githubInfo, tools, packageInfo) {
    let description = goDetails?.synopsis || githubInfo?.description || packageInfo?.description || '';
    
    if (tools && tools.length > 0) {
      const toolsText = tools.map(tool => tool.name).join(', ');
      description += ` Provides tools for: ${toolsText}.`;
    }
    
    if (githubInfo && githubInfo.language) {
      description += ` Written in ${githubInfo.language}.`;
    }
    
    return description;
  }

  /**
   * Categorize package based on content
   */
  categorizePackage(goDetails, githubInfo, tools) {
    const text = [
      goDetails?.synopsis || '',
      githubInfo?.description || ''
    ].join(' ').toLowerCase();

    const topics = (githubInfo?.topics || []).map(t => t.toLowerCase());

    // Category mapping
    const categories = {
      'productivity': ['calendar', 'email', 'note', 'task', 'schedule'],
      'development': ['git', 'code', 'development', 'api', 'database', 'dev'],
      'communication': ['chat', 'message', 'slack', 'discord', 'mail'],
      'data': ['database', 'sql', 'data', 'analytics', 'query'],
      'file-management': ['file', 'filesystem', 'directory', 'storage'],
      'search': ['search', 'find', 'query', 'index'],
      'ai-ml': ['ai', 'machine learning', 'ml', 'neural', 'model'],
      'web': ['web', 'browser', 'http', 'html', 'scraping'],
      'security': ['crypto', 'encryption', 'security', 'hash', 'auth'],
      'network': ['network', 'tcp', 'udp', 'socket', 'protocol', 'grpc']
    };

    // Check topics first
    for (const [category, keywords] of Object.entries(categories)) {
      if (topics.some(topic => keywords.includes(topic))) {
        return category;
      }
    }

    // Check description text
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'utilities';
  }

  /**
   * Extract tags from package information
   */
  extractTags(goDetails, githubInfo, mcpData, packageInfo) {
    const tags = new Set();

    // Add language and package manager tags
    tags.add('go');
    tags.add('golang');

    // Add GitHub topics
    if (githubInfo?.topics) {
      githubInfo.topics.forEach(topic => {
        if (topic && topic.length < 20) {
          tags.add(topic.toLowerCase().replace(/\s+/g, '-'));
        }
      });
    }

    // Add MCP-specific tags
    tags.add('mcp-server');
    tags.add('model-context-protocol');

    // Add tool-based tags
    if (mcpData.tools) {
      mcpData.tools.forEach(tool => {
        const toolName = tool.name.toLowerCase().replace(/\s+/g, '-');
        tags.add(toolName);
      });
    }

    // Add domain-based tags (from import path)
    const importPath = packageInfo.importPath || packageInfo.name;
    if (importPath) {
      if (importPath.includes('github.com')) tags.add('github');
      if (importPath.includes('gitlab.com')) tags.add('gitlab');
      if (importPath.includes('api')) tags.add('api');
      if (importPath.includes('cli')) tags.add('cli');
      if (importPath.includes('cmd')) tags.add('command-line');
    }

    return Array.from(tags).slice(0, 12); // Limit tags
  }

  /**
   * Generate use cases based on tools and description
   */
  generateUseCases(tools, description) {
    const useCases = [];

    if (tools && tools.length > 0) {
      tools.forEach(tool => {
        if (tool.description) {
          useCases.push(tool.description);
        }
      });
    }

    // Add general use case based on description
    if (description && description.length > 20) {
      useCases.push(`General: ${description}`);
    }

    return useCases.slice(0, 5);
  }

  /**
   * Extract Go version requirements
   */
  extractGoVersion(goDetails, githubInfo) {
    // This would typically require parsing go.mod file
    // For now, we'll return a default
    return '1.19+';
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(goDetails, githubInfo, packageInfo) {
    let score = 0;

    // Recent updates (20 points)
    if (this.isRecentlyUpdated(goDetails, githubInfo)) score += 20;
    
    // Has documentation (20 points)
    if (this.hasGoodDocumentation(goDetails, githubInfo)) score += 20;
    
    // Has repository (15 points)
    if (goDetails?.repository || packageInfo.repository) score += 15;
    
    // GitHub metrics (20 points)
    if (githubInfo) {
      if (githubInfo.stars > 10) score += 5;
      if (githubInfo.stars > 100) score += 5;
      if (githubInfo.forks > 5) score += 5;
      if (!githubInfo.isArchived) score += 5;
    }
    
    // Has proper description (15 points)
    const description = goDetails?.synopsis || githubInfo?.description || packageInfo?.description;
    if (description && description.length > 30) score += 15;
    
    // Has license (10 points)
    if (goDetails?.licenseType && goDetails.licenseType !== 'Unknown') score += 10;

    return Math.min(score, 100);
  }

  /**
   * Calculate AI-enhanced quality score
   */
  calculateAIQualityScore(qualitySignals, goDetails, githubInfo) {
    // Use AI quality signals if available
    if (qualitySignals && qualitySignals.overallScore) {
      return Math.min(qualitySignals.overallScore, 100);
    }
    
    return this.calculateQualityScore(goDetails, githubInfo);
  }

  /**
   * Helper methods
   */
  isRecentlyUpdated(goDetails, githubInfo) {
    const commitTime = goDetails?.commitTime || githubInfo?.updated_at;
    if (!commitTime) return false;
    
    const lastModified = new Date(commitTime);
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    return lastModified > sixMonthsAgo;
  }

  hasGoodDocumentation(goDetails, githubInfo) {
    return !!(
      goDetails?.synopsis && goDetails.synopsis.length > 50 ||
      githubInfo?.description && githubInfo.description.length > 100 ||
      goDetails?.repository ||
      githubInfo?.homepage
    );
  }

  extractGitHubUrl(repositoryUrl) {
    if (!repositoryUrl) return null;
    
    const match = repositoryUrl.match(/(https?:\/\/github\.com\/[\w-]+\/[\w-]+)/);
    return match ? match[1] : null;
  }

  extractAuthor(githubInfo) {
    if (githubInfo && githubInfo.owner) {
      return githubInfo.owner;
    }
    
    return 'Unknown';
  }

  extractCompany(githubInfo) {
    // Use GitHub owner if it looks like a company
    if (githubInfo && githubInfo.owner) {
      const owner = githubInfo.owner;
      if (owner !== owner.toLowerCase() || owner.includes('-') || owner.length > 15) {
        return owner;
      }
    }
    
    return null;
  }
}

module.exports = { GoScraper };