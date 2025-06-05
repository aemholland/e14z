/**
 * Cargo Package Scraper Module
 * Extracts detailed MCP information from crates.io packages for Cargo installation
 */

const https = require('https');
const path = require('path');
const { AIEnhancedScraper } = require('./ai-enhanced-scraper');
const { WebScraper } = require('./web-scraper');

class CargoScraper {
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
   * Scrape detailed MCP information from crates.io package
   */
  async scrapeMCPPackage(packageInfo) {
    console.log(`🔍 Scraping Rust crate: ${packageInfo.name}`);

    try {
      // Get detailed crate info from crates.io
      const crateDetails = await this.getCrateDetails(packageInfo.name);
      
      // Get additional info from GitHub if available
      let githubInfo = null;
      const repoUrl = packageInfo.repository || crateDetails.crate.repository;
      if (repoUrl) {
        githubInfo = await this.getGitHubInfo(repoUrl);
      }

      // Enhanced documentation scraping with web scraper
      let webScrapedDocs = null;
      if (this.useWebScraper) {
        webScrapedDocs = await this.scrapeDocumentationSites(crateDetails, githubInfo);
      }

      // Extract MCP-specific information
      let mcpData;
      
      // Use AI-enhanced extraction if enabled
      if (this.useAI) {
        console.log(`   🤖 Using AI to analyze ${packageInfo.name}...`);
        const aiAnalysis = await this.aiScraper.analyzePackageWithAI(packageInfo, crateDetails, githubInfo, webScrapedDocs);
        
        // Transform AI analysis to mcpData format
        mcpData = {
          tools: aiAnalysis.tools || [],
          authMethod: aiAnalysis.authentication?.method || 'none',
          connectionType: 'stdio',
          protocolVersion: this.detectProtocolVersion(crateDetails),
          enhancedDescription: aiAnalysis.enhancedDescription,
          comprehensiveTags: aiAnalysis.comprehensiveTags,
          detailedUseCases: aiAnalysis.useCases,
          aiCategory: aiAnalysis.category,
          qualitySignals: aiAnalysis.qualitySignals
        };
      } else {
        // Fallback to traditional extraction
        mcpData = await this.extractMCPData(crateDetails, githubInfo);
      }

      return {
        // Basic package info
        name: packageInfo.name,
        slug: this.generateSlug(packageInfo.name, { repository: repoUrl }),
        description: mcpData.enhancedDescription || this.enhanceDescription(crateDetails, githubInfo, mcpData.tools) || crateDetails.crate.description || packageInfo.description,
        version: crateDetails.crate.newest_version,
        
        // Installation
        install_type: 'cargo',
        endpoint: this.extractInstallCommand(crateDetails),
        auto_install_command: this.extractInstallCommand(crateDetails),
        
        // MCP specific
        tools: mcpData.tools,
        auth_method: mcpData.authMethod,
        connection_type: mcpData.connectionType,
        protocol_version: mcpData.protocolVersion,
        
        // Categorization
        category: mcpData.aiCategory?.category || this.categorizePackage(crateDetails, mcpData.tools),
        tags: mcpData.comprehensiveTags || this.extractTags(crateDetails, mcpData),
        use_cases: mcpData.detailedUseCases || this.generateUseCases(mcpData.tools, crateDetails.crate.description),
        
        // Quality & Trust
        verified: false, // Will be validated later
        health_status: 'unknown',
        auto_discovered: true,
        discovery_source: 'crates.io',
        quality_score: mcpData.qualitySignals ? this.calculateAIQualityScore(mcpData.qualitySignals, crateDetails, githubInfo) : this.calculateQualityScore(crateDetails, githubInfo),
        
        // Links & Documentation
        github_url: this.extractGitHubUrl(repoUrl),
        documentation_url: this.extractDocumentationUrl(crateDetails, githubInfo),
        website_url: crateDetails.crate.homepage,
        
        // Author & License
        author: this.extractAuthor(crateDetails.versions[0]?.published_by || {}),
        company: this.extractCompany(crateDetails, githubInfo),
        license: this.extractLicense(crateDetails.versions[0]),
        
        // Rust specific
        keywords: crateDetails.crate.keywords || [],
        categories: crateDetails.crate.categories || [],
        downloads: crateDetails.crate.downloads,
        recent_downloads: crateDetails.crate.recent_downloads,
        
        // Pricing
        pricing_model: 'free', // Crates.io packages are free by default
        pricing_details: {},
        
        // Metadata
        created_at: crateDetails.crate.created_at,
        updated_at: crateDetails.crate.updated_at,
        last_scraped_at: new Date().toISOString(),
        
        // Raw data for debugging
        _raw_crate_data: {
          keywords: crateDetails.crate.keywords,
          categories: crateDetails.crate.categories,
          downloads: crateDetails.crate.downloads,
          versions_count: crateDetails.versions.length
        }
      };

    } catch (error) {
      console.error(`❌ Failed to scrape ${packageInfo.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get detailed crate information from crates.io API
   */
  async getCrateDetails(crateName) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'crates.io',
        path: `/api/v1/crates/${encodeURIComponent(crateName)}`,
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
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
              reject(new Error(`Crates.io API returned status ${res.statusCode}`));
              return;
            }
            
            const crateInfo = JSON.parse(data);
            resolve(crateInfo);
          } catch (error) {
            reject(new Error(`Failed to parse crate details: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Crate details request timed out'));
      });

      req.end();
    });
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
                  description: repoInfo.description,
                  topics: repoInfo.topics || [],
                  defaultBranch: repoInfo.default_branch,
                  owner: repoInfo.owner?.login,
                  isArchived: repoInfo.archived,
                  hasPages: repoInfo.has_pages
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
  async scrapeDocumentationSites(crateDetails, githubInfo) {
    if (!this.webScraper) return null;

    const urlsToScrape = [];
    
    // Add docs.rs URL (Rust documentation site)
    urlsToScrape.push(`https://docs.rs/${crateDetails.crate.name}`);
    
    // Add homepage
    if (crateDetails.crate.homepage) {
      urlsToScrape.push(crateDetails.crate.homepage);
    }

    // Add repository
    if (crateDetails.crate.repository) {
      urlsToScrape.push(crateDetails.crate.repository);
    }

    // Add GitHub README
    if (githubInfo && githubInfo.owner) {
      urlsToScrape.push(`https://raw.githubusercontent.com/${githubInfo.owner}/${crateDetails.crate.name}/main/README.md`);
      urlsToScrape.push(`https://raw.githubusercontent.com/${githubInfo.owner}/${crateDetails.crate.name}/master/README.md`);
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
   * Generate unique slug for the package
   */
  generateSlug(crateName, options = {}) {
    // Check if this is an official package
    const isOfficial = this.isOfficialPackage(crateName, options);
    
    if (isOfficial) {
      // Official: use clean slug without username
      return crateName.toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    } else {
      // Community: try to extract maintainer info for {package-name}-{username} format
      const maintainerInfo = this.extractMaintainerInfo(options);
      
      if (maintainerInfo) {
        const cleanCrateName = crateName.toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        const cleanUsername = maintainerInfo.toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        return `${cleanCrateName}-${cleanUsername}`;
      } else {
        // Fallback to crate name only
        return crateName.toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      }
    }
  }

  /**
   * Check if this is an official package
   */
  isOfficialPackage(crateName, options = {}) {
    const name = crateName.toLowerCase();
    
    // Official MCP packages (if they exist in Rust)
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
   * Extract maintainer information from repository URL
   */
  extractMaintainerInfo(options = {}) {
    const repoUrl = options.repository;
    if (!repoUrl) return null;
    
    try {
      const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
      if (match) {
        return match[1]; // GitHub username
      }
    } catch (error) {
      // Ignore parsing errors
    }
    
    return null;
  }

  /**
   * Extract installation command for cargo crate
   */
  extractInstallCommand(crateDetails) {
    const name = crateDetails.crate.name;
    return `cargo install ${name}`;
  }

  /**
   * Detect MCP protocol version from crate details
   */
  detectProtocolVersion(crateDetails) {
    const description = (crateDetails.crate.description || '').toLowerCase();
    
    // Look for version patterns in description
    const versionPatterns = [
      /protocol[:\s]+v?(\d{4}-\d{2}-\d{2})/,
      /mcp[:\s]+v?(\d{4}-\d{2}-\d{2})/,
      /version[:\s]+v?(\d{4}-\d{2}-\d{2})/
    ];
    
    for (const pattern of versionPatterns) {
      const match = description.match(pattern);
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
  async extractMCPData(crateDetails, githubInfo) {
    const tools = this.extractToolsFromDescription(crateDetails, githubInfo);
    
    return {
      tools,
      authMethod: this.detectAuthMethod(crateDetails),
      connectionType: 'stdio', // Default for Rust MCP servers
      protocolVersion: this.detectProtocolVersion(crateDetails)
    };
  }

  /**
   * Extract tools from crate description
   */
  extractToolsFromDescription(crateDetails, githubInfo) {
    const text = [
      crateDetails.crate.description || '',
      githubInfo?.description || ''
    ].join(' ').toLowerCase();

    const tools = [];
    
    // Common tool patterns
    const toolPatterns = [
      { pattern: /file|filesystem|directory/g, name: 'File System Access', description: 'Access and manipulate local files and directories' },
      { pattern: /database|sql|postgres|mysql|sqlite/g, name: 'Database Operations', description: 'Execute database queries and operations' },
      { pattern: /api|rest|http|request|client/g, name: 'API Client', description: 'Make HTTP requests and API calls' },
      { pattern: /search|query|find|index/g, name: 'Search Operations', description: 'Search and query external services' },
      { pattern: /email|mail|smtp/g, name: 'Email Operations', description: 'Send and manage email communications' },
      { pattern: /git|version control|repository/g, name: 'Git Operations', description: 'Interact with Git repositories' },
      { pattern: /calendar|schedule|event/g, name: 'Calendar Management', description: 'Manage calendar events and schedules' },
      { pattern: /chat|message|communication/g, name: 'Communication Tools', description: 'Send messages and communications' },
      { pattern: /crypto|encryption|hash/g, name: 'Cryptography', description: 'Cryptographic operations and security tools' },
      { pattern: /network|tcp|udp|socket/g, name: 'Network Operations', description: 'Network communication and socket operations' }
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
  detectAuthMethod(crateDetails) {
    const text = [
      crateDetails.crate.description || ''
    ].join(' ').toLowerCase();

    if (text.includes('api key') || text.includes('token')) return 'api_key';
    if (text.includes('oauth') || text.includes('auth')) return 'oauth';
    if (text.includes('username') && text.includes('password')) return 'basic_auth';
    
    return 'none';
  }

  /**
   * Enhanced description generation
   */
  enhanceDescription(crateDetails, githubInfo, tools) {
    let description = crateDetails.crate.description || '';
    
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
  categorizePackage(crateDetails, tools) {
    const text = [
      crateDetails.crate.description || ''
    ].join(' ').toLowerCase();

    // Category mapping
    const categories = {
      'productivity': ['calendar', 'email', 'note', 'task', 'schedule'],
      'development': ['git', 'code', 'development', 'api', 'database'],
      'communication': ['chat', 'message', 'slack', 'discord', 'mail'],
      'data': ['database', 'sql', 'data', 'analytics', 'query'],
      'file-management': ['file', 'filesystem', 'directory', 'storage'],
      'search': ['search', 'find', 'query', 'index'],
      'ai-ml': ['ai', 'machine learning', 'ml', 'neural', 'model'],
      'web': ['web', 'browser', 'http', 'html', 'scraping'],
      'security': ['crypto', 'encryption', 'security', 'hash', 'auth'],
      'network': ['network', 'tcp', 'udp', 'socket', 'protocol']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'utilities';
  }

  /**
   * Extract tags from crate information
   */
  extractTags(crateDetails, mcpData) {
    const tags = new Set();

    // Add language and package manager tags
    tags.add('rust');
    tags.add('cargo');

    // Add crate keywords
    if (crateDetails.crate.keywords) {
      crateDetails.crate.keywords.forEach(keyword => {
        if (keyword && keyword.length < 20) {
          tags.add(keyword.toLowerCase().replace(/\s+/g, '-'));
        }
      });
    }

    // Add crate categories
    if (crateDetails.crate.categories) {
      crateDetails.crate.categories.forEach(category => {
        if (category && category.length < 30) {
          tags.add(category.toLowerCase().replace(/\s+/g, '-'));
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
   * Calculate quality score
   */
  calculateQualityScore(crateDetails, githubInfo) {
    let score = 0;

    // Recent updates (20 points)
    if (this.isRecentlyUpdated(crateDetails.crate)) score += 20;
    
    // Has documentation (20 points)
    if (this.hasGoodDocumentation(crateDetails.crate)) score += 20;
    
    // Has repository (15 points)
    if (crateDetails.crate.repository) score += 15;
    
    // Download metrics (15 points)
    if (crateDetails.crate.downloads > 1000) score += 10;
    if (crateDetails.crate.recent_downloads > 100) score += 5;
    
    // Has proper description (15 points)
    if (crateDetails.crate.description && crateDetails.crate.description.length > 30) score += 15;
    
    // Has keywords/categories (10 points)
    if (crateDetails.crate.keywords && crateDetails.crate.keywords.length > 0) score += 5;
    if (crateDetails.crate.categories && crateDetails.crate.categories.length > 0) score += 5;
    
    // GitHub metrics (5 points)
    if (githubInfo) {
      if (githubInfo.stars > 10) score += 3;
      if (!githubInfo.isArchived) score += 2;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate AI-enhanced quality score
   */
  calculateAIQualityScore(qualitySignals, crateDetails, githubInfo) {
    // Use AI quality signals if available
    if (qualitySignals && qualitySignals.overallScore) {
      return Math.min(qualitySignals.overallScore, 100);
    }
    
    return this.calculateQualityScore(crateDetails, githubInfo);
  }

  /**
   * Helper methods
   */
  isRecentlyUpdated(crate) {
    if (!crate.updated_at) return false;
    
    const lastModified = new Date(crate.updated_at);
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    return lastModified > sixMonthsAgo;
  }

  hasGoodDocumentation(crate) {
    return !!(
      crate.documentation ||
      crate.repository ||
      crate.homepage ||
      (crate.description && crate.description.length > 200)
    );
  }

  extractGitHubUrl(repositoryUrl) {
    if (!repositoryUrl) return null;
    
    const match = repositoryUrl.match(/(https?:\/\/github\.com\/[\w-]+\/[\w-]+)/);
    return match ? match[1] : null;
  }

  extractDocumentationUrl(crateDetails, githubInfo) {
    // docs.rs is the standard Rust documentation site
    if (crateDetails.crate.name) {
      return `https://docs.rs/${crateDetails.crate.name}`;
    }
    
    // Fallback to homepage or repository
    return crateDetails.crate.homepage || this.extractGitHubUrl(crateDetails.crate.repository);
  }

  extractAuthor(versionInfo) {
    if (versionInfo && versionInfo.published_by && versionInfo.published_by.name) {
      return versionInfo.published_by.name;
    }
    
    return 'Unknown';
  }

  extractCompany(crateDetails, githubInfo) {
    // Use GitHub owner if it looks like a company
    if (githubInfo && githubInfo.owner) {
      const owner = githubInfo.owner;
      if (owner !== owner.toLowerCase() || owner.includes('-')) {
        return owner;
      }
    }
    
    return null;
  }

  extractLicense(versionInfo) {
    if (versionInfo && versionInfo.license) {
      return versionInfo.license;
    }
    
    return 'Unknown';
  }
}

module.exports = { CargoScraper };