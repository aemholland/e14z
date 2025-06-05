/**
 * NPM Package Scraper Module
 * Extracts detailed MCP information from NPM packages
 */

const https = require('https');
const path = require('path');
const { AIEnhancedScraper } = require('./ai-enhanced-scraper');
const { ClaudePoweredAnalyzer } = require('./claude-powered-analyzer');
const { AgentOptimizedAnalyzer } = require('./agent-optimized-analyzer');
const { WebScraper } = require('./web-scraper');
const { SlugGenerator } = require('../utils/slug-generator');
const { AIPoweredSlugGenerator } = require('../utils/ai-powered-slug-generator');
const { ToolExtractor } = require('../utils/tool-extractor');
const { MetadataExtractor } = require('../utils/metadata-extractor');
const { InstallationExtractor } = require('../utils/installation-extractor');
const { AgentOptimizedTagger } = require('../utils/agent-optimized-tagger');
const { AuthRequirementsExtractor } = require('../utils/auth-requirements-extractor');

class NPMScraper {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.userAgent = 'e14z-mcp-crawler/1.0.0';
    this.githubToken = process.env.GITHUB_TOKEN; // Optional for higher rate limits
    this.useAI = options.useAI !== false; // Enable AI by default
    this.useWebScraper = options.useWebScraper !== false; // Enable web scraping by default
    this.aiScraper = new AIEnhancedScraper(options);
    this.webScraper = new WebScraper(options);
    this.claudeAnalyzer = new ClaudePoweredAnalyzer(options);
    this.agentAnalyzer = new AgentOptimizedAnalyzer(options);
  }

  /**
   * Scrape detailed MCP information from NPM package
   */
  async scrapeMCPPackage(packageInfo) {
    console.log(`🔍 Scraping package: ${packageInfo.name}`);

    try {
      // Get detailed package info from NPM
      const npmDetails = await this.getNPMPackageDetails(packageInfo.name);
      
      // Check if we got valid npm details
      if (!npmDetails) {
        throw new Error(`Package ${packageInfo.name} not found on NPM registry`);
      }
      
      // Get additional info from GitHub if available
      let githubInfo = null;
      if (packageInfo.repository || npmDetails.repository) {
        githubInfo = await this.getGitHubInfo(packageInfo.repository || npmDetails.repository?.url);
      }

      // Enhanced documentation scraping with web scraper
      let webScrapedDocs = null;
      if (this.useWebScraper) {
        webScrapedDocs = await this.scrapeDocumentationSites(npmDetails, githubInfo);
      }

      // Combine all documentation sources
      const documentation = [
        githubInfo?.readme || '',
        npmDetails.readme || '',
        npmDetails.description || '',
        webScrapedDocs || ''
      ].join('\n\n');

      // Extract MCP-specific information
      let mcpData;
      
      // Use Claude-powered analysis for 10/10 quality
      if (this.useAI) {
        console.log(`   🧠 Using Claude to analyze ${packageInfo.name}...`);
        
        // Pass execution result if available (for tool extraction and health status)
        const executionResult = null; // Will be updated during validation phase
        
        // Use both Claude and Agent analyzers for complete coverage
        const claudeAnalysis = await this.claudeAnalyzer.analyzePackageComprehensively(
          packageInfo, npmDetails, githubInfo, executionResult, webScrapedDocs
        );
        
        const agentAnalysis = await this.agentAnalyzer.analyzeForAgents(
          packageInfo, npmDetails, githubInfo, executionResult, webScrapedDocs
        );
        
        // Merge both analyses for optimal agent and human use
        mcpData = {
          // Core MCP data (from AI analysis - Claude & Agent optimized)
          tools: agentAnalysis.tools.list || claudeAnalysis.tools || [],
          authMethod: agentAnalysis.installation.auth_method || claudeAnalysis.authMethod || 'none',
          connectionType: agentAnalysis.technical.connection_type || 'stdio',
          protocolVersion: agentAnalysis.technical.protocol_version || this.detectProtocolVersion(npmDetails),
          
          // AI-generated content (natural, not robotic)
          aiDescription: agentAnalysis.description || claudeAnalysis.description,
          aiTags: agentAnalysis.tags || claudeAnalysis.tags || [],
          detailedUseCases: agentAnalysis.use_cases || claudeAnalysis.useCases || [],
          aiCategory: agentAnalysis.category || claudeAnalysis.category,
          
          // Installation methods (store original commands for e14z auto-installer)
          installationMethods: [agentAnalysis.installation.primary_method, ...agentAnalysis.installation.alternative_methods],
          
          // Authentication and setup (analyzed by AI)
          authRequired: agentAnalysis.installation.auth_method !== 'none',
          setupComplexity: claudeAnalysis.setupComplexity || 'simple',
          
          // Resource URLs (discovered by agents)
          githubUrl: agentAnalysis.resources.github_url,
          documentationUrl: agentAnalysis.resources.documentation_url,
          websiteUrl: agentAnalysis.resources.website_url,
          
          // Provider info (extracted by AI)
          author: agentAnalysis.provider.author,
          company: agentAnalysis.provider.company,
          license: agentAnalysis.provider.license
        };
      } else {
        // Fallback to traditional extraction
        mcpData = await this.extractMCPData(npmDetails, githubInfo);
      }

      // Extract structured authentication requirements
      const authRequirements = AuthRequirementsExtractor.extractAuthRequirements(
        null, // No validation result yet (extracted during live validation)
        documentation,
        '' // No error message yet
      );

      // Merge auth requirements with existing mcpData
      mcpData = {
        ...mcpData,
        auth_required: authRequirements.auth_required || mcpData.auth_required,
        auth_methods: authRequirements.auth_methods.length > 0 ? authRequirements.auth_methods : mcpData.auth_methods,
        required_env_vars: authRequirements.required_env_vars.length > 0 ? authRequirements.required_env_vars : mcpData.required_env_vars,
        optional_env_vars: authRequirements.optional_env_vars.length > 0 ? authRequirements.optional_env_vars : mcpData.optional_env_vars,
        setup_instructions: authRequirements.auth_instructions || mcpData.setup_instructions,
        credentials_needed: authRequirements.credentials_needed,
        setup_complexity: authRequirements.setup_complexity,
        auth_summary: AuthRequirementsExtractor.generateAuthSummary(authRequirements)
      };

      // Generate intelligent slug based on package officialness
      const intelligentSlug = await AIPoweredSlugGenerator.generateIntelligentSlug({
        name: packageInfo.name,
        author: this.extractAuthor(npmDetails.author),
        company: this.extractCompany(npmDetails, githubInfo),
        repository: npmDetails.repository?.url || packageInfo.repository,
        description: npmDetails.description
      }, 'npm');

      return {
        // Basic package info
        name: packageInfo.name,
        slug: intelligentSlug,
        description: mcpData.aiDescription || this.enhanceDescription(npmDetails, githubInfo, mcpData.tools) || npmDetails.description || packageInfo.description,
        display_name: mcpData.display_name,
        short_description: mcpData.short_description,
        
        // Installation  
        install_type: 'npm',
        endpoint: this.extractInstallCommand(npmDetails) || `npx ${packageInfo.name}`,
        auto_install_command: mcpData.quick_start || this.extractInstallCommand(npmDetails) || `npx ${packageInfo.name}`,
        
        // MCP specific
        tools: mcpData.tools,
        toolExtractionMethod: 'ai_enhanced', // Mark that we used AI + MCP protocol
        auth_method: mcpData.auth_required ? (mcpData.auth_methods?.[0] || 'api_key') : 'none',
        connection_type: mcpData.connectionType,
        protocol_version: mcpData.protocolVersion,
        transports: mcpData.transports,
        
        // Authentication & Setup
        auth_required: mcpData.auth_required || false,
        auth_methods: mcpData.auth_methods || [],
        required_env_vars: mcpData.required_env_vars || [],
        optional_env_vars: mcpData.optional_env_vars || [],
        setup_instructions: mcpData.setup_instructions,
        credentials_needed: mcpData.credentials_needed || [],
        setup_complexity: mcpData.setup_complexity || 'simple',
        auth_summary: mcpData.auth_summary,
        
        // Technical Details
        runtime_requirements: mcpData.runtime_requirements,
        platforms: mcpData.platforms,
        language_version: mcpData.language_version,
        prerequisites: mcpData.prerequisites,
        
        // AI-optimized categorization using predefined categories only (keep hyphens for search efficiency)
        category: mcpData.aiCategory || this.categorizePackage(npmDetails, mcpData.tools),
        tags: mcpData.aiTags || AgentOptimizedTagger.generateTags(packageInfo, mcpData.tools, documentation),
        use_cases: mcpData.detailedUseCases || AgentOptimizedTagger.generateUseCases(mcpData.tools, documentation),
        
        // Installation methods (only supported package managers)
        installation_methods: InstallationExtractor.extractSupportedMethods(packageInfo, documentation),
        
        // Quality & Trust (scoring handled by external pulse/review system)
        verified: false, // Will be validated later
        health_status: 'unknown',
        auto_discovered: true,
        discovery_source: 'npm',
        
        // Package metadata (for reference, not scoring)
        last_publish: mcpData.last_publish,
        stars: mcpData.stars || githubInfo?.stars,
        
        // Links & Documentation
        github_url: this.extractGitHubUrl(packageInfo.repository || npmDetails.repository?.url),
        documentation_url: this.extractDocumentationUrl(npmDetails, githubInfo),
        website_url: npmDetails.homepage,
        community: mcpData.community,
        
        // Author & License
        author: this.extractAuthor(npmDetails.author),
        company: this.extractCompany(npmDetails, githubInfo),
        license: npmDetails.license || 'Unknown',
        
        // Pricing & Usage
        pricing_model: mcpData.pricing_info?.model || 'free',
        pricing_details: mcpData.pricing_info?.details || {},
        rate_limits: mcpData.rate_limits,
        
        // Related Information
        alternatives: mcpData.alternatives,
        related_packages: mcpData.related_packages,
        integrations: mcpData.integrations,
        known_issues: mcpData.known_issues,
        
        // Metadata
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_scraped_at: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Failed to scrape ${packageInfo.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get detailed package information from NPM registry
   */
  async getNPMPackageDetails(packageName) {
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
   * Get additional information from GitHub repository
   */
  async getGitHubInfo(repositoryUrl) {
    if (!repositoryUrl) return null;

    try {
      const repoPath = this.extractGitHubRepoPath(repositoryUrl);
      if (!repoPath) return null;

      // Get repository info
      const repoInfo = await this.fetchGitHubAPI(`/repos/${repoPath}`);
      
      // Get README content
      let readme = null;
      try {
        const readmeData = await this.fetchGitHubAPI(`/repos/${repoPath}/readme`);
        if (readmeData.content) {
          readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
        }
      } catch (error) {
        // README not found, continue without it
      }

      return {
        stars: repoInfo.stargazers_count,
        forks: repoInfo.forks_count,
        issues: repoInfo.open_issues_count,
        language: repoInfo.language,
        created_at: repoInfo.created_at,
        updated_at: repoInfo.updated_at,
        readme: readme,
        topics: repoInfo.topics || []
      };

    } catch (error) {
      console.warn(`   Failed to get GitHub info: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract MCP-specific data from package
   */
  async extractMCPData(npmDetails, githubInfo) {
    // Combine all documentation sources
    const documentation = [
      githubInfo?.readme || '',
      npmDetails.readme || '',
      npmDetails.description || ''
    ].join('\n\n');
    
    // Extract tools using the new extractor
    const tools = ToolExtractor.extractFromContent(documentation, 'npm');
    
    // Also try legacy extraction methods
    const legacyTools = await this.extractTools(npmDetails, githubInfo);
    
    // Merge tools, preferring extracted ones with better metadata
    const mergedTools = this.mergeTools(tools, legacyTools);
    
    // Extract comprehensive metadata
    const metadata = await MetadataExtractor.extractComplete(npmDetails, documentation);
    
    return {
      tools: mergedTools,
      authMethod: metadata.auth_required ? 
        (metadata.auth_methods[0] || 'api_key') : 'none',
      connectionType: metadata.connection_types?.[0] || 
        this.detectConnectionType(npmDetails),
      protocolVersion: metadata.protocol_version || 
        this.detectProtocolVersion(npmDetails),
      ...metadata // Include all extracted metadata
    };
  }

  /**
   * Merge tools from different sources
   */
  mergeTools(primaryTools, secondaryTools) {
    const merged = new Map();
    
    // Add primary tools (from ToolExtractor)
    for (const tool of primaryTools) {
      merged.set(tool.name.toLowerCase(), tool);
    }
    
    // Add secondary tools if not already present
    for (const tool of secondaryTools) {
      const key = tool.name.toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, tool);
      } else {
        // Enhance existing tool with additional info
        const existing = merged.get(key);
        if (!existing.description && tool.description) {
          existing.description = tool.description;
        }
        if (!existing.parameters?.length && tool.parameters?.length) {
          existing.parameters = tool.parameters;
        }
      }
    }
    
    return Array.from(merged.values());
  }

  /**
   * Extract available tools from package
   */
  async extractTools(npmDetails, githubInfo) {
    const tools = [];

    // Strategy 1: Parse from README if available
    if (githubInfo?.readme) {
      const readmeTools = this.parseToolsFromReadme(githubInfo.readme);
      tools.push(...readmeTools);
    }

    // Strategy 2: Analyze package.json scripts
    if (npmDetails.scripts) {
      const scriptTools = this.parseToolsFromScripts(npmDetails.scripts);
      tools.push(...scriptTools);
    }

    // Strategy 3: Infer from package name and description
    const inferredTools = this.inferToolsFromMetadata(npmDetails);
    tools.push(...inferredTools);

    // Strategy 4: Check dependencies for tool patterns
    const dependencyTools = this.inferToolsFromDependencies(npmDetails.dependencies || {});
    tools.push(...dependencyTools);

    // Deduplicate and validate tools
    return this.deduplicateTools(tools);
  }

  /**
   * Parse tools from README documentation
   */
  parseToolsFromReadme(readme) {
    const tools = [];
    
    // Look for tools sections in README
    const toolPatterns = [
      /## Tools?\s*\n(.*?)(?=\n##|\n#|$)/gis,
      /### Available Tools?\s*\n(.*?)(?=\n##|\n#|$)/gis,
      /\*\*Tools?\*\*:?\s*(.*?)(?=\n\n|\n\*\*|$)/gis
    ];

    for (const pattern of toolPatterns) {
      const matches = readme.match(pattern);
      if (matches) {
        for (const match of matches) {
          const toolEntries = this.parseToolEntries(match);
          tools.push(...toolEntries);
        }
      }
    }

    // Look for function/method definitions that might be tools
    const functionPatterns = [
      /(?:function|async function|const|let)\s+(\w+)\s*[=\(]/g,
      /(\w+):\s*async?\s*\(/g
    ];

    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(readme)) !== null) {
        const functionName = match[1];
        if (this.isLikelyToolName(functionName)) {
          tools.push({
            name: functionName,
            description: `Tool function: ${functionName}`,
            category: 'development-tools',
            parameters: []
          });
        }
      }
    }

    return tools;
  }

  /**
   * Parse individual tool entries from text
   */
  parseToolEntries(text) {
    const tools = [];
    
    // Look for list items with tool descriptions
    const listItemPattern = /[-*]\s*`?(\w+)`?\s*[:-]?\s*(.*?)(?=\n[-*]|\n\n|$)/g;
    let match;
    
    while ((match = listItemPattern.exec(text)) !== null) {
      const name = match[1];
      const description = match[2].trim();
      
      if (this.isLikelyToolName(name)) {
        tools.push({
          name: name,
          description: description || `Tool: ${name}`,
          category: this.categorizeToolByName(name),
          parameters: this.extractParametersFromDescription(description)
        });
      }
    }

    return tools;
  }

  /**
   * Infer tools from package metadata
   */
  inferToolsFromMetadata(npmDetails) {
    const tools = [];
    
    // Add safety check
    if (!npmDetails || !npmDetails.name) {
      console.warn('⚠️  npmDetails or npmDetails.name is undefined');
      return tools;
    }
    
    const name = npmDetails.name.toLowerCase();
    const description = (npmDetails.description || '').toLowerCase();

    // Common MCP tool patterns based on package names
    const toolPatterns = [
      { pattern: /stripe|payment/, tools: ['create_payment', 'list_payments', 'refund_payment'] },
      { pattern: /database|db|sql/, tools: ['query_database', 'list_tables', 'insert_data'] },
      { pattern: /file|filesystem/, tools: ['read_file', 'write_file', 'list_files'] },
      { pattern: /search|query/, tools: ['search', 'query'] },
      { pattern: /email|mail/, tools: ['send_email', 'list_emails'] },
      { pattern: /calendar/, tools: ['create_event', 'list_events'] },
      { pattern: /web|http|api/, tools: ['fetch_url', 'make_request'] },
      { pattern: /git|github/, tools: ['create_issue', 'list_repos', 'get_commits'] },
      { pattern: /slack/, tools: ['send_message', 'list_channels'] },
      { pattern: /notion/, tools: ['create_page', 'query_database'] }
    ];

    for (const { pattern, tools: toolNames } of toolPatterns) {
      if (pattern.test(name) || pattern.test(description)) {
        for (const toolName of toolNames) {
          tools.push({
            name: toolName,
            description: `${toolName.replace(/_/g, ' ')} functionality`,
            category: this.categorizeToolByName(toolName),
            parameters: []
          });
        }
        break; // Only match first pattern to avoid duplicates
      }
    }

    return tools;
  }

  /**
   * Detect authentication method
   */
  detectAuthMethod(npmDetails, githubInfo, tools) {
    if (!npmDetails || !npmDetails.name) {
      return 'none';
    }
    
    const name = npmDetails.name.toLowerCase();
    const description = (npmDetails.description || '').toLowerCase();
    const readme = githubInfo?.readme?.toLowerCase() || '';

    // Check for explicit auth patterns
    const authPatterns = [
      { pattern: /api[_\s]?key|token/i, method: 'api_key' },
      { pattern: /oauth|authorize/i, method: 'oauth' },
      { pattern: /jwt|bearer/i, method: 'token' },
      { pattern: /username.*password|credentials/i, method: 'credentials' },
      { pattern: /no[_\s]?auth|unauthenticated|anonymous/i, method: 'none' }
    ];

    for (const { pattern, method } of authPatterns) {
      if (pattern.test(readme) || pattern.test(description)) {
        return method;
      }
    }

    // Infer from service integrations
    const servicePatterns = [
      { pattern: /stripe|openai|anthropic|github|slack|notion/, method: 'api_key' },
      { pattern: /google|microsoft|oauth/, method: 'oauth' },
      { pattern: /filesystem|local|file/, method: 'none' }
    ];

    for (const { pattern, method } of servicePatterns) {
      if (pattern.test(name) || pattern.test(description)) {
        return method;
      }
    }

    // Default based on tools
    const hasExternalServiceTools = tools.some(tool => 
      ['api', 'service', 'cloud'].includes(tool.category)
    );

    return hasExternalServiceTools ? 'api_key' : 'none';
  }

  /**
   * Detect connection type
   */
  detectConnectionType(npmDetails) {
    // Most NPM MCP servers use stdio
    return 'stdio';
  }

  /**
   * Detect MCP protocol version
   */
  detectProtocolVersion(npmDetails) {
    const dependencies = {
      ...npmDetails.dependencies,
      ...npmDetails.devDependencies
    };

    // Try to infer from SDK version
    const mcpSdk = dependencies['@modelcontextprotocol/sdk'];
    if (mcpSdk) {
      // Map SDK versions to protocol versions
      if (mcpSdk.includes('^1.') || mcpSdk.includes('~1.')) {
        return '2024-11-05'; // Current protocol version
      }
    }

    return '2024-11-05'; // Default to current version
  }

  /**
   * Categorize package into MCP categories
   */
  categorizePackage(npmDetails, tools) {
    if (!npmDetails || !npmDetails.name) {
      return 'development-tools';  // Default to valid category
    }
    
    const name = npmDetails.name.toLowerCase();
    const description = (npmDetails.description || '').toLowerCase();

    // Service-specific categorization
    const categoryPatterns = [
      { pattern: /stripe|payment|billing|invoice/, category: 'payments' },
      { pattern: /database|sql|postgres|mysql|mongo/, category: 'databases' },
      { pattern: /content|blog|cms|write/, category: 'content-creation' },
      { pattern: /ai|gpt|openai|anthropic|claude/, category: 'ai-tools' },
      { pattern: /dev|development|git|github|code/, category: 'development-tools' },
      { pattern: /storage|s3|drive|cloud/, category: 'cloud-storage' },
      { pattern: /slack|email|chat|message/, category: 'communication' },
      { pattern: /server|deploy|infra|docker/, category: 'infrastructure' },
      { pattern: /calendar|task|todo|productivity/, category: 'productivity' },
      { pattern: /project|jira|trello|manage/, category: 'project-management' },
      { pattern: /security|auth|encrypt/, category: 'security' },
      { pattern: /social|twitter|facebook/, category: 'social-media' },
      { pattern: /api|web|http|rest/, category: 'web-apis' },
      { pattern: /finance|bank|trading/, category: 'finance' },
      { pattern: /research|academic|paper/, category: 'research' },
      { pattern: /iot|device|sensor/, category: 'iot' }
    ];

    for (const { pattern, category } of categoryPatterns) {
      if (pattern.test(name) || pattern.test(description)) {
        return category;
      }
    }

    // Categorize by tool types
    if (tools.length > 0) {
      const toolCategories = tools.map(t => t.category);
      const mostCommonCategory = this.getMostCommonCategory(toolCategories);
      const categoryMap = {
        'database': 'databases',
        'api': 'web-apis',
        'file': 'development-tools',
        'utility': 'productivity'
      };
      
      if (categoryMap[mostCommonCategory]) {
        return categoryMap[mostCommonCategory];
      }
    }

    return 'development-tools';  // Default to valid category
  }

  /**
   * Helper methods
   */
  generateSlug(packageName, githubInfo = null) {
    // Check if this is an official package (MCP official or service official)
    const isOfficial = this.isOfficialPackage(packageName, githubInfo);
    
    if (isOfficial) {
      // Official: use clean slug without username
      if (packageName.startsWith('@')) {
        // Scoped package: @modelcontextprotocol/server-filesystem → server-filesystem
        return packageName
          .split('/')[1]
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      } else {
        // Non-scoped official package: stripe → stripe
        return packageName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      }
    } else {
      // Community: use {package-name}-{github-username} format
      const baseSlug = packageName
        .toLowerCase()
        .replace(/[@/]/g, '-')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Try to extract GitHub username from repository info
      let githubUsername = null;
      if (githubInfo && githubInfo.repository) {
        const repoPath = this.extractGitHubRepoPath(githubInfo.repository);
        if (repoPath) {
          githubUsername = repoPath.split('/')[0];
        }
      }
      
      // If we have GitHub username and it's not already in the package name
      if (githubUsername && !baseSlug.includes(githubUsername.toLowerCase())) {
        return `${baseSlug}-${githubUsername.toLowerCase()}`;
      }
      
      // Fallback to just the package name
      return baseSlug;
    }
  }

  /**
   * Determine if a package is from an official organization
   */
  isOfficialPackage(packageName, githubInfo) {
    // 1. MCP Protocol official packages
    if (packageName.startsWith('@modelcontextprotocol/') || 
        packageName.startsWith('@anthropic-ai/')) {
      return true;
    }
    
    // 2. Check if GitHub repository matches the package name (indicating official ownership)
    if (githubInfo?.repository) {
      const repoPath = this.extractGitHubRepoPath(githubInfo.repository);
      if (repoPath) {
        const [githubOrg, repoName] = repoPath.split('/');
        const packageBaseName = packageName.replace(/^@[^/]+\//, '').replace(/[^a-z0-9]/gi, '');
        
        // Official indicators:
        // - GitHub org matches package name (stripe/stripe-node, openai/openai-node)
        // - Package name matches org (axios from axios/axios)
        // - Well-known official patterns
        const isOrgMatch = githubOrg.toLowerCase() === packageBaseName.toLowerCase() ||
                          packageBaseName.toLowerCase().includes(githubOrg.toLowerCase()) ||
                          githubOrg.toLowerCase() === packageName.toLowerCase();
        
        if (isOrgMatch) {
          return true;
        }
        
        // Known official organizations
        const officialOrgs = [
          'stripe', 'openai', 'anthropic-ai', 'microsoft', 'google', 'facebook',
          'vercel', 'supabase', 'slack-api', 'github', 'notion', 'discord',
          'aws', 'mongodb', 'redis', 'elastic', 'postgresql'
        ];
        
        if (officialOrgs.includes(githubOrg.toLowerCase())) {
          return true;
        }
      }
    }
    
    // 3. Known official package patterns (even without GitHub info)
    const officialPackagePatterns = [
      /^stripe$/,
      /^@stripe\//,
      /^openai$/,
      /^@openai\//,
      /^axios$/,
      /^@supabase\//,
      /^@vercel\//,
      /^@slack\//,
      /^@microsoft\//,
      /^@google\//,
      /^discord\.js$/,
      /^@discordjs\//
    ];
    
    return officialPackagePatterns.some(pattern => pattern.test(packageName));
  }

  extractInstallCommand(npmDetails) {
    // Debug logging
    console.log(`   🔧 Extracting install command for: ${npmDetails?.name || 'unknown'}`);
    
    if (!npmDetails || !npmDetails.name) {
      console.log(`   ⚠️ npmDetails or name missing, using fallback`);
      return `npx ${npmDetails?.name || 'unknown-package'}`;
    }
    
    // Check if package has bin entries (executable)
    if (npmDetails.bin) {
      console.log(`   ✅ Package has bin entries, using npx`);
      return `npx ${npmDetails.name}`;
    }

    // Default to npx
    console.log(`   ✅ Using default npx command`);
    return `npx ${npmDetails.name}`;
  }

  extractAuthor(author) {
    if (typeof author === 'string') return author;
    if (typeof author === 'object' && author.name) return author.name;
    return null;
  }

  extractCompany(npmDetails, githubInfo) {
    // Try to extract organization from author or repository
    const author = this.extractAuthor(npmDetails.author);
    if (author && author.includes(' ')) {
      return author; // Might be a company name
    }
    
    if (githubInfo && npmDetails.repository?.url) {
      const repoPath = this.extractGitHubRepoPath(npmDetails.repository.url);
      if (repoPath) {
        const org = repoPath.split('/')[0];
        if (org !== author?.toLowerCase()) {
          return org;
        }
      }
    }
    
    return null;
  }

  calculateQualityScore(npmDetails, githubInfo) {
    let score = 0;
    
    // Basic package health
    if (npmDetails.description && npmDetails.description.length > 30) score += 10;
    if (npmDetails.keywords && npmDetails.keywords.length > 0) score += 5;
    if (npmDetails.license) score += 5;
    if (npmDetails.repository) score += 10;
    if (npmDetails.homepage) score += 5;
    
    // GitHub metrics
    if (githubInfo) {
      if (githubInfo.stars > 10) score += 10;
      if (githubInfo.stars > 50) score += 10;
      if (githubInfo.readme) score += 15;
      if (githubInfo.issues < 10) score += 5;
      
      // Recent activity
      const lastUpdate = new Date(githubInfo.updated_at);
      const threeMonthsAgo = new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000);
      if (lastUpdate > threeMonthsAgo) score += 10;
    }
    
    // MCP SDK dependency
    const dependencies = { ...npmDetails.dependencies, ...npmDetails.devDependencies };
    if (dependencies['@modelcontextprotocol/sdk']) score += 20;
    
    return Math.min(score, 100);
  }

  // Additional helper methods...
  extractGitHubRepoPath(url) {
    if (!url) return null;
    const match = url.match(/github\.com[\/:]([^\/]+\/[^\/]+)/);
    return match ? match[1].replace(/\.git$/, '') : null;
  }

  async fetchGitHubAPI(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: path,
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
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`Failed to parse GitHub response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  isLikelyToolName(name) {
    return name.length > 2 && 
           name.length < 50 && 
           /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) &&
           !['function', 'const', 'let', 'var', 'class'].includes(name);
  }

  categorizeToolByName(toolName) {
    const name = toolName.toLowerCase();
    
    if (name.includes('database') || name.includes('sql') || name.includes('query')) return 'database';
    if (name.includes('file') || name.includes('read') || name.includes('write')) return 'file';
    if (name.includes('api') || name.includes('request') || name.includes('fetch')) return 'api';
    if (name.includes('search') || name.includes('find')) return 'search';
    if (name.includes('create') || name.includes('generate')) return 'generation';
    if (name.includes('send') || name.includes('message')) return 'communication';
    
    return 'utility';
  }

  extractParametersFromDescription(description) {
    // Simple parameter extraction from description
    const params = [];
    const paramPattern = /\b(\w+):\s*([^,\n]+)/g;
    let match;
    
    while ((match = paramPattern.exec(description)) !== null) {
      params.push({
        name: match[1],
        type: 'string',
        required: true,
        description: match[2].trim()
      });
    }
    
    return params;
  }

  deduplicateTools(tools) {
    const seen = new Set();
    return tools.filter(tool => {
      const key = tool.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  getMostCommonCategory(categories) {
    const counts = {};
    categories.forEach(cat => counts[cat] = (counts[cat] || 0) + 1);
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'utility');
  }

  // Enhanced description generation
  enhanceDescription(npmDetails, githubInfo, tools) {
    let description = npmDetails.description || '';
    
    // If description is too short, enhance it
    if (description.length < 50) {
      const enhancements = [];
      
      // Add tool summary
      if (tools && tools.length > 0) {
        const toolNames = tools.slice(0, 3).map(t => t.name).join(', ');
        enhancements.push(`Provides ${tools.length} tools including ${toolNames}`);
      }
      
      // Add category context
      const category = this.categorizePackage(npmDetails, tools);
      if (category && category !== 'other') {
        enhancements.push(`for ${category.replace('-', ' ')}`);
      }
      
      // Add auth context
      if (this.detectAuthMethod(npmDetails, githubInfo, tools) === 'none') {
        enhancements.push('No authentication required');
      }
      
      // Combine original + enhancements
      if (enhancements.length > 0) {
        description = description + 
          (description ? '. ' : 'MCP server ') + 
          enhancements.join('. ') + '.';
      }
    }
    
    // Ensure description is not too long for UI
    if (description.length > 500) {
      description = description.substring(0, 497) + '...';
    }
    
    return description;
  }

  generateUseCases(tools, description) {
    const useCases = new Set();
    
    // 1. Generate from tools (more specific)
    if (tools && tools.length > 0) {
      tools.forEach(tool => {
        // Create readable use case from tool name
        const action = tool.name
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .toLowerCase();
        
        const useCase = action.charAt(0).toUpperCase() + action.slice(1);
        
        // Add context from tool description if available
        if (tool.description && tool.description.length > 10) {
          useCases.add(tool.description.charAt(0).toUpperCase() + tool.description.slice(1));
        } else {
          useCases.add(useCase);
        }
      });
    }
    
    // 2. Extract from description (find action phrases)
    if (description) {
      // Look for phrases starting with verbs
      const actionPhrases = description.match(/\b(create|manage|generate|fetch|query|send|receive|monitor|analyze|process|integrate|automate|search|find|get|list|update|delete|read|write)\b[^.!?]{5,50}/gi) || [];
      
      actionPhrases.forEach(phrase => {
        const cleaned = phrase.trim()
          .charAt(0).toUpperCase() + phrase.trim().slice(1);
        if (cleaned.length > 10 && cleaned.length < 100) {
          useCases.add(cleaned);
        }
      });
    }
    
    // 3. Generate category-specific use cases if needed
    if (useCases.size < 2) {
      const category = this.categorizePackage({ description }, tools);
      const categoryUseCases = {
        'payments': ['Process payments', 'Manage transactions', 'Handle refunds'],
        'databases': ['Query databases', 'Manage data', 'Execute SQL commands'],
        'ai-tools': ['Generate AI responses', 'Process language models', 'Enhance AI capabilities'],
        'communication': ['Send messages', 'Manage communications', 'Handle notifications'],
        'web-apis': ['Fetch data from APIs', 'Make HTTP requests', 'Integrate web services']
      };
      
      if (categoryUseCases[category]) {
        categoryUseCases[category].forEach(uc => useCases.add(uc));
      }
    }
    
    // Convert to array and limit
    return Array.from(useCases)
      .filter(uc => uc.length > 5)
      .slice(0, 8); // Allow more use cases for better understanding
  }

  extractTags(npmDetails, mcpData) {
    const tags = new Set();
    
    // 1. Add from NPM keywords (most relevant)
    if (npmDetails.keywords) {
      npmDetails.keywords.forEach(keyword => {
        if (keyword.length >= 2 && keyword.length < 30) {
          tags.add(keyword.toLowerCase());
        }
      });
    }
    
    // 2. Add from package name parts
    const nameParts = npmDetails.name.split(/[-_@/]/);
    nameParts.forEach(part => {
      if (part.length > 2 && part.length < 20 && part !== 'server') {
        tags.add(part.toLowerCase());
      }
    });
    
    // 3. Add MCP-specific tags
    tags.add('mcp');
    tags.add('model-context-protocol');
    tags.add('ai-tools'); // Help with discovery
    
    // 4. Add auth-related tags for agent filtering
    if (mcpData.authMethod === 'none') {
      tags.add('no-auth');
      tags.add('auth-free');
      tags.add('anonymous');
    } else {
      tags.add('auth-required');
      tags.add(mcpData.authMethod); // 'api_key', 'oauth', etc.
    }
    
    // 5. Add from tool names and categories
    if (mcpData.tools && mcpData.tools.length > 0) {
      // Add tool-based tags
      mcpData.tools.forEach(tool => {
        const toolWords = tool.name.split(/[_-]/).filter(w => w.length > 2);
        toolWords.forEach(word => {
          if (word.length < 15) tags.add(word.toLowerCase());
        });
        
        // Add tool category as tag
        if (tool.category) {
          tags.add(tool.category.toLowerCase());
        }
      });
      
      tags.add('has-tools');
      tags.add(`${mcpData.tools.length}-tools`);
    }
    
    // 6. Add category-based tags
    const category = this.categorizePackage(npmDetails, mcpData.tools);
    if (category) {
      tags.add(category);
      // Add related tags for category
      const categoryTags = {
        'payments': ['payment', 'billing', 'invoice', 'transaction'],
        'databases': ['database', 'db', 'sql', 'query', 'data'],
        'ai-tools': ['ai', 'llm', 'gpt', 'claude', 'anthropic'],
        'communication': ['chat', 'message', 'email', 'slack'],
        'development-tools': ['dev', 'code', 'git', 'github'],
        'web-apis': ['api', 'http', 'rest', 'web']
      };
      
      if (categoryTags[category]) {
        categoryTags[category].forEach(tag => tags.add(tag));
      }
    }
    
    // 7. Extract relevant words from description
    if (npmDetails.description) {
      const descWords = npmDetails.description.toLowerCase()
        .match(/\b[a-z]+\b/g) || [];
      
      const relevantWords = ['api', 'client', 'server', 'tool', 'integration', 
                            'automation', 'assistant', 'bot', 'scraper', 'search',
                            'database', 'storage', 'auth', 'oauth', 'token'];
      
      descWords.forEach(word => {
        if (relevantWords.includes(word) && !tags.has(word)) {
          tags.add(word);
        }
      });
    }
    
    // 8. Add package health/quality indicators
    if (npmDetails.version && !npmDetails.version.startsWith('0.')) {
      tags.add('stable');
    } else {
      tags.add('beta');
    }
    
    // Remove duplicates and limit to reasonable number
    const finalTags = Array.from(tags)
      .filter(tag => tag && tag.length > 1) // Remove empty or single char tags
      .slice(0, 25); // Increased limit for better search coverage
    
    return finalTags;
  }

  extractDocumentationUrl(npmDetails, githubInfo) {
    // Priority: explicit docs URL > GitHub README > homepage
    if (npmDetails.homepage && npmDetails.homepage.includes('docs')) {
      return npmDetails.homepage;
    }
    
    if (githubInfo && npmDetails.repository) {
      const repoPath = this.extractGitHubRepoPath(npmDetails.repository.url);
      if (repoPath) {
        return `https://github.com/${repoPath}#readme`;
      }
    }
    
    return npmDetails.homepage;
  }

  extractGitHubUrl(repositoryUrl) {
    if (!repositoryUrl) return null;
    
    const repoPath = this.extractGitHubRepoPath(repositoryUrl);
    return repoPath ? `https://github.com/${repoPath}` : null;
  }

  parseToolsFromScripts(scripts) {
    const tools = [];
    
    Object.keys(scripts).forEach(scriptName => {
      if (scriptName.includes('mcp') || scriptName.includes('server') || scriptName.includes('start')) {
        tools.push({
          name: scriptName,
          description: `Script: ${scriptName}`,
          category: 'utility',
          parameters: []
        });
      }
    });
    
    return tools;
  }

  inferToolsFromDependencies(dependencies) {
    const tools = [];
    
    // Common dependency patterns that indicate specific tools
    const depPatterns = [
      { dep: 'stripe', tools: ['create_payment', 'list_payments'] },
      { dep: 'openai', tools: ['generate_text', 'create_completion'] },
      { dep: 'axios', tools: ['fetch_url', 'make_request'] },
      { dep: 'fs', tools: ['read_file', 'write_file'] }
    ];
    
    Object.keys(dependencies).forEach(dep => {
      const pattern = depPatterns.find(p => dep.includes(p.dep));
      if (pattern) {
        pattern.tools.forEach(toolName => {
          tools.push({
            name: toolName,
            description: `Tool using ${dep}`,
            category: 'web-apis',
            parameters: []
          });
        });
      }
    });
    
    return tools;
  }

  calculateAIQualityScore(qualitySignals, npmDetails, githubInfo) {
    let score = this.calculateQualityScore(npmDetails, githubInfo);
    
    // Adjust based on AI quality signals
    if (qualitySignals?.productionReady) score += 10;
    
    if (qualitySignals?.documentationQuality === 'excellent') score += 15;
    else if (qualitySignals?.documentationQuality === 'good') score += 10;
    else if (qualitySignals?.documentationQuality === 'basic') score += 5;
    
    if (qualitySignals?.maintenanceStatus === 'actively-maintained') score += 15;
    else if (qualitySignals?.maintenanceStatus === 'maintained') score += 10;
    else if (qualitySignals.maintenanceStatus === 'possibly-abandoned') score -= 10;
    
    // Deduct points for limitations
    score -= (qualitySignals.limitations?.length || 0) * 5;
    
    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Scrape documentation sites for enhanced content
   */
  async scrapeDocumentationSites(npmDetails, githubInfo) {
    const urlsToScrape = [];
    
    // Add homepage if it exists and looks like documentation
    if (npmDetails.homepage) {
      const homepage = npmDetails.homepage.toLowerCase();
      if (homepage.includes('docs') || homepage.includes('documentation') || 
          homepage.includes('readme') || homepage.includes('guide')) {
        urlsToScrape.push(npmDetails.homepage);
      }
    }
    
    // Add GitHub repository URL for README scraping
    if (githubInfo && npmDetails.repository?.url) {
      const repoPath = this.extractGitHubRepoPath(npmDetails.repository.url);
      if (repoPath) {
        urlsToScrape.push(`https://github.com/${repoPath}`);
      }
    }
    
    // Add documentation URL if different from homepage
    const docUrl = this.extractDocumentationUrl(npmDetails, githubInfo);
    if (docUrl && !urlsToScrape.includes(docUrl)) {
      urlsToScrape.push(docUrl);
    }
    
    if (urlsToScrape.length === 0) {
      return null;
    }
    
    console.log(`   🌐 Web scraping ${urlsToScrape.length} documentation sites...`);
    
    try {
      const docs = await this.webScraper.scrapePackageDocumentation(urlsToScrape, {
        waitFor: 1000 // Wait for dynamic content
      });
      
      if (docs) {
        console.log(`   📄 Extracted ${docs.content.wordCount} words from documentation`);
      }
      
      return docs;
    } catch (error) {
      console.warn(`   ⚠️ Web scraping failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.webScraper) {
      await this.webScraper.close();
    }
  }
}

module.exports = { NPMScraper };