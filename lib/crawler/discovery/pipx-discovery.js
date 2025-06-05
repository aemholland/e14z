/**
 * Pipx Package Discovery Module
 * Discovers MCP servers published on PyPI for Pipx installation
 */

const https = require('https');
const { URLSearchParams } = require('url');

class PipxDiscovery {
  constructor(options = {}) {
    this.pypiUrl = 'https://pypi.org';
    this.pypiApiUrl = 'https://pypi.org/pypi';
    this.searchApiUrl = 'https://pypi.org/simple';
    this.timeout = options.timeout || 30000;
    this.maxResults = options.maxResults || 500;
    this.userAgent = 'e14z-mcp-crawler/1.0.0';
  }

  /**
   * Discover MCP packages from PyPI registry
   */
  async discoverMCPs() {
    console.log('🔍 Starting Pipx MCP discovery...');
    
    const discoveryMethods = [
      () => this.searchByKeywords(),
      () => this.searchByDependency(),
      () => this.searchByNaming(),
      () => this.searchByClassifiers()
    ];

    let allPackages = new Set();
    
    for (const method of discoveryMethods) {
      try {
        const packages = await method();
        packages.forEach(pkg => allPackages.add(JSON.stringify(pkg)));
        console.log(`   Found ${packages.length} packages with current method`);
      } catch (error) {
        console.warn(`   Discovery method failed: ${error.message}`);
      }
    }

    // Deduplicate and parse back to objects
    const uniquePackages = Array.from(allPackages).map(pkg => JSON.parse(pkg));
    
    console.log(`✅ Pipx discovery complete: ${uniquePackages.length} unique packages found`);
    return uniquePackages;
  }

  /**
   * Search PyPI by checking known packages (more reliable than HTML scraping)
   */
  async searchByKeywords() {
    // Known packages that might be MCP servers or related to Anthropic/AI
    const knownPackages = [
      'anthropic',
      'openai',
      'anthropic-sdk',
      'claude-api',
      'mcp-server',
      'mcp-client',
      'model-context-protocol',
      'anthropic-tools',
      'claude-tools',
      'llm-tools',
      'ai-assistant',
      'chatbot-framework',
      'anthropic-mcp',
      'mcp-python',
      'llm-server',
      'ai-server',
      'anthropic-claude'
    ];

    let allResults = [];
    
    for (const packageName of knownPackages) {
      try {
        console.log(`   Checking package: ${packageName}`);
        const packageInfo = await this.getPackageDetails(packageName);
        
        if (packageInfo && this.isMCPPackage(packageInfo)) {
          allResults.push({
            name: packageInfo.info.name,
            description: packageInfo.info.summary,
            version: packageInfo.info.version,
            keywords: packageInfo.info.keywords?.split(',').map(k => k.trim()) || [],
            author: packageInfo.info.author || packageInfo.info.author_email,
            license: packageInfo.info.license,
            homepage: packageInfo.info.home_page,
            repository: packageInfo.info.project_urls?.Repository || packageInfo.info.project_urls?.Source,
            downloadUrl: packageInfo.info.download_url,
            requiresPython: packageInfo.info.requires_python,
            classifiers: packageInfo.info.classifiers || [],
            discoveryMethod: `known_package:${packageName}`
          });
          console.log(`   ✅ Found MCP package: ${packageInfo.info.name}`);
        } else if (packageInfo) {
          console.log(`   ❌ Not MCP: ${packageInfo.info.name} - ${packageInfo.info.summary}`);
        } else {
          console.log(`   ❌ Package not found: ${packageName}`);
        }
      } catch (error) {
        console.warn(`   Failed to check ${packageName}: ${error.message}`);
      }
    }

    console.log(`   Found ${allResults.length} MCP packages from known packages`);
    return allResults;
  }

