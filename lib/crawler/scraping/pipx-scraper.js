/**
 * Pipx Package Scraper Module
 * Extracts detailed MCP information from PyPI packages for Pipx installation
 */

const https = require('https');
const path = require('path');
const { AIEnhancedScraper } = require('./ai-enhanced-scraper');
const { WebScraper } = require('./web-scraper');

class PipxScraper {
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
   * Scrape detailed MCP information from PyPI package
   */
  async scrapeMCPPackage(packageInfo) {
    console.log(`🔍 Scraping Python package: ${packageInfo.name}`);

    try {
      // Get detailed package info from PyPI
      const pypiDetails = await this.getPyPIPackageDetails(packageInfo.name);
      
      // Get additional info from GitHub if available
      let githubInfo = null;
      const repoUrl = packageInfo.repository || pypiDetails.info.project_urls?.Repository || pypiDetails.info.project_urls?.Source;
      if (repoUrl) {
        githubInfo = await this.getGitHubInfo(repoUrl);
      }

      // Enhanced documentation scraping with web scraper
      let webScrapedDocs = null;
      if (this.useWebScraper) {
        webScrapedDocs = await this.scrapeDocumentationSites(pypiDetails, githubInfo);
      }

      // Extract MCP-specific information
      let mcpData;
      
      // Use AI-enhanced extraction if enabled
      if (this.useAI) {
        console.log(`   🤖 Using AI to analyze ${packageInfo.name}...`);
        const aiAnalysis = await this.aiScraper.analyzePackageWithAI(packageInfo, pypiDetails, githubInfo, webScrapedDocs);
        
        // Transform AI analysis to mcpData format
        mcpData = {
          tools: aiAnalysis.tools || [],
          authMethod: aiAnalysis.authentication?.method || 'none',
          connectionType: 'stdio',
          protocolVersion: this.detectProtocolVersion(pypiDetails),
          enhancedDescription: aiAnalysis.enhancedDescription,
          comprehensiveTags: aiAnalysis.comprehensiveTags,
          detailedUseCases: aiAnalysis.useCases,
          aiCategory: aiAnalysis.category,
          qualitySignals: aiAnalysis.qualitySignals
        };
      } else {
        // Fallback to traditional extraction
        mcpData = await this.extractMCPData(pypiDetails, githubInfo);
      }

      return {
        // Basic package info
        name: packageInfo.name,
        slug: this.generateSlug(packageInfo.name, { repository: repoUrl }),
        description: mcpData.enhancedDescription || this.enhanceDescription(pypiDetails, githubInfo, mcpData.tools) || pypiDetails.info.summary || packageInfo.description,
        version: pypiDetails.info.version,
        
        // Installation
        install_type: 'pipx',
        endpoint: this.extractInstallCommand(pypiDetails),
        auto_install_command: this.extractInstallCommand(pypiDetails),
        
        // MCP specific
        tools: mcpData.tools,
        auth_method: mcpData.authMethod,
        connection_type: mcpData.connectionType,
        protocol_version: mcpData.protocolVersion,
        
        // Categorization
        category: mcpData.aiCategory?.category || this.categorizePackage(pypiDetails, mcpData.tools),
        tags: mcpData.comprehensiveTags || this.extractTags(pypiDetails, mcpData),
        use_cases: mcpData.detailedUseCases || this.generateUseCases(mcpData.tools, pypiDetails.info.summary),
        
        // Quality & Trust
        verified: false, // Will be validated later
        health_status: 'unknown',
        auto_discovered: true,
        discovery_source: 'pypi',
        quality_score: mcpData.qualitySignals ? this.calculateAIQualityScore(mcpData.qualitySignals, pypiDetails, githubInfo) : this.calculateQualityScore(pypiDetails, githubInfo),
        
        // Links & Documentation
        github_url: this.extractGitHubUrl(repoUrl),
        documentation_url: this.extractDocumentationUrl(pypiDetails, githubInfo),
        website_url: pypiDetails.info.home_page,
        
        // Author & License
        author: this.extractAuthor(pypiDetails.info.author, pypiDetails.info.author_email),
        company: this.extractCompany(pypiDetails, githubInfo),
        license: pypiDetails.info.license || 'Unknown',
        
        // Python specific
        requires_python: pypiDetails.info.requires_python,
        classifiers: pypiDetails.info.classifiers || [],
        
        // Pricing
        pricing_model: 'free', // PyPI packages are free by default
        pricing_details: {},
        
        // Metadata
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_scraped_at: new Date().toISOString(),
        
        // Raw data for debugging
        _raw_pypi_data: {
          keywords: pypiDetails.info.keywords,
          classifiers: pypiDetails.info.classifiers,
          project_urls: pypiDetails.info.project_urls,
          requires_python: pypiDetails.info.requires_python
        }
      };

    } catch (error) {
      console.error(`❌ Failed to scrape ${packageInfo.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get detailed package information from PyPI API
   */
  async getPyPIPackageDetails(packageName) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'pypi.org',
        path: `/pypi/${encodeURIComponent(packageName)}/json`,
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
              reject(new Error(`PyPI API returned status ${res.statusCode}`));
              return;
            }
            
            const packageInfo = JSON.parse(data);
            resolve(packageInfo);
          } catch (error) {
            reject(new Error(`Failed to parse PyPI package details: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('PyPI package details request timed out'));
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
                  isArchived: repoInfo.archived
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
  async scrapeDocumentationSites(pypiDetails, githubInfo) {
    if (!this.webScraper) return null;

    const urlsToScrape = [];
    
    // Add PyPI project URLs
    if (pypiDetails.info.project_urls) {
      Object.values(pypiDetails.info.project_urls).forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('http')) {
          urlsToScrape.push(url);
        }
      });
    }

