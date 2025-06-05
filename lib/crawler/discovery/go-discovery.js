/**
 * Go Package Discovery Module
 * Discovers MCP servers published on pkg.go.dev for Go installation
 */

const https = require('https');
const { URLSearchParams } = require('url');

class GoDiscovery {
  constructor(options = {}) {
    this.pkgGoDevUrl = 'https://pkg.go.dev';
    this.timeout = options.timeout || 30000;
    this.maxResults = options.maxResults || 500;
    this.userAgent = 'e14z-mcp-crawler/1.0.0';
  }

  /**
   * Discover MCP packages from pkg.go.dev
   */
  async discoverMCPs() {
    console.log('🔍 Starting Go MCP discovery...');
    
    const discoveryMethods = [
      () => this.searchByKeywords(),
      () => this.searchByNaming(),
      () => this.searchByPopularRepos(),
      () => this.searchByGitHubTopics()
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
    
    console.log(`✅ Go discovery complete: ${uniquePackages.length} unique packages found`);
    return uniquePackages;
  }

  /**
   * Search pkg.go.dev by MCP-related keywords
   */
  async searchByKeywords() {
    const keywords = [
      'mcp-server',
      'model-context-protocol', 
      'mcp protocol',
      'anthropic mcp',
      'mcp tools',
      'claude mcp',
      'mcp go',
      'server protocol',
      'jsonrpc server'
    ];

    let allResults = [];
    
    for (const keyword of keywords) {
      try {
        const results = await this.searchPkgGoDev(keyword);
        const mcpPackages = [];
        
        // Parse search results and get detailed info
        for (const result of results) {
          try {
            if (this.isMCPPackage(result)) {
              const packageInfo = await this.getPackageInfo(result.packagePath);
              if (packageInfo) {
                mcpPackages.push({
                  name: result.packagePath,
                  description: result.synopsis || packageInfo.synopsis,
                  version: packageInfo.version || 'latest',
                  importPath: result.packagePath,
                  repository: this.extractRepositoryFromPath(result.packagePath),
                  documentation: `https://pkg.go.dev/${result.packagePath}`,
                  licenseType: packageInfo.licenseType,
                  commitTime: packageInfo.commitTime,
                  discoveryMethod: `keyword:${keyword}`
                });
              }
            }
          } catch (error) {
            console.warn(`   Failed to get details for ${result.packagePath}: ${error.message}`);
          }
        }
        
        allResults.push(...mcpPackages);
        console.log(`   Keyword "${keyword}": ${mcpPackages.length} MCP packages`);
      } catch (error) {
        console.warn(`   Keyword search failed for "${keyword}": ${error.message}`);
      }
    }

    return allResults;
  }

  /**
   * Search by common MCP naming patterns
   */
  async searchByNaming() {
    const patterns = [
      'mcp-server',
      'mcp-go',
      'go-mcp',
      'mcpserver',
      'mcp_server'
    ];

    let allResults = [];
    
    for (const pattern of patterns) {
      try {
        const results = await this.searchPkgGoDev(pattern);
        const mcpPackages = [];
        
        for (const result of results) {
          if (result.packagePath.toLowerCase().includes(pattern.toLowerCase())) {
            try {
              if (this.isMCPPackage(result)) {
                const packageInfo = await this.getPackageInfo(result.packagePath);
                if (packageInfo) {
                  mcpPackages.push({
                    name: result.packagePath,
                    description: result.synopsis || packageInfo.synopsis,
                    version: packageInfo.version || 'latest',
                    importPath: result.packagePath,
                    repository: this.extractRepositoryFromPath(result.packagePath),
                    documentation: `https://pkg.go.dev/${result.packagePath}`,
                    licenseType: packageInfo.licenseType,
                    commitTime: packageInfo.commitTime,
                    discoveryMethod: `naming:${pattern}`
                  });
                }
              }
            } catch (error) {
              console.warn(`   Failed to get details for ${result.packagePath}: ${error.message}`);
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
   * Search by popular GitHub repositories with Go MCP servers
   */
  async searchByPopularRepos() {
    try {
      // Search GitHub for Go repositories with MCP-related topics
      const githubResults = await this.searchGitHubRepos('mcp server language:go');
      const goPackages = [];
      
      for (const repo of githubResults.slice(0, 20)) { // Limit to prevent overload
        try {
          // Convert GitHub repo to Go module path
          const modulePath = `github.com/${repo.full_name}`;
          
          // Check if it's available on pkg.go.dev
          const packageInfo = await this.getPackageInfo(modulePath);
          if (packageInfo && this.isGoMCPServer(repo, packageInfo)) {
            goPackages.push({
              name: modulePath,
              description: repo.description || packageInfo.synopsis,
              version: 'latest',
              importPath: modulePath,
              repository: repo.html_url,
              documentation: `https://pkg.go.dev/${modulePath}`,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              language: repo.language,
              topics: repo.topics || [],
              lastUpdate: repo.updated_at,
              licenseType: packageInfo.licenseType,
              commitTime: packageInfo.commitTime,
              discoveryMethod: 'github:popular'
            });
          }
        } catch (error) {
          console.warn(`   Failed to process repo ${repo.full_name}: ${error.message}`);
        }
      }
      
      console.log(`   Popular repos: ${goPackages.length} packages`);
      return goPackages;
    } catch (error) {
      console.warn(`   Popular repos search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Search GitHub for Go repositories with MCP topics
   */
  async searchByGitHubTopics() {
    try {
      const topics = ['mcp', 'model-context-protocol', 'anthropic', 'claude-server'];
      let allResults = [];
      
      for (const topic of topics) {
        try {
          const githubResults = await this.searchGitHubRepos(`topic:${topic} language:go`);
          const goPackages = [];
          
          for (const repo of githubResults.slice(0, 15)) {
            try {
              const modulePath = `github.com/${repo.full_name}`;
              const packageInfo = await this.getPackageInfo(modulePath);
              
              if (packageInfo && this.isGoMCPServer(repo, packageInfo)) {
                goPackages.push({
                  name: modulePath,
                  description: repo.description || packageInfo.synopsis,
                  version: 'latest',
                  importPath: modulePath,
                  repository: repo.html_url,
                  documentation: `https://pkg.go.dev/${modulePath}`,
                  stars: repo.stargazers_count,
                  forks: repo.forks_count,
                  language: repo.language,
                  topics: repo.topics || [],
                  lastUpdate: repo.updated_at,
                  licenseType: packageInfo.licenseType,
                  commitTime: packageInfo.commitTime,
                  discoveryMethod: `github:topic:${topic}`
                });
              }
            } catch (error) {
              console.warn(`   Failed to process repo ${repo.full_name}: ${error.message}`);
            }
          }
          
          allResults.push(...goPackages);
          console.log(`   Topic "${topic}": ${goPackages.length} packages`);
        } catch (error) {
          console.warn(`   Topic search failed for "${topic}": ${error.message}`);
        }
      }
      
      return allResults;
    } catch (error) {
      console.warn(`   GitHub topics search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Search pkg.go.dev (using web scraping since there's no public API)
   */
  async searchPkgGoDev(query) {
    return new Promise((resolve, reject) => {
      const encodedQuery = encodeURIComponent(query);
      const options = {
        hostname: 'pkg.go.dev',
        path: `/search?q=${encodedQuery}&m=package`,
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
            const packages = this.parseSearchResults(data);
            resolve(packages);
          } catch (error) {
            reject(new Error(`Failed to parse pkg.go.dev search response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('pkg.go.dev search request timed out'));
      });

      req.end();
    });
  }

  /**
   * Parse search results from pkg.go.dev HTML
   */
  parseSearchResults(html) {
    const packages = [];
    
    // Extract package information from HTML using regex patterns
    // This is a simplified parser - in production you might want to use a proper HTML parser
    const packagePattern = /<a[^>]+href="\/([^"]+)"[^>]*>\s*<div[^>]*>\s*<div[^>]*>([^<]+)<\/div>/g;
    const synopsisPattern = /<div[^>]*class="[^"]*synopsis[^"]*"[^>]*>([^<]+)<\/div>/g;
    
    let match;
    let packageIndex = 0;
    
    while ((match = packagePattern.exec(html)) !== null && packageIndex < 50) {
      const packagePath = match[1];
      const title = match[2].trim();
      
      // Try to find synopsis for this package
      let synopsis = '';
      const synopsisMatch = synopsisPattern.exec(html);
      if (synopsisMatch) {
        synopsis = synopsisMatch[1].trim();
      }
      
      if (packagePath && !packagePath.includes('search')) {
        packages.push({
          packagePath: packagePath,
          title: title,
          synopsis: synopsis
        });
        packageIndex++;
      }
    }
    
    return packages;
  }

  /**
   * Get detailed package information from pkg.go.dev
   */
  async getPackageInfo(packagePath) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'pkg.go.dev',
        path: `/${encodeURIComponent(packagePath)}`,
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
            
            const packageInfo = this.parsePackageInfo(data);
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
  parsePackageInfo(html) {
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
    
    return info;
  }

  /**
   * Search GitHub repositories
   */
  async searchGitHubRepos(query) {
    return new Promise((resolve, reject) => {
      const encodedQuery = encodeURIComponent(query);
      const options = {
        hostname: 'api.github.com',
        path: `/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=30`,
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/vnd.github.v3+json'
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
              resolve([]);
              return;
            }
            
            const response = JSON.parse(data);
            resolve(response.items || []);
          } catch (error) {
            resolve([]);
          }
        });
      });

      req.on('error', () => resolve([]));
      req.on('timeout', () => {
        req.destroy();
        resolve([]);
      });

      req.end();
    });
  }

  /**
   * Extract repository URL from Go module path
   */
  extractRepositoryFromPath(packagePath) {
    // Handle common Go hosting patterns
    if (packagePath.startsWith('github.com/')) {
      return `https://${packagePath}`;
    }
    
    if (packagePath.startsWith('gitlab.com/')) {
      return `https://${packagePath}`;
    }
    
    if (packagePath.startsWith('bitbucket.org/')) {
      return `https://${packagePath}`;
    }
    
    // For other patterns, try to construct the URL
    const parts = packagePath.split('/');
    if (parts.length >= 3) {
      return `https://${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    
    return null;
  }

  /**
   * Check if a package is likely an MCP server
   */
  isMCPPackage(packageOrResult) {
    const packagePath = packageOrResult.packagePath || packageOrResult.name || '';
    const synopsis = packageOrResult.synopsis || packageOrResult.description || '';
    const title = packageOrResult.title || '';
    
    const text = `${packagePath} ${synopsis} ${title}`.toLowerCase();

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

    // Check for strong indicators
    for (const indicator of strongIndicators) {
      if (text.includes(indicator)) {
        return true;
      }
    }

    // Check for MCP keywords combined with server patterns
    const mcpKeywords = ['mcp', 'model-context-protocol', 'anthropic', 'claude'];
    const serverPatterns = ['server', 'daemon', 'service', 'cli', 'tool', 'cmd'];
    
    const hasMCPKeyword = mcpKeywords.some(keyword => text.includes(keyword));
    const hasServerPattern = serverPatterns.some(pattern => text.includes(pattern));

    // Must have some MCP indicators and not be obviously unrelated
    const excludePatterns = [
      'test', 'example', 'demo', 'template', 'boilerplate',
      'game', 'graphics', 'ui', 'orm', 'framework'
    ];

    const isExcluded = excludePatterns.some(pattern => text.includes(pattern));

    return hasMCPKeyword && hasServerPattern && !isExcluded;
  }

  /**
   * Check if a GitHub repo is a Go MCP server
   */
  isGoMCPServer(repo, packageInfo) {
    // Must be a Go repository
    if (repo.language !== 'Go') return false;
    
    const text = `${repo.name} ${repo.description || ''} ${packageInfo?.synopsis || ''}`.toLowerCase();
    const topics = (repo.topics || []).map(t => t.toLowerCase());
    
    // Strong indicators
    const strongIndicators = [
      'mcp-server',
      'mcp server',
      'model context protocol',
      'model-context-protocol',
      'anthropic mcp',
      'claude server'
    ];
    
    // Check for strong indicators
    for (const indicator of strongIndicators) {
      if (text.includes(indicator)) {
        return true;
      }
    }
    
    // Check topics
    const mcpTopics = ['mcp', 'model-context-protocol', 'anthropic', 'claude'];
    const hasMCPTopic = topics.some(topic => mcpTopics.includes(topic));
    
    // Check for MCP keywords combined with server patterns
    const mcpKeywords = ['mcp', 'model-context-protocol', 'anthropic', 'claude'];
    const serverPatterns = ['server', 'daemon', 'service', 'cli', 'tool'];
    
    const hasMCPKeyword = mcpKeywords.some(keyword => text.includes(keyword));
    const hasServerPattern = serverPatterns.some(pattern => text.includes(pattern));
    
    return hasMCPTopic || (hasMCPKeyword && hasServerPattern);
  }

  /**
   * Extract installation command for Go package
   */
  extractInstallCommand(packageInfo) {
    const importPath = packageInfo.importPath || packageInfo.name;
    return `go install ${importPath}@latest`;
  }

  /**
   * Get package statistics and quality indicators
   */
  async getPackageStats(packagePath) {
    try {
      const packageInfo = await this.getPackageInfo(packagePath);
      
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
    if (!packageInfo || !packageInfo.commitTime) return false;
    
    const lastModified = new Date(packageInfo.commitTime);
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    return lastModified > sixMonthsAgo;
  }

  hasGoodDocumentation(packageInfo) {
    if (!packageInfo) return false;
    
    return !!(
      packageInfo.synopsis && packageInfo.synopsis.length > 50 ||
      packageInfo.documentation
    );
  }

  calculateQualityScore(packageInfo) {
    if (!packageInfo) return 0;
    
    let score = 0;
    
    // Recent updates
    if (this.isRecentlyUpdated(packageInfo)) score += 25;
    
    // Has documentation
    if (this.hasGoodDocumentation(packageInfo)) score += 25;
    
    // Has license
    if (packageInfo.licenseType && packageInfo.licenseType !== 'Unknown') score += 20;
    
    // Has proper description
    if (packageInfo.synopsis && packageInfo.synopsis.length > 30) score += 20;
    
    // Has version
    if (packageInfo.version && packageInfo.version !== 'latest') score += 10;
    
    return Math.min(score, 100);
  }
}

module.exports = { GoDiscovery };