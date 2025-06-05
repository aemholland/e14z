/**
 * Enhanced GitHub-First Discovery
 * Discovers MCPs from actual GitHub repositories with proper company/community classification
 */

const { WebScraper } = require('../scraping/web-scraper');

class GitHubEnhancedDiscovery {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.maxRepositories = options.maxRepositories || 200;
    this.userAgent = 'e14z-mcp-crawler/1.0.0';
    this.webScraper = new WebScraper(options);
    
    // Known company/organization patterns for official classification
    this.officialOrganizations = new Set([
      // Major tech companies
      'stripe', 'anthropic', 'openai', 'google', 'microsoft', 'aws', 'awslabs',
      'meta', 'facebook', 'twitter', 'slack', 'discord', 'github', 'gitlab',
      'notion', 'atlassian', 'salesforce', 'shopify', 'zoom', 'twilio',
      
      // Database & infrastructure companies  
      'mongodb', 'postgresql', 'redis', 'elastic', 'supabase', 'planetscale',
      'cockroachdb', 'snowflake', 'databricks', 'cloudflare', 'vercel',
      
      // Developer tools companies
      'jetbrains', 'docker', 'kubernetes', 'hashicorp', 'circleci', 'travis-ci',
      'jenkins', 'sonarqube', 'sentry', 'datadog', 'newrelic', 'bugsnag',
      
      // Official MCP organizations
      'modelcontextprotocol', '21st-dev', 'adfin-engineering', 'tinyfish-io',
      'algolia', 'mindsdb', 'pipedreamhq'
    ]);
  }

  /**
   * Discover MCPs from curated GitHub sources
   */
  async discoverMCPs() {
    console.log('🔍 Starting GitHub-enhanced MCP discovery...');
    
    const sources = [
      'https://github.com/modelcontextprotocol/servers',
      'https://github.com/punkpeye/awesome-mcp-servers'
    ];
    
    let allRepositories = [];
    
    for (const source of sources) {
      try {
        console.log(`📡 Crawling source: ${source}`);
        const repositories = await this.extractRepositoriesFromSource(source);
        allRepositories.push(...repositories);
        console.log(`   Found ${repositories.length} repositories`);
      } catch (error) {
        console.error(`   ❌ Failed to crawl ${source}: ${error.message}`);
      }
    }
    
    // Deduplicate repositories
    const uniqueRepos = this.deduplicateRepositories(allRepositories);
    console.log(`📊 Total unique repositories: ${uniqueRepos.length}`);
    
    // Process each repository to get enhanced metadata
    console.log('🔍 Processing repositories for enhanced metadata...');
    const enhancedMCPs = [];
    
    for (const repo of uniqueRepos.slice(0, this.maxRepositories)) {
      try {
        const mcpData = await this.processRepository(repo);
        if (mcpData) {
          enhancedMCPs.push(mcpData);
          console.log(`   ✅ Processed: ${mcpData.name} (${mcpData.official_status})`);
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to process ${repo.url}: ${error.message}`);
      }
    }
    
    console.log(`✅ GitHub discovery complete: ${enhancedMCPs.length} enhanced MCPs found`);
    return enhancedMCPs;
  }

  /**
   * Extract repository information from source pages
   */
  async extractRepositoriesFromSource(sourceUrl) {
    try {
      console.log(`   📡 Scraping source: ${sourceUrl}`);
      
      const result = await this.webScraper.scrapeUrl(sourceUrl, {
        waitFor: 3000  // Wait for dynamic content
      });
      
      if (!result.success) {
        console.error(`   ❌ Scraping failed: ${result.error}`);
        throw new Error(`Failed to scrape ${sourceUrl}: ${result.error}`);
      }
      
      console.log(`   ✅ Scraping successful: ${result.statusCode || 'unknown status'}`);
      console.log(`   📄 Title: ${result.title || 'no title'}`);
      console.log(`   📝 Description: ${(result.description || 'no description').substring(0, 100)}...`);
      
      // Parse the content to extract repository data
      console.log(`   📝 Content extracted: ${result.content.markdown.length} chars`);
      const repositories = this.parseRepositoryResponse(result.content.markdown, sourceUrl);
      console.log(`   🔍 Found ${repositories.length} potential repositories`);
      return repositories;
      
    } catch (error) {
      console.error(`Failed to extract repositories from ${sourceUrl}: ${error.message}`);
      return [];
    }
  }

  /**
   * Parse repository response and normalize data
   */
  parseRepositoryResponse(content, sourceUrl) {
    const repositories = [];
    
    console.log(`   🔎 Parsing content of ${content.length} characters...`);
    
    // Extract GitHub URLs from the content
    const githubUrlPattern = /https:\/\/github\.com\/([^\/\s\)]+)\/([^\/\s\)]+)/g;
    let match;
    let matchCount = 0;
    
    while ((match = githubUrlPattern.exec(content)) !== null) {
      matchCount++;
      const [fullUrl, owner, repo] = match;
      
      console.log(`   🔗 Found GitHub URL: ${fullUrl} (${owner}/${repo})`);
      
      // Skip obvious non-MCP repositories
      if (this.isLikelyMCPRepository(owner, repo)) {
        console.log(`   ✅ Accepted as likely MCP repository`);
        repositories.push({
          url: fullUrl,
          owner: owner.toLowerCase(),
          repository: repo.toLowerCase(),
          source: sourceUrl,
          description: this.extractDescriptionNearUrl(content, fullUrl)
        });
      } else {
        console.log(`   ❌ Rejected as non-MCP repository`);
      }
    }
    
    console.log(`   📊 Total GitHub URLs found: ${matchCount}, Accepted: ${repositories.length}`);
    
    // If no repositories found, let's check for alternative patterns
    if (repositories.length === 0) {
      console.log(`   🔍 No repositories found with standard pattern, trying alternatives...`);
      
      // Try finding links in markdown format
      const markdownLinkPattern = /\[([^\]]+)\]\(https:\/\/github\.com\/([^\/\s\)]+)\/([^\/\s\)]+)\)/g;
      while ((match = markdownLinkPattern.exec(content)) !== null) {
        const [, linkText, owner, repo] = match;
        const fullUrl = `https://github.com/${owner}/${repo}`;
        console.log(`   🔗 Found markdown link: ${fullUrl} (${linkText})`);
        
        if (this.isLikelyMCPRepository(owner, repo)) {
          repositories.push({
            url: fullUrl,
            owner: owner.toLowerCase(),
            repository: repo.toLowerCase(),
            source: sourceUrl,
            description: linkText
          });
        }
      }
    }
    
    return repositories;
  }

  /**
   * Check if repository is likely an MCP server
   */
  isLikelyMCPRepository(owner, repo) {
    const repoLower = repo.toLowerCase();
    const ownerLower = owner.toLowerCase();
    
    // Include if it has MCP patterns
    const mcpPatterns = [
      'mcp', 'server', 'modelcontextprotocol'
    ];
    
    const hasMCPPattern = mcpPatterns.some(pattern => 
      repoLower.includes(pattern) || ownerLower.includes(pattern)
    );
    
    // Exclude obvious non-MCP repos
    const excludePatterns = [
      'awesome', 'docs', 'documentation', 'website', 'homepage',
      'example', 'demo', 'template', 'boilerplate'
    ];
    
    const isExcluded = excludePatterns.some(pattern => repoLower.includes(pattern));
    
    return hasMCPPattern && !isExcluded;
  }

  /**
   * Extract description text near a GitHub URL
   */
  extractDescriptionNearUrl(content, url) {
    const lines = content.split('\n');
    const urlLineIndex = lines.findIndex(line => line.includes(url));
    
    if (urlLineIndex === -1) return '';
    
    // Look for description in surrounding lines
    for (let i = Math.max(0, urlLineIndex - 2); i <= Math.min(lines.length - 1, urlLineIndex + 2); i++) {
      const line = lines[i].trim();
      if (line && !line.includes('github.com') && !line.startsWith('#')) {
        // Clean up markdown formatting
        return line.replace(/^\*\s*/, '').replace(/^-\s*/, '').replace(/\[([^\]]+)\].*/, '$1');
      }
    }
    
    return '';
  }

  /**
   * Process individual repository to get enhanced metadata
   */
  async processRepository(repoInfo) {
    try {
      console.log(`   🔍 Processing: ${repoInfo.owner}/${repoInfo.repository}`);
      
      // Get repository metadata from GitHub page
      const repoData = await this.getRepositoryMetadata(repoInfo);
      
      // Determine official status
      const officialStatus = this.determineOfficialStatus(repoInfo.owner, repoData);
      
      // Extract package information
      const packageInfo = await this.extractPackageInformation(repoInfo, repoData);
      
      // Generate enhanced MCP data
      const mcpData = {
        // Basic info
        name: packageInfo.name || `${repoInfo.owner}-${repoInfo.repository}`,
        repository_url: repoInfo.url,
        owner: repoInfo.owner,
        repository_name: repoInfo.repository,
        
        // Classification
        official_status: officialStatus,
        is_official: officialStatus === 'official',
        
        // Metadata from GitHub
        description: repoData.description || repoInfo.description || '',
        topics: repoData.topics || [],
        stars: repoData.stars || 0,
        last_updated: repoData.lastUpdated || null,
        license: repoData.license || null,
        language: repoData.primaryLanguage || null,
        website_url: repoData.websiteUrl || null, // Extract website URL from GitHub
        
        // Package info
        install_type: packageInfo.installType || 'npm',
        auto_install_command: packageInfo.installCommand || null,
        installCommand: packageInfo.installCommand || null, // For MCP crawler
        package_name: packageInfo.packageName || null,
        packageName: packageInfo.packageName || null, // For MCP crawler
        
        // Discovery metadata
        discoveryMethod: `github:${repoInfo.source}`,
        source_list: repoInfo.source,
        
        // Quality indicators
        has_readme: repoData.hasReadme || false,
        has_package_json: packageInfo.hasPackageJson || false,
        recent_activity: this.isRecentlyActive(repoData.lastUpdated),
        
        // MCP server documentation and package info (for auth detection)
        mcpDocumentation: packageInfo.mcpDocumentation || '',
        readmeContent: packageInfo.readmeContent || '',
        packageJson: packageInfo.packageJson || {},
        dependencies: packageInfo.dependencies || {},
        scripts: packageInfo.scripts || {},
        
        // Default values that will be enhanced later
        tools: [],
        auth_required: false,
        verified: false,
        health_status: 'unknown'
      };
      
      return mcpData;
      
    } catch (error) {
      console.warn(`Failed to process repository ${repoInfo.url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get repository metadata from GitHub
   */
  async getRepositoryMetadata(repoInfo) {
    try {
      const githubUrl = `${repoInfo.url}`;
      console.log(`   🔍 Getting metadata for: ${githubUrl}`);
      
      const result = await this.webScraper.scrapeUrl(githubUrl, {
        waitFor: 2000  // Wait for GitHub dynamic content
      });
      
      if (!result.success) {
        throw new Error(`Failed to scrape ${githubUrl}: ${result.error}`);
      }
      
      // Extract metadata from the scraped content
      const metadata = this.extractGitHubMetadata(result);
      return metadata;
      
    } catch (error) {
      console.warn(`Failed to get metadata for ${repoInfo.url}: ${error.message}`);
      return {};
    }
  }

  /**
   * Extract GitHub metadata from scraped content
   */
  extractGitHubMetadata(scrapedResult) {
    try {
      const content = scrapedResult.content;
      const markdown = content.markdown;
      const text = content.text;
      
      // Extract from page title and description
      const description = scrapedResult.description || this.extractDescriptionFromContent(markdown);
      
      // Extract topics from content
      const topics = this.extractTopicsFromContent(markdown);
      
      // Extract stars
      const stars = this.extractStarsFromContent(text);
      
      // Extract language
      const primaryLanguage = this.extractLanguageFromContent(markdown);
      
      // Check for README
      const hasReadme = markdown.toLowerCase().includes('readme') || 
                       text.toLowerCase().includes('readme.md');
      
      // Extract license
      const license = this.extractLicenseFromContent(markdown);
      
      // Extract website/homepage URL from GitHub page
      const websiteUrl = this.extractWebsiteFromContent(text, markdown);
      
      return {
        description: description,
        topics: topics,
        stars: stars,
        lastUpdated: null, // Could extract from commits, but complex
        license: license,
        primaryLanguage: primaryLanguage,
        hasReadme: hasReadme,
        websiteUrl: websiteUrl
      };
    } catch (error) {
      console.warn(`Failed to extract GitHub metadata: ${error.message}`);
      return {};
    }
  }
  
  /**
   * Extract description from GitHub content
   */
  extractDescriptionFromContent(markdown) {
    // Look for repository description patterns
    const descPatterns = [
      /description[:\s]+([^\n]+)/i,
      /^([^\n#]+)$/m,  // First line that's not a header
    ];
    
    for (const pattern of descPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1] && match[1].trim().length > 10) {
        return match[1].trim();
      }
    }
    
    return '';
  }
  
  /**
   * Extract topics from GitHub content
   */
  extractTopicsFromContent(markdown) {
    const topics = [];
    
    // Look for topic/tag patterns
    const topicPatterns = [
      /topics?[:\s]+([^\n]+)/i,
      /tags?[:\s]+([^\n]+)/i,
      /#(\w+)/g  // Hashtags
    ];
    
    for (const pattern of topicPatterns) {
      if (pattern.global) {
        const matches = markdown.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const topicList = match[1].split(/[,\s]+/).filter(t => t.trim().length > 1);
            topics.push(...topicList);
          }
        }
      } else {
        const match = markdown.match(pattern);
        if (match && match[1]) {
          const topicList = match[1].split(/[,\s]+/).filter(t => t.trim().length > 1);
          topics.push(...topicList);
        }
      }
    }
    
    return [...new Set(topics)].slice(0, 10); // Dedupe and limit
  }
  
  /**
   * Extract stars from GitHub content
   */
  extractStarsFromContent(text) {
    const starsPattern = /(\d+)\s*stars?/i;
    const match = text.match(starsPattern);
    return match ? parseInt(match[1]) : 0;
  }
  
  /**
   * Extract language from GitHub content
   */
  extractLanguageFromContent(markdown) {
    const languages = ['JavaScript', 'TypeScript', 'Python', 'Rust', 'Go', 'Java', 'C++', 'C#'];
    
    for (const lang of languages) {
      if (markdown.toLowerCase().includes(lang.toLowerCase())) {
        return lang;
      }
    }
    
    return null;
  }
  
  /**
   * Extract license from GitHub content
   */
  extractLicenseFromContent(markdown) {
    const licensePattern = /license[:\s]+([^\n]+)/i;
    const match = markdown.match(licensePattern);
    return match ? match[1].trim() : null;
  }
  
  /**
   * Extract website/homepage URL from GitHub page content
   */
  extractWebsiteFromContent(text, markdown) {
    // Look for website/homepage links in GitHub's standard format
    const websitePatterns = [
      // GitHub repository page patterns
      /website[:\s]*([^\s\n]+)/i,
      /homepage[:\s]*([^\s\n]+)/i,
      // Direct URL patterns (avoid GitHub URLs)
      /https?:\/\/(?!github\.com)(?!raw\.githubusercontent\.com)[\w\-\.]+\.\w{2,}(?:\/[^\s]*)?/g,
      // Documentation site patterns
      /docs?[:\s]*([^\s\n]+)/i,
      // Common patterns in README
      /visit[:\s]*([^\s\n]+)/i,
      /site[:\s]*([^\s\n]+)/i
    ];
    
    // First try to find explicit website mentions
    for (const pattern of websitePatterns.slice(0, 3)) { // First 3 are specific patterns
      const match = markdown.match(pattern);
      if (match && match[1]) {
        const url = match[1].trim().replace(/[(),.;]$/, ''); // Clean trailing punctuation
        if (this.isValidWebsiteUrl(url)) {
          return url;
        }
      }
    }
    
    // Then try to find any external URLs that aren't GitHub
    const urlPattern = /https?:\/\/(?!github\.com)(?!raw\.githubusercontent\.com)[\w\-\.]+\.\w{2,}(?:\/[^\s]*)?/g;
    const matches = [...markdown.matchAll(urlPattern)];
    
    for (const match of matches) {
      const url = match[0];
      if (this.isValidWebsiteUrl(url) && !url.includes('github.com')) {
        // Prefer domains that look like project websites
        if (url.includes('docs') || url.includes('.io') || url.includes('.dev') || url.includes('.com')) {
          return url;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Validate if URL looks like a legitimate website
   */
  isValidWebsiteUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Basic URL validation
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      
      // Exclude obvious non-website patterns
      const excludePatterns = [
        'github.com',
        'raw.githubusercontent.com',
        'api.',
        'localhost',
        '127.0.0.1',
        '.git',
        '.zip',
        '.tar',
        '.md'
      ];
      
      for (const pattern of excludePatterns) {
        if (urlObj.href.includes(pattern)) {
          return false;
        }
      }
      
      // Must have a reasonable TLD
      const validTlds = ['.com', '.org', '.io', '.dev', '.net', '.app', '.co', '.ai'];
      return validTlds.some(tld => urlObj.hostname.includes(tld));
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract field from text response
   */
  extractField(text, fieldName) {
    const pattern = new RegExp(`${fieldName}[:\\s]+"?([^"\\n]+)"?`, 'i');
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract topics from response
   */
  extractTopics(text) {
    const topicsMatch = text.match(/topics?[:\s]+\[([^\]]+)\]/i);
    if (topicsMatch) {
      return topicsMatch[1].split(',').map(t => t.trim().replace(/"/g, ''));
    }
    return [];
  }

  /**
   * Extract star count
   */
  extractStars(text) {
    const starsMatch = text.match(/(\d+)\s*stars?/i);
    return starsMatch ? parseInt(starsMatch[1]) : 0;
  }

  /**
   * Extract last updated date
   */
  extractLastUpdated(text) {
    const dateMatch = text.match(/updated[:\s]+([^\n]+)/i);
    return dateMatch ? dateMatch[1].trim() : null;
  }

  /**
   * Determine if repository is official or community
   */
  determineOfficialStatus(owner, repoData) {
    const ownerLower = owner.toLowerCase();
    
    // Check against known official organizations
    if (this.officialOrganizations.has(ownerLower)) {
      return 'official';
    }
    
    // Check for company indicators in repository data
    if (repoData.description) {
      const description = repoData.description.toLowerCase();
      const companyIndicators = [
        'official', 'company', 'enterprise', 'organization',
        'team', 'inc', 'corp', 'ltd', 'llc'
      ];
      
      if (companyIndicators.some(indicator => description.includes(indicator))) {
        return 'official';
      }
    }
    
    // Check repository size/activity indicators
    if (repoData.stars > 100 || (repoData.topics && repoData.topics.length > 5)) {
      return 'verified-community';
    }
    
    return 'community';
  }

  /**
   * Extract MCP server information from repository contents
   */
  async extractPackageInformation(repoInfo, repoData) {
    try {
      console.log(`   📦 Extracting MCP server info from repository contents...`);
      
      // Get raw file contents (not GitHub web view)
      const rawBaseUrl = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repository}/main`;
      
      // Try to get package.json (raw JSON)
      let packageInfo = {};
      try {
        const packageJsonUrl = `${rawBaseUrl}/package.json`;
        console.log(`   📄 Getting raw package.json: ${packageJsonUrl}`);
        
        const packageResult = await this.fetchRawFile(packageJsonUrl);
        if (packageResult) {
          packageInfo = JSON.parse(packageResult);
          console.log(`   ✅ Parsed package.json: ${packageInfo.name || 'unnamed'}`);
        }
      } catch (error) {
        console.log(`   ⚠️ No package.json or parse error: ${error.message}`);
      }
      
      // Get README.md (raw markdown) for MCP server documentation  
      let readmeContent = '';
      try {
        const readmeUrl = `${rawBaseUrl}/README.md`;
        console.log(`   📄 Getting raw README.md: ${readmeUrl}`);
        
        readmeContent = await this.fetchRawFile(readmeUrl) || '';
        console.log(`   ✅ README extracted: ${readmeContent.length} chars`);
      } catch (error) {
        console.log(`   ⚠️ No README.md: ${error.message}`);
      }
      
      return {
        packageName: packageInfo.name || `${repoInfo.owner}-${repoInfo.repository}`,
        installCommand: this.generateInstallCommand(packageInfo, repoInfo),
        installType: this.determineInstallType(packageInfo, repoData),
        hasPackageJson: !!packageInfo.name,
        dependencies: packageInfo.dependencies || {},
        // MCP server specific content
        readmeContent: readmeContent,
        packageJson: packageInfo,
        scripts: packageInfo.scripts || {},
        // For auth detection later
        mcpDocumentation: readmeContent
      };
      
    } catch (error) {
      console.warn(`Failed to extract MCP info for ${repoInfo.url}: ${error.message}`);
      // Fallback: generate basic info from repository name
      return {
        packageName: `${repoInfo.owner}-${repoInfo.repository}`,
        installCommand: `npx ${repoInfo.owner}-${repoInfo.repository}`,
        installType: 'npm',
        hasPackageJson: false,
        dependencies: {},
        readmeContent: '',
        packageJson: {},
        scripts: {},
        mcpDocumentation: ''
      };
    }
  }

  /**
   * Fetch raw file content from GitHub
   */
  async fetchRawFile(url) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      console.warn(`   Failed to fetch ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse package.json from scraped content
   */
  parsePackageJsonFromContent(content) {
    try {
      // Try to find JSON content in the scraped text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to field extraction
      return {
        name: this.extractField(content, 'name'),
        installCommand: this.extractField(content, 'installCommand'),
        dependencies: {},
        hasBin: content.includes('bin')
      };
    } catch (error) {
      return {};
    }
  }
  
  /**
   * Parse package.json response (legacy method)
   */
  parsePackageJson(packageResponse) {
    return this.parsePackageJsonFromContent(packageResponse);
  }

  /**
   * Generate installation command
   */
  generateInstallCommand(packageInfo, repoInfo) {
    if (packageInfo.installCommand) {
      return packageInfo.installCommand;
    }
    
    if (packageInfo.name) {
      return `npx ${packageInfo.name}`;
    }
    
    // Fallback to repository-based command
    return `npx ${repoInfo.owner}-${repoInfo.repository}`;
  }

  /**
   * Determine installation type
   */
  determineInstallType(packageInfo, repoData) {
    if (repoData.primaryLanguage) {
      const lang = repoData.primaryLanguage.toLowerCase();
      if (lang === 'python') return 'pipx';
      if (lang === 'rust') return 'cargo';
      if (lang === 'go') return 'go';
    }
    
    return 'npm'; // Default
  }

  /**
   * Check if repository has recent activity
   */
  isRecentlyActive(lastUpdated) {
    if (!lastUpdated) return false;
    
    try {
      const updateDate = new Date(lastUpdated);
      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
      return updateDate > sixMonthsAgo;
    } catch (error) {
      return false;
    }
  }

  /**
   * Deduplicate repositories
   */
  deduplicateRepositories(repositories) {
    const seen = new Map();
    
    for (const repo of repositories) {
      const key = `${repo.owner}/${repo.repository}`;
      
      if (!seen.has(key)) {
        seen.set(key, repo);
      } else {
        // Keep the one with better description
        const existing = seen.get(key);
        if (repo.description && repo.description.length > (existing.description || '').length) {
          seen.set(key, repo);
        }
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      await this.webScraper.close();
    } catch (error) {
      console.warn(`Failed to cleanup WebScraper: ${error.message}`);
    }
  }
}

module.exports = { GitHubEnhancedDiscovery };