    // Add homepage
    if (pypiDetails.info.home_page) {
      urlsToScrape.push(pypiDetails.info.home_page);
    }

    // Add GitHub README
    if (githubInfo && githubInfo.owner) {
      urlsToScrape.push(`https://raw.githubusercontent.com/${githubInfo.owner}/${pypiDetails.info.name}/main/README.md`);
      urlsToScrape.push(`https://raw.githubusercontent.com/${githubInfo.owner}/${pypiDetails.info.name}/master/README.md`);
    }

    try {
      const scrapedContent = [];
      
      for (const url of urlsToScrape.slice(0, 3)) { // Limit to prevent overload
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
  generateSlug(packageName, options = {}) {
    // Check if this is an official package (official MCP packages or well-known services)
    const isOfficial = this.isOfficialPackage(packageName, options);
    
    if (isOfficial) {
      // Official: use clean slug without username
      return packageName.toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    } else {
      // Community: try to extract maintainer info for {package-name}-{username} format
      const maintainerInfo = this.extractMaintainerInfo(options);
      
      if (maintainerInfo) {
        const cleanPackageName = packageName.toLowerCase()
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
        return packageName.toLowerCase()
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
    
    // Official MCP packages
    const officialMCPPackages = [
      'mcp-server-filesystem',
      'mcp-server-git',
      'mcp-server-postgres',
      'mcp-server-brave-search'
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
   * Extract installation command for pipx package
   */
  extractInstallCommand(pypiDetails) {
    const name = pypiDetails.info.name;
    return `pipx install ${name}`;
  }

  /**
   * Detect MCP protocol version from package details
   */
  detectProtocolVersion(pypiDetails) {
    const description = (pypiDetails.info.description || '').toLowerCase();
    const summary = (pypiDetails.info.summary || '').toLowerCase();
    
    // Look for version patterns in description
    const versionPatterns = [
      /protocol[:\s]+v?(\d{4}-\d{2}-\d{2})/,
      /mcp[:\s]+v?(\d{4}-\d{2}-\d{2})/,
      /version[:\s]+v?(\d{4}-\d{2}-\d{2})/
    ];
    
    for (const pattern of versionPatterns) {
      const match = description.match(pattern) || summary.match(pattern);
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
  async extractMCPData(pypiDetails, githubInfo) {
    const tools = this.extractToolsFromDescription(pypiDetails, githubInfo);
    
    return {
      tools,
      authMethod: this.detectAuthMethod(pypiDetails),
      connectionType: 'stdio', // Default for Python MCP servers
      protocolVersion: this.detectProtocolVersion(pypiDetails)
    };
  }

  /**
   * Extract tools from package description
   */
  extractToolsFromDescription(pypiDetails, githubInfo) {
    const text = [
      pypiDetails.info.summary || '',
      pypiDetails.info.description || '',
      githubInfo?.description || ''
    ].join(' ').toLowerCase();

    const tools = [];
    
    // Common tool patterns
    const toolPatterns = [
      { pattern: /file|filesystem|directory/g, name: 'File System Access', description: 'Access and manipulate local files and directories' },
      { pattern: /database|sql|postgres|mysql/g, name: 'Database Operations', description: 'Execute database queries and operations' },
      { pattern: /api|rest|http|request/g, name: 'API Client', description: 'Make HTTP requests and API calls' },
      { pattern: /search|query|find/g, name: 'Search Operations', description: 'Search and query external services' },
      { pattern: /email|mail|smtp/g, name: 'Email Operations', description: 'Send and manage email communications' },
      { pattern: /git|version control|repository/g, name: 'Git Operations', description: 'Interact with Git repositories' },
      { pattern: /calendar|schedule|event/g, name: 'Calendar Management', description: 'Manage calendar events and schedules' },
      { pattern: /chat|message|communication/g, name: 'Communication Tools', description: 'Send messages and communications' }
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
  detectAuthMethod(pypiDetails) {
    const text = [
      pypiDetails.info.summary || '',
      pypiDetails.info.description || ''
    ].join(' ').toLowerCase();

    if (text.includes('api key') || text.includes('token')) return 'api_key';
    if (text.includes('oauth') || text.includes('auth')) return 'oauth';
    if (text.includes('username') && text.includes('password')) return 'basic_auth';
    
    return 'none';
  }

  /**
   * Enhanced description generation
   */
  enhanceDescription(pypiDetails, githubInfo, tools) {
    let description = pypiDetails.info.summary || '';
    
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
  categorizePackage(pypiDetails, tools) {
    const text = [
      pypiDetails.info.summary || '',
      pypiDetails.info.description || ''
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
      'web': ['web', 'browser', 'http', 'html', 'scraping']
    };

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
  extractTags(pypiDetails, mcpData) {
    const tags = new Set();

    // Add language tag
    tags.add('python');
    tags.add('pipx');

    // Add classifier-based tags
    if (pypiDetails.info.classifiers) {
      pypiDetails.info.classifiers.forEach(classifier => {
        if (classifier.includes('Topic ::')) {
          const topic = classifier.split('::').pop().trim().toLowerCase();
          if (topic && topic.length < 20) {
            tags.add(topic.replace(/\s+/g, '-'));
          }
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

    return Array.from(tags).slice(0, 10); // Limit tags
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
  calculateQualityScore(pypiDetails, githubInfo) {
    let score = 0;

    // Recent updates (20 points)
    if (this.isRecentlyUpdated(pypiDetails)) score += 20;
    
    // Has documentation (20 points)
    if (this.hasGoodDocumentation(pypiDetails)) score += 20;
    
    // Has repository (15 points)
    if (pypiDetails.info.project_urls?.Repository || pypiDetails.info.home_page) score += 15;
    
    // Has license (10 points)
    if (pypiDetails.info.license && pypiDetails.info.license !== 'UNKNOWN') score += 10;
    
    // Has proper description (15 points)
    if (pypiDetails.info.summary && pypiDetails.info.summary.length > 30) score += 15;
    
    // Has classifiers (10 points)
    if (pypiDetails.info.classifiers && pypiDetails.info.classifiers.length > 3) score += 10;
    
    // GitHub metrics (10 points)
    if (githubInfo) {
      if (githubInfo.stars > 10) score += 5;
      if (!githubInfo.isArchived) score += 5;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate AI-enhanced quality score
   */
  calculateAIQualityScore(qualitySignals, pypiDetails, githubInfo) {
    // Use AI quality signals if available
    if (qualitySignals && qualitySignals.overallScore) {
      return Math.min(qualitySignals.overallScore, 100);
    }
    
    return this.calculateQualityScore(pypiDetails, githubInfo);
  }

  /**
   * Helper methods
   */
  isRecentlyUpdated(pypiDetails) {
    const uploadTime = pypiDetails.info.upload_time || pypiDetails.urls?.[0]?.upload_time;
    if (!uploadTime) return false;
    
    const lastModified = new Date(uploadTime);
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    return lastModified > sixMonthsAgo;
  }

  hasGoodDocumentation(pypiDetails) {
    return !!(
      pypiDetails.info.description && pypiDetails.info.description.length > 200 ||
      pypiDetails.info.project_urls?.Documentation ||
      pypiDetails.info.home_page ||
      pypiDetails.info.project_urls?.Repository
    );
  }

  extractGitHubUrl(repositoryUrl) {
    if (!repositoryUrl) return null;
    
    const match = repositoryUrl.match(/(https?:\/\/github\.com\/[\w-]+\/[\w-]+)/);
    return match ? match[1] : null;
  }

  extractDocumentationUrl(pypiDetails, githubInfo) {
    // Check for explicit documentation URL
    if (pypiDetails.info.project_urls?.Documentation) {
      return pypiDetails.info.project_urls.Documentation;
    }
    
    // Check for docs in project URLs
    const projectUrls = pypiDetails.info.project_urls || {};
    for (const [key, url] of Object.entries(projectUrls)) {
      if (key.toLowerCase().includes('doc')) {
        return url;
      }
    }
    
    // Fallback to homepage or repository
    return pypiDetails.info.home_page || this.extractGitHubUrl(projectUrls.Repository);
  }

  extractAuthor(author, authorEmail) {
    if (author && author !== 'UNKNOWN') {
      return author;
    }
    
    if (authorEmail) {
      return authorEmail.split('@')[0]; // Extract name part from email
    }
    
    return 'Unknown';
  }

  extractCompany(pypiDetails, githubInfo) {
    // Try to extract company from author field
    const author = pypiDetails.info.author;
    if (author && (author.includes('Inc') || author.includes('Corp') || author.includes('LLC'))) {
      return author;
    }
    
    // Use GitHub owner if it looks like a company
    if (githubInfo && githubInfo.owner) {
      const owner = githubInfo.owner;
      if (owner !== owner.toLowerCase() || owner.includes('-')) {
        return owner;
      }
    }
    
    return null;
  }
}

module.exports = { PipxScraper };