  /**
   * Search packages that depend on MCP SDK
   */
  async searchByDependency() {
    try {
      // Search for packages that might depend on Python MCP libraries or be servers
      const mcpLibraries = [
        'anthropic',
        'openai',
        'requests', // Many MCP servers use requests
        'click',    // CLI frameworks often used for servers
        'fastapi',  // Web framework for API servers
        'uvicorn'   // ASGI server often used with MCP
      ];
      
      const dependentPackages = [];
      
      for (const library of mcpLibraries) {
        try {
          // Use PyPI search to find packages mentioning these libraries
          const results = await this.searchPyPIPackages(library);
          
          for (const packageName of results.slice(0, 20)) { // Limit to prevent overload
            try {
              const packageInfo = await this.getPackageDetails(packageName);
              
              if (this.hasMCPDependency(packageInfo) || this.isMCPPackage(packageInfo)) {
                dependentPackages.push({
                  name: packageInfo.info.name,
                  description: packageInfo.info.summary,
                  version: packageInfo.info.version,
                  keywords: packageInfo.info.keywords?.split(',').map(k => k.trim()) || [],
                  author: packageInfo.info.author || packageInfo.info.author_email,
                  license: packageInfo.info.license,
                  homepage: packageInfo.info.home_page,
                  repository: packageInfo.info.project_urls?.Repository || packageInfo.info.project_urls?.Source,
                  requiresPython: packageInfo.info.requires_python,
                  classifiers: packageInfo.info.classifiers || [],
                  discoveryMethod: `dependency:${library}`
                });
              }
            } catch (error) {
              console.warn(`   Failed to get details for ${packageName}: ${error.message}`);
            }
          }
        } catch (error) {
          console.warn(`   Dependency search failed for "${library}": ${error.message}`);
        }
      }

      console.log(`   Dependency search: ${dependentPackages.length} packages found`);
      return dependentPackages;
    } catch (error) {
      console.warn(`   Dependency search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Search by common MCP naming patterns
   */
  async searchByNaming() {
    const patterns = [
      'mcp-server-',
      'mcp-',
      '-mcp-server',
      '-mcp',
      'mcpserver',
      'mcp_server'
    ];

    let allResults = [];
    
    for (const pattern of patterns) {
      try {
        const results = await this.searchPyPIPackages(pattern);
        const mcpPackages = [];
        
        for (const packageName of results) {
          if (packageName.toLowerCase().includes(pattern.toLowerCase())) {
            try {
              const packageInfo = await this.getPackageDetails(packageName);
              if (this.isMCPPackage(packageInfo)) {
                mcpPackages.push({
                  name: packageInfo.info.name,
                  description: packageInfo.info.summary,
                  version: packageInfo.info.version,
                  keywords: packageInfo.info.keywords?.split(',').map(k => k.trim()) || [],
                  author: packageInfo.info.author || packageInfo.info.author_email,
                  license: packageInfo.info.license,
                  homepage: packageInfo.info.home_page,
                  repository: packageInfo.info.project_urls?.Repository || packageInfo.info.project_urls?.Source,
                  requiresPython: packageInfo.info.requires_python,
                  classifiers: packageInfo.info.classifiers || [],
                  discoveryMethod: `naming:${pattern}`
                });
              }
            } catch (error) {
              console.warn(`   Failed to get details for ${packageName}: ${error.message}`);
            }
          }
        }
        
        allResults.push(...mcpPackages);
        console.log(`   Pattern "${pattern}": ${mcpPackages.length} packages`);
      } catch (error) {
        console.warn(`   Pattern search failed for "${pattern}": ${error.message}`);
      }
    }

    return allResults;
  }

  /**
   * Search by PyPI classifiers
   */
  async searchByClassifiers() {
    try {
      // Search for packages with relevant classifiers
      const classifierKeywords = [
        'server',
        'protocol',
        'anthropic',
        'claude',
        'ai',
        'automation'
      ];
      
      let allResults = [];
      
      for (const keyword of classifierKeywords) {
        try {
          const results = await this.searchPyPIPackages(keyword);
          const mcpPackages = [];
          
          for (const packageName of results.slice(0, 15)) { // Limit search
            try {
              const packageInfo = await this.getPackageDetails(packageName);
              if (this.hasMCPClassifiers(packageInfo) || this.isMCPPackage(packageInfo)) {
                mcpPackages.push({
                  name: packageInfo.info.name,
                  description: packageInfo.info.summary,
                  version: packageInfo.info.version,
                  keywords: packageInfo.info.keywords?.split(',').map(k => k.trim()) || [],
                  author: packageInfo.info.author || packageInfo.info.author_email,
                  license: packageInfo.info.license,
                  homepage: packageInfo.info.home_page,
                  repository: packageInfo.info.project_urls?.Repository || packageInfo.info.project_urls?.Source,
                  requiresPython: packageInfo.info.requires_python,
                  classifiers: packageInfo.info.classifiers || [],
                  discoveryMethod: `classifiers:${keyword}`
                });
              }
            } catch (error) {
              console.warn(`   Failed to get details for ${packageName}: ${error.message}`);
            }
          }
          
          allResults.push(...mcpPackages);
          console.log(`   Classifier "${keyword}": ${mcpPackages.length} packages`);
        } catch (error) {
          console.warn(`   Classifier search failed for "${keyword}": ${error.message}`);
        }
      }
      
      return allResults;
    } catch (error) {
      console.warn(`   Classifier search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Search PyPI packages using a simple text search
   * Note: PyPI doesn't have a full-text search API, so we use warehouse search
   */
  async searchPyPIPackages(query) {
    return new Promise((resolve, reject) => {
      const encodedQuery = encodeURIComponent(query);
      const options = {
        hostname: 'pypi.org',
        path: `/search/?q=${encodedQuery}`,
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
            // Parse HTML to extract package names
            const packageNames = this.extractPackageNamesFromHTML(data);
            resolve(packageNames);
          } catch (error) {
            reject(new Error(`Failed to parse PyPI search response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('PyPI search request timed out'));
      });

      req.end();
    });
  }

  /**
   * Extract package names from PyPI search HTML
   */
  extractPackageNamesFromHTML(html) {
    const packageNames = [];
    const packagePattern = /href="\/project\/([^\/]+)\//g;
    let match;
    
    while ((match = packagePattern.exec(html)) !== null) {
      const packageName = match[1];
      if (packageName && !packageNames.includes(packageName)) {
        packageNames.push(packageName);
      }
    }
    
    return packageNames.slice(0, 50); // Limit results
  }

  /**
   * Get detailed package information from PyPI API
   */
  async getPackageDetails(packageName) {
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
            const packageInfo = JSON.parse(data);
            resolve(packageInfo);
          } catch (error) {
            reject(new Error(`Failed to parse package details: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Package details request timed out'));
      });

      req.end();
    });
  }

  /**
   * Check if a package is likely an MCP server
   */
  isMCPPackage(packageInfo) {
    const name = (packageInfo.info.name || '').toLowerCase();
    const description = (packageInfo.info.summary || '').toLowerCase();
    const keywords = (packageInfo.info.keywords || '').toLowerCase();
    const classifiers = (packageInfo.info.classifiers || []).map(c => c.toLowerCase());
    const longDescription = (packageInfo.info.description || '').toLowerCase().substring(0, 500);

    // Strong indicators for MCP packages
    const strongIndicators = [
      'mcp',
      'model context protocol',
      'model-context-protocol',
      'anthropic',
      'claude'
    ];

    // Check all text fields
    const allText = `${name} ${description} ${keywords} ${longDescription}`;
    for (const indicator of strongIndicators) {
      if (allText.includes(indicator)) {
        return true;
      }
    }

    // Check for server/tool patterns with AI terms
    const serverPatterns = ['server', 'tool', 'cli', 'agent', 'service', 'bot'];
    const aiPatterns = ['ai', 'llm', 'gpt', 'assistant', 'automation', 'intelligence'];
    
    const hasServerPattern = serverPatterns.some(pattern => allText.includes(pattern));
    const hasAIPattern = aiPatterns.some(pattern => allText.includes(pattern));

    // Console script indicators (good for pipx)
    const hasConsoleScript = classifiers.some(c => 
      c.includes('console_scripts') || c.includes('environment :: console')
    );

    // Must have some indicators and not be obviously unrelated
    const excludePatterns = [
      'web framework', 'deep learning', 'machine learning model',
      'tensorflow', 'pytorch', 'scikit', 'pandas', 'numpy'
    ];

    const isExcluded = excludePatterns.some(pattern => 
      description.includes(pattern) || longDescription.includes(pattern)
    );

    // More lenient: include if has server pattern + AI OR has console scripts + AI
    return ((hasServerPattern && hasAIPattern) || (hasConsoleScript && hasAIPattern)) && !isExcluded;
  }

  /**
   * Check if package has MCP-related classifiers
   */
  hasMCPClassifiers(packageInfo) {
    const classifiers = (packageInfo.info.classifiers || []).map(c => c.toLowerCase());
    
    const mcpRelatedClassifiers = [
      'intended audience :: developers',
      'topic :: software development',
      'topic :: internet',
      'topic :: communications',
      'topic :: software development :: libraries :: python modules'
    ];

    return mcpRelatedClassifiers.some(classifier => 
      classifiers.some(c => c.includes(classifier))
    );
  }

  /**
   * Check if package has MCP SDK dependency
   */
  hasMCPDependency(packageInfo) {
    // PyPI doesn't expose dependencies in the JSON API like NPM does
    // We'd need to download and parse the wheel/sdist to get requirements
    // For now, we'll rely on description and naming patterns
    
    const description = (packageInfo.info.summary || '').toLowerCase();
    const longDescription = (packageInfo.info.description || '').toLowerCase();
    
    const mcpDependencyKeywords = [
      'anthropic',
      'model-context-protocol',
      'mcp-sdk',
      'claude',
      'requires.*mcp'
    ];

    return mcpDependencyKeywords.some(keyword => 
      description.includes(keyword) || longDescription.includes(keyword)
    );
  }

  /**
   * Extract installation command for pipx package
   */
  extractInstallCommand(packageInfo) {
    const name = packageInfo.info.name;
    return `pipx install ${name}`;
  }

  /**
   * Get package statistics and quality indicators
   */
  async getPackageStats(packageName) {
    try {
      const packageInfo = await this.getPackageDetails(packageName);
      
      return {
        hasRecentUpdate: this.isRecentlyUpdated(packageInfo),
        hasGoodDocumentation: this.hasGoodDocumentation(packageInfo),
        qualityScore: this.calculateQualityScore(packageInfo)
      };
    } catch (error) {
      return {
        hasRecentUpdate: false,
        hasGoodDocumentation: false,
        qualityScore: 0
      };
    }
  }

  isRecentlyUpdated(packageInfo) {
    if (!packageInfo.info.upload_time && !packageInfo.urls?.[0]?.upload_time) return false;
    
    const uploadTime = packageInfo.info.upload_time || packageInfo.urls[0].upload_time;
    const lastModified = new Date(uploadTime);
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    return lastModified > sixMonthsAgo;
  }

  hasGoodDocumentation(packageInfo) {
    return !!(
      packageInfo.info.description && packageInfo.info.description.length > 200 ||
      packageInfo.info.project_urls?.Documentation ||
      packageInfo.info.home_page ||
      packageInfo.info.project_urls?.Repository
    );
  }

  calculateQualityScore(packageInfo) {
    let score = 0;
    
    // Recent updates
    if (this.isRecentlyUpdated(packageInfo)) score += 20;
    
    // Has documentation
    if (this.hasGoodDocumentation(packageInfo)) score += 20;
    
    // Has repository or homepage
    if (packageInfo.info.project_urls?.Repository || packageInfo.info.home_page) score += 15;
    
    // Has license
    if (packageInfo.info.license && packageInfo.info.license !== 'UNKNOWN') score += 10;
    
    // Has proper description
    if (packageInfo.info.summary && packageInfo.info.summary.length > 30) score += 15;
    
    // Has keywords
    if (packageInfo.info.keywords && packageInfo.info.keywords.length > 0) score += 10;
    
    // Has proper version (not 0.0.x)
    if (packageInfo.info.version && !packageInfo.info.version.startsWith('0.0.')) score += 10;
    
    return Math.min(score, 100);
  }
}

module.exports = { PipxDiscovery };