/**
 * NPM Package Discovery Module
 * Discovers MCP servers published on NPM registry
 */

const https = require('https');
const { URLSearchParams } = require('url');
const { MCPPackageFilter } = require('../utils/mcp-package-filter');

class NPMDiscovery {
  constructor(options = {}) {
    this.registryUrl = 'https://registry.npmjs.org';
    this.searchUrl = 'https://www.npmjs.com/search';
    this.timeout = options.timeout || 30000;
    this.maxResults = options.maxResults || 500;
    this.userAgent = 'e14z-mcp-crawler/1.0.0';
  }

  /**
   * Discover MCP packages from NPM registry
   */
  async discoverMCPs() {
    console.log('🔍 Starting NPM MCP discovery...');
    
    const discoveryMethods = [
      () => this.searchByKeywords(),
      () => this.searchByDependency(),
      () => this.searchByNaming()
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
    
    // Filter out non-MCP packages early to save resources
    console.log(`🔍 Filtering ${uniquePackages.length} packages for MCP servers...`);
    const npmDetailsMap = new Map();
    
    // Get NPM details for filtering (parallelized for efficiency)
    const batchSize = 15; // Process 15 packages concurrently
    const batches = [];
    
    for (let i = 0; i < uniquePackages.length; i += batchSize) {
      batches.push(uniquePackages.slice(i, i + batchSize));
    }
    
    console.log(`   📦 Processing ${uniquePackages.length} packages in ${batches.length} batches of ${batchSize}...`);
    
    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`   🔄 Batch ${batchIndex + 1}/${batches.length}: ${batch.length} packages`);
      
      const batchPromises = batch.map(async (pkg) => {
        try {
          const details = await this.getPackageDetails(pkg.name);
          return { name: pkg.name, details, success: true };
        } catch (error) {
          console.warn(`     ⚠️ Failed to get details for ${pkg.name}: ${error.message}`);
          return { name: pkg.name, details: {}, success: false };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Store results
      batchResults.forEach(result => {
        npmDetailsMap.set(result.name, result.details);
      });
      
      const successCount = batchResults.filter(r => r.success).length;
      console.log(`     ✅ Batch complete: ${successCount}/${batch.length} successful`);
      
      // Small delay between batches to be respectful to NPM API
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const mcpPackages = MCPPackageFilter.filterMCPPackages(uniquePackages, npmDetailsMap);
    
    console.log(`✅ NPM discovery complete: ${mcpPackages.length}/${uniquePackages.length} packages are likely MCP servers`);
    return mcpPackages;
  }

  /**
   * Search NPM by MCP-related keywords
   */
  async searchByKeywords() {
    const keywords = [
      'mcp-server',
      'model-context-protocol', 
      'mcp protocol',
      'anthropic mcp',
      'mcp tools'
    ];

    let allResults = [];
    
    for (const keyword of keywords) {
      try {
        const results = await this.searchNPMRegistry(keyword);
        const mcpPackages = results
          .filter(pkg => this.isMCPPackage(pkg))
          .map(pkg => ({
            name: pkg.name,
            description: pkg.description,
            version: pkg.version,
            keywords: pkg.keywords || [],
            repository: pkg.links?.repository,
            homepage: pkg.links?.homepage,
            author: pkg.author?.name,
            license: pkg.license,
            downloads: pkg.searchScore,
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
   * Search packages that depend on MCP SDK
   */
  async searchByDependency() {
    try {
      // Search for packages that depend on the official MCP SDK
      const results = await this.searchNPMRegistry('@modelcontextprotocol/sdk');
      
      const dependentPackages = [];
      
      for (const pkg of results) {
        try {
          // Get detailed package info to check dependencies
          const packageInfo = await this.getPackageDetails(pkg.name);
          
          if (this.hasMCPDependency(packageInfo)) {
            dependentPackages.push({
              name: pkg.name,
              description: pkg.description,
              version: packageInfo.version,
              keywords: packageInfo.keywords || [],
              repository: packageInfo.repository?.url,
              homepage: packageInfo.homepage,
              author: packageInfo.author?.name || packageInfo.author,
              license: packageInfo.license,
              dependencies: packageInfo.dependencies,
              discoveryMethod: 'dependency:@modelcontextprotocol/sdk'
            });
          }
        } catch (error) {
          console.warn(`   Failed to get details for ${pkg.name}: ${error.message}`);
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
      '-mcp'
    ];

    let allResults = [];
    
    for (const pattern of patterns) {
      try {
        const results = await this.searchNPMRegistry(pattern);
        const mcpPackages = results
          .filter(pkg => pkg.name.includes(pattern) && this.isMCPPackage(pkg))
          .map(pkg => ({
            name: pkg.name,
            description: pkg.description,
            version: pkg.version,
            keywords: pkg.keywords || [],
            repository: pkg.links?.repository,
            homepage: pkg.links?.homepage,
            author: pkg.author?.name,
            license: pkg.license,
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
   * Search NPM registry using their search API
   */
  async searchNPMRegistry(query, size = 50) {
    return new Promise((resolve, reject) => {
      const searchParams = new URLSearchParams({
        text: query,
        size: Math.min(size, 250), // NPM limits
        quality: 0.5,
        popularity: 0.3,
        maintenance: 0.2
      });

      const options = {
        hostname: 'registry.npmjs.org',
        path: `/-/v1/search?${searchParams}`,
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
            const response = JSON.parse(data);
            if (response.objects) {
              resolve(response.objects.map(obj => obj.package));
            } else {
              resolve([]);
            }
          } catch (error) {
            reject(new Error(`Failed to parse NPM search response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('NPM search request timed out'));
      });

      req.end();
    });
  }

  /**
   * Get detailed package information from NPM registry
   */
  async getPackageDetails(packageName) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'registry.npmjs.org',
        path: `/${encodeURIComponent(packageName)}`,
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
            const latestVersion = packageInfo['dist-tags']?.latest;
            if (latestVersion && packageInfo.versions[latestVersion]) {
              resolve(packageInfo.versions[latestVersion]);
            } else {
              reject(new Error('No valid version found'));
            }
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
  isMCPPackage(pkg) {
    const name = (pkg.name || '').toLowerCase();
    const description = (pkg.description || '').toLowerCase();
    const keywords = (pkg.keywords || []).map(k => k.toLowerCase());

    // Strong indicators
    const strongIndicators = [
      'mcp-server',
      'mcp server',
      'model context protocol',
      'model-context-protocol',
      '@modelcontextprotocol'
    ];

    // Check name and description
    for (const indicator of strongIndicators) {
      if (name.includes(indicator) || description.includes(indicator)) {
        return true;
      }
    }

    // Check keywords
    const mcpKeywords = ['mcp', 'model-context-protocol', 'anthropic', 'claude'];
    const hasRelevantKeywords = keywords.some(keyword => 
      mcpKeywords.some(mcpKeyword => keyword.includes(mcpKeyword))
    );

    // Must have some MCP indicators and not be obviously unrelated
    const excludePatterns = [
      'test', 'example', 'demo', 'template', 'boilerplate',
      'webpack', 'babel', 'eslint', 'jest', 'typescript'
    ];

    const isExcluded = excludePatterns.some(pattern => 
      name.includes(pattern) || description.includes(pattern)
    );

    return hasRelevantKeywords && !isExcluded;
  }

  /**
   * Check if package has MCP SDK dependency
   */
  hasMCPDependency(packageInfo) {
    const dependencies = {
      ...packageInfo.dependencies,
      ...packageInfo.devDependencies,
      ...packageInfo.peerDependencies
    };

    const mcpDependencies = [
      '@modelcontextprotocol/sdk',
      '@modelcontextprotocol/server-stdio',
      '@anthropic-ai/mcp-sdk'
    ];

    return mcpDependencies.some(dep => dependencies[dep]);
  }

  /**
   * Extract installation command for npm package
   */
  extractInstallCommand(packageInfo) {
    const name = packageInfo.name;
    
    // Check if package has bin entries (executable)
    if (packageInfo.bin) {
      return `npx ${name}`;
    }

    // Check package.json scripts for mcp/server commands
    if (packageInfo.scripts) {
      const scripts = Object.keys(packageInfo.scripts);
      const mcpScript = scripts.find(script => 
        script.includes('mcp') || script.includes('server') || script.includes('start')
      );
      
      if (mcpScript) {
        return `npx ${name}`;
      }
    }

    // Default to npx
    return `npx ${name}`;
  }

  /**
   * Get package statistics and quality indicators
   */
  async getPackageStats(packageName) {
    try {
      // NPM doesn't provide download stats in their main API
      // We can infer quality from other metadata
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
    if (!packageInfo.time) return false;
    
    const lastModified = new Date(packageInfo.time.modified || packageInfo.time.created);
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    return lastModified > sixMonthsAgo;
  }

  hasGoodDocumentation(packageInfo) {
    return !!(
      packageInfo.readme && packageInfo.readme.length > 200 ||
      packageInfo.repository ||
      packageInfo.homepage
    );
  }

  calculateQualityScore(packageInfo) {
    let score = 0;
    
    // Recent updates
    if (this.isRecentlyUpdated(packageInfo)) score += 20;
    
    // Has documentation
    if (this.hasGoodDocumentation(packageInfo)) score += 20;
    
    // Has repository
    if (packageInfo.repository) score += 15;
    
    // Has license
    if (packageInfo.license) score += 10;
    
    // Has proper description
    if (packageInfo.description && packageInfo.description.length > 30) score += 15;
    
    // Has keywords
    if (packageInfo.keywords && packageInfo.keywords.length > 0) score += 10;
    
    // Has proper version (not 0.x)
    if (packageInfo.version && !packageInfo.version.startsWith('0.')) score += 10;
    
    return Math.min(score, 100);
  }
}

module.exports = { NPMDiscovery };