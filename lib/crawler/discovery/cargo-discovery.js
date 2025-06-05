/**
 * Cargo Package Discovery Module
 * Discovers MCP servers published on crates.io for Cargo installation
 */

const https = require('https');
const { URLSearchParams } = require('url');

class CargoDiscovery {
  constructor(options = {}) {
    this.cratesUrl = 'https://crates.io';
    this.apiUrl = 'https://crates.io/api/v1';
    this.timeout = options.timeout || 30000;
    this.maxResults = options.maxResults || 500;
    this.userAgent = 'e14z-mcp-crawler/1.0.0';
  }

  /**
   * Discover MCP packages from crates.io registry
   */
  async discoverMCPs() {
    console.log('🔍 Starting Cargo MCP discovery...');
    
    const discoveryMethods = [
      () => this.searchByKeywords(),
      () => this.searchByCategories(),
      () => this.searchByNaming(),
      () => this.searchByDependency()
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
    
    console.log(`✅ Cargo discovery complete: ${uniquePackages.length} unique packages found`);
    return uniquePackages;
  }

  /**
   * Search crates.io by MCP-related keywords
   */
  async searchByKeywords() {
    const keywords = [
      'mcp-server',
      'model-context-protocol', 
      'mcp protocol',
      'anthropic mcp',
      'mcp tools',
      'claude mcp',
      'mcp rust',
      'server protocol'
    ];

    let allResults = [];
    
    for (const keyword of keywords) {
      try {
        const results = await this.searchCratesAPI(keyword);
        const mcpPackages = results.crates
          .filter(crate => this.isMCPPackage(crate))
          .map(crate => ({
            name: crate.name,
            description: crate.description,
            version: crate.newest_version,
            keywords: crate.keywords || [],
            categories: crate.categories || [],
            repository: crate.repository,
            homepage: crate.homepage,
            documentation: crate.documentation,
            downloads: crate.downloads,
            recentDownloads: crate.recent_downloads,
            maxVersion: crate.max_version,
            created: crate.created_at,
            updated: crate.updated_at,
            discoveryMethod: `keyword:${keyword}`
          }));
        
        allResults.push(...mcpPackages);
        console.log(`   Keyword "${keyword}": ${mcpPackages.length} MCP packages`);
      } catch (error) {
        console.warn(`   Keyword search failed for "${keyword}": ${error.message}`);
      }
    }

    return allResults;
  }

  /**
   * Search by crates.io categories
   */
  async searchByCategories() {
    const relevantCategories = [
      'network-programming',
      'command-line-utilities',
      'api-bindings',
      'development-tools',
      'web-programming',
      'database',
      'filesystem'
    ];

    let allResults = [];
    
    for (const category of relevantCategories) {
      try {
        const results = await this.searchCratesByCategory(category);
        const mcpPackages = results.crates
          .filter(crate => this.isMCPPackage(crate))
          .map(crate => ({
            name: crate.name,
            description: crate.description,
            version: crate.newest_version,
            keywords: crate.keywords || [],
            categories: crate.categories || [],
            repository: crate.repository,
            homepage: crate.homepage,
            documentation: crate.documentation,
            downloads: crate.downloads,
            recentDownloads: crate.recent_downloads,
            maxVersion: crate.max_version,
            created: crate.created_at,
            updated: crate.updated_at,
            discoveryMethod: `category:${category}`
          }));
        
        allResults.push(...mcpPackages);
        console.log(`   Category "${category}": ${mcpPackages.length} packages`);
      } catch (error) {
        console.warn(`   Category search failed for "${category}": ${error.message}`);
      }
    }

    return allResults;
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
        const results = await this.searchCratesAPI(pattern);
        const mcpPackages = results.crates
          .filter(crate => crate.name.toLowerCase().includes(pattern.toLowerCase()) && this.isMCPPackage(crate))
          .map(crate => ({
            name: crate.name,
            description: crate.description,
            version: crate.newest_version,
            keywords: crate.keywords || [],
            categories: crate.categories || [],
            repository: crate.repository,
            homepage: crate.homepage,
            documentation: crate.documentation,
            downloads: crate.downloads,
            recentDownloads: crate.recent_downloads,
            maxVersion: crate.max_version,
            created: crate.created_at,
            updated: crate.updated_at,
            discoveryMethod: `naming:${pattern}`
          }));
        
        allResults.push(...mcpPackages);
        console.log(`   Pattern "${pattern}": ${mcpPackages.length} packages`);
      } catch (error) {
        console.warn(`   Pattern search failed for "${pattern}": ${error.message}`);
      }
    }

    return allResults;
  }

  /**
   * Search packages that depend on MCP-related crates
   */
  async searchByDependency() {
    try {
      // Search for packages that might depend on Rust MCP libraries
      const mcpCrates = [
        'mcp',
        'model-context-protocol',
        'anthropic',
        'tokio', // Many async servers use tokio
        'serde_json', // JSON-RPC communication
        'jsonrpc'
      ];
      
      const dependentPackages = [];
      
      for (const crateName of mcpCrates) {
        try {
          // Search for crates mentioning these dependencies
          const results = await this.searchCratesAPI(crateName);
          
          for (const crate of results.crates.slice(0, 20)) { // Limit to prevent overload
            if (this.hasMCPDependency(crate) || this.isMCPPackage(crate)) {
              dependentPackages.push({
                name: crate.name,
                description: crate.description,
                version: crate.newest_version,
                keywords: crate.keywords || [],
                categories: crate.categories || [],
                repository: crate.repository,
                homepage: crate.homepage,
                documentation: crate.documentation,
                downloads: crate.downloads,
                recentDownloads: crate.recent_downloads,
                maxVersion: crate.max_version,
                created: crate.created_at,
                updated: crate.updated_at,
                discoveryMethod: `dependency:${crateName}`
              });
            }
          }
        } catch (error) {
          console.warn(`   Dependency search failed for "${crateName}": ${error.message}`);
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
   * Search crates.io API
   */
  async searchCratesAPI(query, perPage = 50) {
    return new Promise((resolve, reject) => {
      const searchParams = new URLSearchParams({
        q: query,
        per_page: Math.min(perPage, 100), // crates.io limits
        sort: 'downloads'
      });

      const options = {
        hostname: 'crates.io',
        path: `/api/v1/crates?${searchParams}`,
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
            
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse crates.io search response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Crates.io search request timed out'));
      });

      req.end();
    });
  }

  /**
   * Search crates by category
   */
  async searchCratesByCategory(category, perPage = 50) {
    return new Promise((resolve, reject) => {
      const searchParams = new URLSearchParams({
        category: category,
        per_page: Math.min(perPage, 100),
        sort: 'downloads'
      });

      const options = {
        hostname: 'crates.io',
        path: `/api/v1/crates?${searchParams}`,
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
            
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse crates.io category response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Crates.io category request timed out'));
      });

      req.end();
    });
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
   * Check if a crate is likely an MCP server
   */
  isMCPPackage(crate) {
    const name = (crate.name || '').toLowerCase();
    const description = (crate.description || '').toLowerCase();
    const keywords = (crate.keywords || []).map(k => k.toLowerCase());
    const categories = (crate.categories || []).map(c => c.toLowerCase());

    // Strong indicators
    const strongIndicators = [
      'mcp-server',
      'mcp server',
      'model context protocol',
      'model-context-protocol',
      'anthropic mcp',
      'claude server',
      'mcp tools'
    ];

    // Check name and description
    for (const indicator of strongIndicators) {
      if (name.includes(indicator) || description.includes(indicator)) {
        return true;
      }
    }

    // Check keywords for MCP-related terms
    const mcpKeywords = ['mcp', 'model-context-protocol', 'anthropic', 'claude', 'server', 'protocol'];
    const hasRelevantKeywords = keywords.some(keyword => 
      mcpKeywords.some(mcpKeyword => keyword.includes(mcpKeyword))
    );

    // Check categories for relevant ones
    const relevantCategories = ['network-programming', 'command-line-utilities', 'api-bindings'];
    const hasRelevantCategories = categories.some(category => 
      relevantCategories.includes(category)
    );

    // Server patterns in description
    const serverPatterns = ['server', 'daemon', 'service', 'cli', 'tool'];
    const hasServerPattern = serverPatterns.some(pattern => 
      description.includes(pattern)
    );

    // Must have some MCP indicators and not be obviously unrelated
    const excludePatterns = [
      'test', 'example', 'demo', 'template', 'boilerplate',
      'game', 'graphics', 'ui', 'web framework', 'orm'
    ];

    const isExcluded = excludePatterns.some(pattern => 
      name.includes(pattern) || description.includes(pattern)
    );

    return (hasRelevantKeywords || (hasRelevantCategories && hasServerPattern)) && !isExcluded;
  }

  /**
   * Check if crate has MCP-related dependencies
   */
  hasMCPDependency(crate) {
    // crates.io API doesn't expose dependencies in search results
    // We'd need to fetch the Cargo.toml to check dependencies
    // For now, we'll rely on description and naming patterns
    
    const description = (crate.description || '').toLowerCase();
    const keywords = (crate.keywords || []).map(k => k.toLowerCase());
    
    const mcpDependencyKeywords = [
      'anthropic',
      'model-context-protocol',
      'mcp-sdk',
      'claude',
      'jsonrpc',
      'tokio',
      'serde'
    ];

    return mcpDependencyKeywords.some(keyword => 
      description.includes(keyword) || keywords.includes(keyword)
    );
  }

  /**
   * Extract installation command for cargo crate
   */
  extractInstallCommand(crate) {
    const name = crate.name;
    return `cargo install ${name}`;
  }

  /**
   * Get crate statistics and quality indicators
   */
  async getCrateStats(crateName) {
    try {
      const crateInfo = await this.getCrateDetails(crateName);
      
      return {
        hasRecentUpdate: this.isRecentlyUpdated(crateInfo.crate),
        hasGoodDocumentation: this.hasGoodDocumentation(crateInfo.crate),
        qualityScore: this.calculateQualityScore(crateInfo.crate)
      };
    } catch (error) {
      return {
        hasRecentUpdate: false,
        hasGoodDocumentation: false,
        qualityScore: 0
      };
    }
  }

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

  calculateQualityScore(crate) {
    let score = 0;
    
    // Recent updates
    if (this.isRecentlyUpdated(crate)) score += 20;
    
    // Has documentation
    if (this.hasGoodDocumentation(crate)) score += 20;
    
    // Has repository
    if (crate.repository) score += 15;
    
    // Download metrics
    if (crate.downloads > 1000) score += 10;
    if (crate.recent_downloads > 100) score += 5;
    
    // Has proper description
    if (crate.description && crate.description.length > 30) score += 15;
    
    // Has keywords
    if (crate.keywords && crate.keywords.length > 0) score += 10;
    
    // Has proper version (not 0.0.x)
    if (crate.max_version && !crate.max_version.startsWith('0.0.')) score += 5;
    
    return Math.min(score, 100);
  }
}

module.exports = { CargoDiscovery };