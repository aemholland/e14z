/**
 * Main MCP Crawler Orchestrator
 * Coordinates discovery, scraping, validation, and database storage
 */

const { NPMDiscovery } = require('./discovery/npm-discovery');
const { PipxDiscovery } = require('./discovery/pipx-discovery');
const { CargoDiscovery } = require('./discovery/cargo-discovery');
const { GoDiscovery } = require('./discovery/go-discovery');
const { GitHubEnhancedDiscovery } = require('./discovery/github-enhanced-discovery');

const { NPMScraper } = require('./scraping/npm-scraper');
const { PipxScraper } = require('./scraping/pipx-scraper');
const { CargoScraper } = require('./scraping/cargo-scraper');
const { GoScraper } = require('./scraping/go-scraper');

const { EnhancedMCPValidator } = require('./validation/enhanced-mcp-validator');

class MCPCrawler {
  constructor(options = {}) {
    this.options = options;
    this.dryRun = options.dryRun || false;
    this.maxConcurrent = options.maxConcurrent || 5;
    this.shouldValidateMCPs = options.validateMCPs !== false;
    this.forceRevalidation = options.forceRevalidation || false;
    
    // Initialize discovery components
    this.npmDiscovery = new NPMDiscovery(options.npm || {});
    this.pipxDiscovery = new PipxDiscovery(options.pipx || {});
    this.cargoDiscovery = new CargoDiscovery(options.cargo || {});
    this.goDiscovery = new GoDiscovery(options.go || {});
    this.githubDiscovery = new GitHubEnhancedDiscovery(options.github || {});
    
    // Initialize scraping components
    this.npmScraper = new NPMScraper(options.scraping || {});
    this.pipxScraper = new PipxScraper(options.scraping || {});
    this.cargoScraper = new CargoScraper(options.scraping || {});
    this.goScraper = new GoScraper(options.scraping || {});
    
    // Initialize enhanced validation using auto-installer
    this.validator = new EnhancedMCPValidator({
      timeout: options.validation?.timeout || 60000,
      maxConcurrentValidations: Math.min(this.maxConcurrent, 2),
      enableInstallation: options.validation?.enableInstallation !== false,
      enableExecution: options.validation?.enableExecution !== false,
      cleanup: options.validation?.cleanup !== false
    });
    
    // Statistics
    this.stats = {
      discovered: 0,
      scraped: 0,
      validated: 0,
      stored: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Main crawling entry point
   */
  async crawl(sources = ['npm']) {
    console.log('🚀 Starting MCP crawler...');
    console.log(`   Sources: ${sources.join(', ')}`);
    console.log(`   Dry run: ${this.dryRun}`);
    console.log(`   Validation: ${this.validateMCPs}`);

    const startTime = Date.now();

    try {
      // Discovery phase
      console.log('\n📡 DISCOVERY PHASE');
      const discoveredPackages = await this.discoverMCPs(sources);
      this.stats.discovered = discoveredPackages.length;
      
      if (discoveredPackages.length === 0) {
        console.log('❌ No MCP packages discovered');
        return this.stats;
      }

      // Scraping phase
      console.log('\n🔍 SCRAPING PHASE');
      const scrapedMCPs = await this.scrapeMCPs(discoveredPackages);
      this.stats.scraped = scrapedMCPs.length;

      // Validation phase
      console.log('\n✅ VALIDATION PHASE');
      const validatedMCPs = await this.validateMCPs(scrapedMCPs);
      this.stats.validated = validatedMCPs.length;

      // Storage phase
      console.log('\n💾 STORAGE PHASE');
      const storedCount = await this.storeMCPs(validatedMCPs);
      this.stats.stored = storedCount;

      // Summary
      const duration = Date.now() - startTime;
      console.log('\n🎉 CRAWLING COMPLETE');
      console.log(`   Duration: ${Math.round(duration / 1000)}s`);
      console.log(`   Discovered: ${this.stats.discovered}`);
      console.log(`   Scraped: ${this.stats.scraped}`);
      console.log(`   Validated: ${this.stats.validated}`);
      console.log(`   Stored: ${this.stats.stored}`);
      console.log(`   Failed: ${this.stats.failed}`);

      if (this.stats.errors.length > 0) {
        console.log('\n⚠️ ERRORS:');
        this.stats.errors.slice(0, 5).forEach(error => {
          console.log(`   - ${error}`);
        });
        if (this.stats.errors.length > 5) {
          console.log(`   ... and ${this.stats.errors.length - 5} more errors`);
        }
      }

      return this.stats;

    } catch (error) {
      console.error('💥 Crawler failed:', error.message);
      throw error;
    }
  }

  /**
   * Discovery phase - find potential MCP packages
   */
  async discoverMCPs(sources) {
    const allPackages = [];

    for (const source of sources) {
      console.log(`🔍 Discovering from ${source}...`);
      
      try {
        switch (source) {
          case 'npm':
            const npmPackages = await this.npmDiscovery.discoverMCPs();
            allPackages.push(...npmPackages);
            console.log(`   Found ${npmPackages.length} NPM packages`);
            break;
            
          case 'pipx':
          case 'pypi':
            const pipxPackages = await this.pipxDiscovery.discoverMCPs();
            allPackages.push(...pipxPackages);
            console.log(`   Found ${pipxPackages.length} Python packages`);
            break;
            
          case 'cargo':
          case 'rust':
            const cargoPackages = await this.cargoDiscovery.discoverMCPs();
            allPackages.push(...cargoPackages);
            console.log(`   Found ${cargoPackages.length} Rust packages`);
            break;
            
          case 'go':
          case 'golang':
            const goPackages = await this.goDiscovery.discoverMCPs();
            allPackages.push(...goPackages);
            console.log(`   Found ${goPackages.length} Go packages`);
            break;
            
          case 'github':
          case 'curated':
            const githubPackages = await this.githubDiscovery.discoverMCPs();
            allPackages.push(...githubPackages);
            console.log(`   Found ${githubPackages.length} GitHub packages`);
            break;
            
          default:
            console.warn(`   ⚠️ Unknown source: ${source}`);
        }
      } catch (error) {
        console.error(`   ❌ Discovery failed for ${source}: ${error.message}`);
        this.stats.errors.push(`Discovery ${source}: ${error.message}`);
      }
    }

    // Deduplicate packages
    const uniquePackages = this.deduplicatePackages(allPackages);
    console.log(`📊 Total unique packages discovered: ${uniquePackages.length}`);

    return uniquePackages;
  }

  /**
   * Scraping phase - extract detailed information
   */
  async scrapeMCPs(packages) {
    console.log(`🔍 Scraping ${packages.length} packages...`);
    
    const scrapedMCPs = [];
    const semaphore = this.createSemaphore(this.maxConcurrent);

    await Promise.all(packages.map(async (pkg) => {
      await semaphore.acquire();
      
      try {
        let scrapedData;
        
        // Special handling for GitHub-discovered packages
        if (pkg.discoveryMethod && pkg.discoveryMethod.startsWith('github:')) {
          // GitHub packages already have rich metadata, convert to scraper format
          scrapedData = this.convertGitHubPackageToMCPData(pkg);
          console.log(`   🐙 GitHub package: ${pkg.name} (self-contained)`);
        } else {
          // Determine which scraper to use based on discovery source or package type
          const sourceType = this.determinePackageSource(pkg);
          
          switch (sourceType) {
            case 'npm':
              scrapedData = await this.npmScraper.scrapeMCPPackage(pkg);
              break;
              
            case 'pipx':
            case 'pypi':
              scrapedData = await this.pipxScraper.scrapeMCPPackage(pkg);
              break;
              
            case 'cargo':
            case 'rust':
              scrapedData = await this.cargoScraper.scrapeMCPPackage(pkg);
              break;
              
            case 'go':
            case 'golang':
              scrapedData = await this.goScraper.scrapeMCPPackage(pkg);
              break;
              
            default:
              // Default to npm scraper for backward compatibility
              scrapedData = await this.npmScraper.scrapeMCPPackage(pkg);
          }
        }
        
        if (scrapedData) {
          scrapedMCPs.push(scrapedData);
          console.log(`   ✅ Scraped: ${pkg.name}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Scraping failed for ${pkg.name}: ${error.message}`);
        this.stats.errors.push(`Scraping ${pkg.name}: ${error.message}`);
        this.stats.failed++;
      } finally {
        semaphore.release();
      }
    }));

    console.log(`📊 Successfully scraped ${scrapedMCPs.length} MCPs`);
    return scrapedMCPs;
  }

  /**
   * Validation phase - verify MCPs actually work
   */
  async validateMCPs(mcps) {
    if (!this.shouldValidateMCPs) {
      console.log('⏭️ Skipping validation (disabled)');
      return mcps;
    }

    console.log(`✅ Validating ${mcps.length} MCPs...`);
    
    const validatedMCPs = [];
    const semaphore = this.createSemaphore(Math.min(this.maxConcurrent, 3)); // Limit validation concurrency

    await Promise.all(mcps.map(async (mcp) => {
      await semaphore.acquire();
      
      try {
        const validationResult = await this.validator.validateMCP(mcp);
        
        // Attach validation results to MCP data
        mcp.validation_result = validationResult;
        mcp.verified = validationResult.isValid;
        mcp.health_status = validationResult.isValid ? 'healthy' : 'down';
        mcp.verification_notes = validationResult.errors.join('; ') || null;
        mcp.last_health_check = new Date().toISOString();

        // Update tools with validated data if available
        if (validationResult.extractedTools && validationResult.extractedTools.length > 0) {
          mcp.tools = validationResult.extractedTools;
        }

        // Extract auth requirements from validation (both errors and warnings)
        const { AuthRequirementsExtractor } = require('./utils/auth-requirements-extractor');
        
        const validationAuth = AuthRequirementsExtractor.extractAuthRequirements(
          validationResult,
          mcp.description || '',
          validationResult.errors.join(' ') + ' ' + (validationResult.warnings || []).join(' ')
        );
        
        // Enhanced auth detection: check if validator detected auth requirements
        let detectedAuthVars = [];
        if (validationResult.authRequirements && validationResult.authRequirements.length > 0) {
          detectedAuthVars = validationResult.authRequirements;
          console.log(`   🔐 Enhanced validator detected auth: ${detectedAuthVars.join(', ')}`);
        }
        
        // Merge auth data from multiple sources
        if (validationAuth.auth_required || detectedAuthVars.length > 0) {
          mcp.auth_required = true;
          mcp.auth_methods = [...new Set([
            ...(mcp.auth_methods || []), 
            ...validationAuth.auth_methods,
            ...(detectedAuthVars.length > 0 ? ['api_key', 'bearer_token'] : [])
          ])];
          
          // Combine detected auth vars with extracted ones
          const allRequiredVars = [
            ...(mcp.required_env_vars || []),
            ...validationAuth.required_env_vars,
            ...detectedAuthVars
          ];
          mcp.required_env_vars = [...new Set(allRequiredVars)];
          
          mcp.optional_env_vars = [...new Set([...(mcp.optional_env_vars || []), ...validationAuth.optional_env_vars])];
          mcp.credentials_needed = [...new Set([...(mcp.credentials_needed || []), ...validationAuth.credentials_needed])];
          mcp.setup_complexity = validationAuth.setup_complexity || mcp.setup_complexity;
          
          // Generate comprehensive auth summary
          mcp.auth_summary = AuthRequirementsExtractor.generateAuthSummary({
            auth_required: mcp.auth_required,
            required_env_vars: mcp.required_env_vars,
            optional_env_vars: mcp.optional_env_vars,
            credentials_needed: mcp.credentials_needed,
            setup_complexity: mcp.setup_complexity
          });
          
          console.log(`   🔐 Final auth requirements: [${mcp.required_env_vars.join(', ')}]`);
        }

        validatedMCPs.push(mcp);
        
        if (validationResult.isValid) {
          console.log(`   ✅ Validated: ${mcp.name}`);
        } else {
          console.log(`   ⚠️ Failed validation: ${mcp.name} - ${validationResult.errors[0]}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Validation crashed for ${mcp.name}: ${error.message}`);
        this.stats.errors.push(`Validation ${mcp.name}: ${error.message}`);
        
        // Include MCP even if validation crashed, but mark as unverified
        mcp.verified = false;
        mcp.health_status = 'unknown';
        mcp.verification_notes = `Validation failed: ${error.message}`;
        validatedMCPs.push(mcp);
        
        this.stats.failed++;
      } finally {
        semaphore.release();
      }
    }));

    const validCount = validatedMCPs.filter(mcp => mcp.verified).length;
    console.log(`📊 Validation complete: ${validCount}/${validatedMCPs.length} passed`);
    
    return validatedMCPs;
  }

  /**
   * Storage phase - save to database
   */
  async storeMCPs(mcps) {
    if (this.dryRun) {
      console.log('⏭️ Skipping storage (dry run)');
      return mcps.length;
    }

    console.log(`💾 Storing ${mcps.length} MCPs to database...`);
    
    let storedCount = 0;
    
    // Import Supabase client
    let supabase;
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
      }
      
      supabase = createClient(supabaseUrl, supabaseKey);
    } catch (error) {
      console.error('❌ Failed to create Supabase client:', error.message);
      throw new Error('Database not available');
    }

    for (const mcp of mcps) {
      try {
        // Check if MCP already exists
        const existing = await this.checkExistingMCP(mcp);
        
        if (existing && !this.forceRevalidation) {
          console.log(`   ⏭️ Skipping existing: ${mcp.name}`);
          continue;
        }

        // Prepare data for database
        const dbData = this.prepareMCPForDatabase(mcp);
        
        if (existing) {
          // Update existing MCP
          const { error } = await supabase
            .from('mcps')
            .update(dbData)
            .eq('id', existing.id);
            
          if (error) throw error;
          console.log(`   🔄 Updated: ${mcp.name}`);
        } else {
          // Insert new MCP
          const { error } = await supabase
            .from('mcps')
            .insert([dbData]);
            
          if (error) throw error;
          console.log(`   ➕ Stored: ${mcp.name}`);
        }
        
        storedCount++;
        
      } catch (error) {
        console.error(`   ❌ Storage failed for ${mcp.name}: ${error.message}`);
        this.stats.errors.push(`Storage ${mcp.name}: ${error.message}`);
        this.stats.failed++;
      }
    }

    console.log(`📊 Successfully stored ${storedCount} MCPs`);
    return storedCount;
  }

  /**
   * Helper methods
   */

  determinePackageSource(pkg) {
    // For GitHub-discovered packages, use the install_type
    if (pkg.discoveryMethod && pkg.discoveryMethod.startsWith('github:')) {
      return pkg.install_type || 'npm'; // Default to npm for GitHub packages
    }
    
    // Check discovery method first
    const discoveryMethod = pkg.discoveryMethod;
    if (discoveryMethod) {
      if (discoveryMethod.includes('npm') || discoveryMethod.includes('javascript')) return 'npm';
      if (discoveryMethod.includes('pipx') || discoveryMethod.includes('pypi') || discoveryMethod.includes('python')) return 'pipx';
      if (discoveryMethod.includes('cargo') || discoveryMethod.includes('rust') || discoveryMethod.includes('crates')) return 'cargo';
      if (discoveryMethod.includes('go') || discoveryMethod.includes('golang')) return 'go';
    }
    
    // Check package name patterns
    const name = pkg.name || '';
    if (name.startsWith('@') || name.includes('npm')) return 'npm';
    if (name.includes('github.com/') && name.split('/').length > 2) return 'go';
    
    // Check repository URL patterns  
    const repo = pkg.repository || '';
    if (repo.includes('pypi.org') || repo.includes('python')) return 'pipx';
    if (repo.includes('crates.io') || repo.includes('rust')) return 'cargo';
    if (repo.includes('pkg.go.dev') || repo.includes('golang')) return 'go';
    
    // Check import path for Go packages
    const importPath = pkg.importPath || '';
    if (importPath && (importPath.includes('github.com/') || importPath.includes('golang.org/'))) return 'go';
    
    // Default to npm for backward compatibility
    return 'npm';
  }

  deduplicatePackages(packages) {
    const seen = new Map();
    
    for (const pkg of packages) {
      const key = pkg.name.toLowerCase();
      
      if (!seen.has(key)) {
        seen.set(key, pkg);
      } else {
        // Keep the one with better discovery method or more complete data
        const existing = seen.get(key);
        if (this.isPackageBetter(pkg, existing)) {
          seen.set(key, pkg);
        }
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Convert GitHub-discovered package to MCP format
   */
  convertGitHubPackageToMCPData(githubPkg) {
    // GitHub packages already have rich metadata from discovery
    // Convert to the format expected by validation and storage
    
    const { SlugGenerator } = require('./utils/slug-generator');
    const { AuthRequirementsExtractor } = require('./utils/auth-requirements-extractor');
    
    // Extract auth requirements from GitHub repository data
    const authRequirements = this.extractGitHubAuthRequirements(githubPkg);
    
    // Generate enhanced tags for better discoverability
    const tags = this.generateTagsFromGitHubData(githubPkg);
    
    // Generate use cases based on description and topics
    const useCases = this.generateUseCasesFromGitHubData(githubPkg);
    
    return {
      // Basic package info
      name: githubPkg.name,
      slug: githubPkg.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
      description: githubPkg.description || `MCP server: ${githubPkg.name}`,
      version: '1.0.0', // Default for GitHub packages
      display_name: githubPkg.name.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      short_description: githubPkg.description?.substring(0, 100) || `${githubPkg.name} MCP server`,
      
      // Installation
      install_type: githubPkg.install_type || 'npm',
      endpoint: githubPkg.installCommand || githubPkg.auto_install_command || `npx ${githubPkg.packageName || githubPkg.name}`,
      auto_install_command: githubPkg.installCommand || githubPkg.auto_install_command || `npx ${githubPkg.packageName || githubPkg.name}`,
      
      // MCP specific (defaults - will be updated during validation)
      tools: githubPkg.tools || [],
      auth_method: 'none', // Will be updated if auth detected
      connection_type: 'stdio',
      protocol_version: '2024-11-05',
      transports: ['stdio'],
      
      // Classification and metadata
      category: this.inferCategoryFromGitHubData(githubPkg),
      tags: tags,
      use_cases: useCases,
      installation_methods: [githubPkg.install_type || 'npm'],
      
      // GitHub-specific metadata
      official_status: githubPkg.official_status,
      is_official: githubPkg.is_official,
      github_url: githubPkg.repository_url,
      repository_url: githubPkg.repository_url,
      website_url: githubPkg.website_url, // Extract website URL from GitHub repo
      
      // Quality indicators
      stars: githubPkg.stars || 0,
      topics: githubPkg.topics || [],
      language: githubPkg.language,
      license: githubPkg.license,
      recent_activity: githubPkg.recent_activity,
      has_readme: githubPkg.has_readme,
      
      // Discovery metadata
      auto_discovered: true,
      discovery_source: githubPkg.discoveryMethod,
      discovery_method: githubPkg.discoveryMethod,
      source_list: githubPkg.source_list,
      
      // Authentication & Setup Requirements (from GitHub analysis)
      auth_required: authRequirements.auth_required,
      auth_methods: authRequirements.auth_methods,
      required_env_vars: authRequirements.required_env_vars,
      optional_env_vars: authRequirements.optional_env_vars,
      credentials_needed: authRequirements.credentials_needed,
      setup_complexity: authRequirements.setup_complexity,
      auth_summary: AuthRequirementsExtractor.generateAuthSummary(authRequirements),
      
      // Default values
      verified: false, // Will be updated during validation
      health_status: 'unknown', // Will be updated during validation
      quality_score: null, // Reserved for separate quality calculation system
      rating: null, // Reserved for user ratings, not quality metrics
      
      // Timestamps
      last_scraped_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  }

  /**
   * Generate tags from GitHub data
   */
  generateTagsFromGitHubData(githubPkg) {
    const tags = new Set();
    
    // Add core MCP tags
    tags.add('mcp');
    tags.add('server');
    tags.add('model context protocol');
    
    // Add from topics
    if (githubPkg.topics) {
      githubPkg.topics.forEach(topic => {
        tags.add(topic.toLowerCase().replace(/-/g, ' '));
      });
    }
    
    // Add from language
    if (githubPkg.language) {
      tags.add(githubPkg.language.toLowerCase());
    }
    
    // Add from owner (for official classification)
    tags.add(githubPkg.owner);
    if (githubPkg.is_official) {
      tags.add('official');
      tags.add('verified');
    } else {
      tags.add('community');
    }
    
    // Add from install type
    if (githubPkg.install_type) {
      tags.add(githubPkg.install_type);
    }
    
    // Add from description keywords
    if (githubPkg.description) {
      const descWords = githubPkg.description.toLowerCase().match(/\b\w+\b/g) || [];
      const relevantWords = descWords.filter(word => 
        word.length > 3 && !['with', 'this', 'that', 'from', 'have', 'been', 'they'].includes(word)
      );
      relevantWords.slice(0, 5).forEach(word => tags.add(word));
    }
    
    return Array.from(tags).slice(0, 25); // Limit to 25 tags
  }

  /**
   * Generate use cases from GitHub data
   */
  generateUseCasesFromGitHubData(githubPkg) {
    const useCases = [];
    
    // Infer use cases from description and topics
    if (githubPkg.description) {
      const desc = githubPkg.description.toLowerCase();
      
      if (desc.includes('github') || desc.includes('git')) {
        useCases.push('Git and version control operations');
      }
      if (desc.includes('database') || desc.includes('sql')) {
        useCases.push('Database operations and queries');
      }
      if (desc.includes('file') || desc.includes('filesystem')) {
        useCases.push('File system operations');
      }
      if (desc.includes('api') || desc.includes('service')) {
        useCases.push('API and service integration');
      }
      if (desc.includes('search') || desc.includes('index')) {
        useCases.push('Search and indexing');
      }
    }
    
    // Add based on official status
    if (githubPkg.is_official) {
      useCases.push('Production-ready enterprise integration');
    } else {
      useCases.push('Community-driven solution');
    }
    
    // Default use case
    if (useCases.length === 0) {
      useCases.push(`${githubPkg.name} server operations`);
    }
    
    return useCases.slice(0, 8); // Limit to 8 use cases
  }

  /**
   * Infer category from GitHub data
   */
  inferCategoryFromGitHubData(githubPkg) {
    if (!githubPkg.description) return 'utilities';
    
    const desc = githubPkg.description.toLowerCase();
    
    if (desc.includes('database') || desc.includes('sql')) return 'databases';
    if (desc.includes('file') || desc.includes('filesystem')) return 'file-systems';
    if (desc.includes('github') || desc.includes('git')) return 'version-control';
    if (desc.includes('api') || desc.includes('service')) return 'apis';
    if (desc.includes('search') || desc.includes('index')) return 'search';
    if (desc.includes('memory') || desc.includes('cache')) return 'memory';
    if (desc.includes('monitor') || desc.includes('log')) return 'monitoring';
    
    return 'utilities';
  }

  /**
   * Calculate quality score for GitHub packages
   */
  calculateGitHubQualityScore(githubPkg) {
    let score = 50; // Base score
    
    // Official status boost
    if (githubPkg.is_official) {
      score += 30;
    } else if (githubPkg.official_status === 'verified-community') {
      score += 20;
    }
    
    // Stars boost
    if (githubPkg.stars > 100) score += 15;
    else if (githubPkg.stars > 10) score += 10;
    else if (githubPkg.stars > 0) score += 5;
    
    // README boost
    if (githubPkg.has_readme) score += 10;
    
    // Recent activity boost
    if (githubPkg.recent_activity) score += 10;
    
    // Topics boost
    if (githubPkg.topics && githubPkg.topics.length > 3) score += 10;
    else if (githubPkg.topics && githubPkg.topics.length > 0) score += 5;
    
    // Description quality
    if (githubPkg.description && githubPkg.description.length > 50) score += 5;
    
    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Extract auth requirements from actual MCP server documentation
   */
  extractGitHubAuthRequirements(githubPkg) {
    const { AuthRequirementsExtractor } = require('./utils/auth-requirements-extractor');
    
    // Use actual MCP server documentation if available
    const mcpDocumentation = githubPkg.mcpDocumentation || githubPkg.readmeContent || '';
    const packageJson = githubPkg.packageJson || {};
    
    console.log(`   🔐 Analyzing MCP server documentation for auth: ${githubPkg.name}`);
    console.log(`   📖 Documentation length: ${mcpDocumentation.length} chars`);
    
    // Combine MCP server documentation sources
    const analysisText = [
      mcpDocumentation, // README.md content
      packageJson.description || '',
      JSON.stringify(packageJson.scripts || {}),
      JSON.stringify(packageJson.dependencies || {}),
      githubPkg.description || '' // Fallback to GitHub description
    ].join('\n\n');
    
    // Extract auth requirements from MCP server documentation
    const authData = AuthRequirementsExtractor.extractAuthRequirements(
      null, // No validation result yet
      analysisText,
      '' // No error message yet
    );
    
    // Enhanced detection for known MCP service patterns (not GitHub patterns)
    this.detectKnownMCPServiceAuthPatterns(githubPkg, authData, mcpDocumentation);
    
    if (authData.auth_required) {
      console.log(`   🔐 MCP server auth detected - Types: ${authData.auth_methods.join(', ')}`);
      if (authData.required_env_vars && authData.required_env_vars.length > 0) {
        console.log(`   🔑 Specific env vars found: ${authData.required_env_vars.join(', ')}`);
      }
    } else {
      console.log(`   🔓 No auth requirements detected for MCP server`);
    }
    
    return authData;
  }

  /**
   * Detect known authentication patterns from MCP server documentation
   * Focus on auth TYPE rather than specific variable names to avoid false positives
   */
  detectKnownMCPServiceAuthPatterns(githubPkg, authData, mcpDocumentation) {
    const name = (githubPkg.name || '').toLowerCase();
    const documentation = mcpDocumentation.toLowerCase();
    const packageJson = githubPkg.packageJson || {};
    const dependencies = Object.keys(packageJson.dependencies || {}).join(' ').toLowerCase();
    
    console.log(`   🔍 Analyzing MCP server for service-specific auth patterns...`);
    
    // Enhanced service patterns that check for actual service usage, not just keywords
    const servicePatterns = {
      'github': {
        // Only match if it's ACTUALLY using GitHub API (not just hosted on GitHub)
        patterns: ['github api', 'github.com/api', 'github token', 'pull request api', 'github issue api', 'github repo api', 'github rest api'],
        exclusions: ['github.com/', 'git clone', 'repository url', 'hosted on github'], // Exclude general GitHub hosting references
        auth_types: ['bearer_token'],
        complexity: 'simple'
      },
      'slack': {
        patterns: ['slack', 'bot token', 'slack api', 'workspace', 'slack webhook'],
        exclusions: [],
        auth_types: ['bearer_token'],
        complexity: 'moderate'
      },
      'stripe': {
        patterns: ['stripe', 'payment', 'billing', 'checkout', 'invoice', 'stripe api'],
        exclusions: [],
        auth_types: ['api_key'],
        complexity: 'simple'
      },
      'openai': {
        patterns: ['openai', 'gpt', 'chatgpt', 'completion', 'openai api'],
        exclusions: [],
        auth_types: ['api_key'],
        complexity: 'simple'
      },
      'anthropic': {
        patterns: ['anthropic', 'claude', 'claude api'],
        exclusions: [],
        auth_types: ['api_key'],
        complexity: 'simple'
      },
      'google': {
        patterns: ['google api', 'gmail', 'drive', 'sheets', 'calendar', 'google cloud'],
        exclusions: ['google.com', 'google search'], // Exclude general Google references
        auth_types: ['oauth2', 'api_key'],
        complexity: 'complex'
      },
      'database': {
        patterns: ['database', 'postgres', 'mysql', 'sqlite', 'connection string', 'db connection'],
        exclusions: [],
        auth_types: ['connection_string'],
        complexity: 'moderate'
      },
      'aws': {
        patterns: ['aws', 'amazon web services', 's3', 'lambda', 'dynamodb', 'ec2'],
        exclusions: [],
        auth_types: ['access_key'],
        complexity: 'moderate'
      },
      'notion': {
        patterns: ['notion api', 'notion database', 'notion integration'],
        exclusions: [],
        auth_types: ['bearer_token'],
        complexity: 'simple'
      },
      'discord': {
        patterns: ['discord', 'discord bot', 'discord api'],
        exclusions: [],
        auth_types: ['bearer_token'],
        complexity: 'simple'
      },
      'telegram': {
        patterns: ['telegram', 'telegram bot', 'bot token'],
        exclusions: [],
        auth_types: ['bearer_token'],
        complexity: 'simple'
      },
      'generic_api': {
        patterns: ['api key', 'bearer token', 'access token', 'secret key', 'auth token'],
        exclusions: [],
        auth_types: ['api_key'],
        complexity: 'simple'
      }
    };
    
    // Check MCP server documentation and dependencies for service patterns
    for (const [service, config] of Object.entries(servicePatterns)) {
      const hasServicePattern = config.patterns.some(pattern => 
        documentation.includes(pattern) || 
        name.includes(pattern) ||
        dependencies.includes(pattern)
      );
      
      // Check for exclusions to avoid false positives
      const hasExclusion = config.exclusions.length > 0 && config.exclusions.some(exclusion =>
        documentation.includes(exclusion) && !config.patterns.some(pattern => documentation.includes(pattern))
      );
      
      if (hasServicePattern && !hasExclusion) {
        authData.auth_required = true;
        authData.auth_methods.push(...config.auth_types);
        authData.setup_complexity = config.complexity;
        
        console.log(`   🎯 MCP server uses ${service} authentication: ${config.auth_types.join(', ')}`);
        
        // For generic API pattern, we don't break to allow other specific services to be detected
        if (service !== 'generic_api') {
          break; // Only match first specific service to avoid duplicates
        }
      }
    }
    
    // Remove duplicates
    authData.auth_methods = [...new Set(authData.auth_methods)];
    
    // If no auth detected but documentation mentions auth concepts, use generic detection
    if (!authData.auth_required && documentation.length > 0) {
      const authKeywords = ['api key', 'token', 'secret', 'credentials', 'authentication', 'auth'];
      const hasAuthMention = authKeywords.some(keyword => documentation.includes(keyword));
      
      if (hasAuthMention) {
        console.log(`   🔑 Generic auth patterns detected in MCP documentation`);
        authData.auth_required = true;
        authData.setup_complexity = 'simple';
        authData.auth_methods.push('api_key');
      }
    }
  }

  isPackageBetter(pkg1, pkg2) {
    // Prefer packages discovered by dependency over keyword over naming
    const methodPriority = {
      'dependency': 3,
      'keyword': 2,  
      'naming': 1
    };
    
    const method1 = pkg1.discoveryMethod?.split(':')[0] || 'unknown';
    const method2 = pkg2.discoveryMethod?.split(':')[0] || 'unknown';
    
    const priority1 = methodPriority[method1] || 0;
    const priority2 = methodPriority[method2] || 0;
    
    if (priority1 !== priority2) {
      return priority1 > priority2;
    }
    
    // If same discovery method, prefer one with more complete data
    const score1 = (pkg1.description ? 1 : 0) + (pkg1.repository ? 1 : 0) + (pkg1.keywords?.length || 0);
    const score2 = (pkg2.description ? 1 : 0) + (pkg2.repository ? 1 : 0) + (pkg2.keywords?.length || 0);
    
    return score1 > score2;
  }

  async checkExistingMCP(mcp) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      const { data, error } = await supabase
        .from('mcps')
        .select('id, name, slug, updated_at')
        .or(`slug.eq.${mcp.slug},name.eq.${mcp.name}`)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }
      
      return data;
    } catch (error) {
      console.warn(`   ⚠️ Failed to check existing MCP ${mcp.name}: ${error.message}`);
      return null;
    }
  }

  prepareMCPForDatabase(mcp) {
    // Build search vector content
    const searchContent = [
      mcp.name,
      mcp.description,
      ...(mcp.tags || []),
      mcp.category,
      ...(mcp.use_cases || []),
      mcp.author,
      mcp.company
    ].filter(Boolean).join(' ');

    return {
      slug: mcp.slug,
      name: mcp.name,
      description: mcp.description,
      endpoint: mcp.endpoint,
      install_type: mcp.install_type,
      auto_install_command: mcp.auto_install_command,
      
      tools: mcp.tools ? JSON.stringify(mcp.tools) : null,
      auth_method: mcp.auth_method,
      connection_type: mcp.connection_type,
      protocol_version: mcp.protocol_version,
      
      category: mcp.category,
      tags: mcp.tags || [],
      use_cases: mcp.use_cases || [],
      installation_methods: mcp.installation_methods || [],
      
      // Authentication & Setup Requirements
      auth_required: mcp.auth_required || false,
      auth_methods: mcp.auth_methods || [],
      required_env_vars: mcp.required_env_vars || [],
      optional_env_vars: mcp.optional_env_vars || [],
      credentials_needed: mcp.credentials_needed || [],
      setup_complexity: mcp.setup_complexity || 'simple',
      auth_summary: mcp.auth_summary || null,
      setup_instructions: mcp.setup_instructions || null,
      
      verified: mcp.verified,
      health_status: mcp.health_status,
      verification_notes: mcp.verification_notes,
      auto_discovered: mcp.auto_discovered,
      discovery_source: mcp.discovery_source,
      quality_score: mcp.quality_score,
      rating: mcp.rating, // User ratings (separate from quality_score)
      
      github_url: mcp.github_url,
      documentation_url: mcp.documentation_url,
      website_url: mcp.website_url, // Include website URL from GitHub repos
      
      author: mcp.author,
      company: mcp.company,
      license: mcp.license,
      
      // Quality indicators for better product experience
      stars: mcp.stars || 0,
      topics: mcp.topics || [],
      language: mcp.language,
      official_status: mcp.official_status,
      is_official: mcp.is_official || false,
      recent_activity: mcp.recent_activity || false,
      has_readme: mcp.has_readme || false,
      
      pricing_model: mcp.pricing_model,
      pricing_details: mcp.pricing_details || {},
      
      last_scraped_at: mcp.last_scraped_at,
      last_health_check: mcp.last_health_check,
      created_at: mcp.created_at,
      updated_at: new Date().toISOString(),
      
      // Note: search_vector will be generated by database trigger
    };
  }

  createSemaphore(maxConcurrent) {
    let current = 0;
    const waiting = [];

    return {
      async acquire() {
        if (current < maxConcurrent) {
          current++;
          return;
        }

        return new Promise(resolve => {
          waiting.push(resolve);
        });
      },

      release() {
        current--;
        if (waiting.length > 0) {
          current++;
          const resolve = waiting.shift();
          resolve();
        }
      }
    };
  }

  /**
   * Crawl specific package by name
   */
  async crawlPackage(packageName, source = 'npm') {
    console.log(`🎯 Crawling specific package: ${packageName}`);
    
    try {
      // Create fake discovery result
      const fakePackage = {
        name: packageName,
        importPath: source === 'go' ? packageName : undefined,
        discoveryMethod: `manual:${source}`
      };

      // Determine which scraper to use
      let scrapedMCP;
      switch (source) {
        case 'npm':
          scrapedMCP = await this.npmScraper.scrapeMCPPackage(fakePackage);
          break;
        case 'pipx':
        case 'pypi':
          scrapedMCP = await this.pipxScraper.scrapeMCPPackage(fakePackage);
          break;
        case 'cargo':
        case 'rust':
          scrapedMCP = await this.cargoScraper.scrapeMCPPackage(fakePackage);
          break;
        case 'go':
        case 'golang':
          scrapedMCP = await this.goScraper.scrapeMCPPackage(fakePackage);
          break;
        default:
          scrapedMCP = await this.npmScraper.scrapeMCPPackage(fakePackage);
      }
      
      // Validate if requested
      if (this.shouldValidateMCPs) {
        const validationResult = await this.validator.validateMCP(scrapedMCP);
        scrapedMCP.validation_result = validationResult;
        scrapedMCP.verified = validationResult.isValid;
        scrapedMCP.health_status = validationResult.isValid ? 'healthy' : 'down';
      }

      // Store if not dry run
      if (!this.dryRun) {
        await this.storeMCPs([scrapedMCP]);
      }

      console.log(`✅ Successfully crawled ${packageName}`);
      return scrapedMCP;

    } catch (error) {
      console.error(`❌ Failed to crawl ${packageName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update existing MCPs with fresh data
   */
  async updateExistingMCPs(limit = 50) {
    console.log(`🔄 Updating existing MCPs (limit: ${limit})...`);

    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      // Get MCPs that need updating (oldest first)
      const { data: mcps, error } = await supabase
        .from('mcps')
        .select('id, name, slug, install_type, auto_discovered')
        .eq('auto_discovered', true)
        .order('last_scraped_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      console.log(`Found ${mcps.length} MCPs to update`);

      let updatedCount = 0;
      for (const mcp of mcps) {
        try {
          await this.crawlPackage(mcp.name, mcp.install_type);
          updatedCount++;
          console.log(`   ✅ Updated: ${mcp.name}`);
        } catch (error) {
          console.error(`   ❌ Update failed for ${mcp.name}: ${error.message}`);
        }
      }

      console.log(`🎉 Updated ${updatedCount}/${mcps.length} MCPs`);
      return updatedCount;

    } catch (error) {
      console.error('❌ Failed to update existing MCPs:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up crawler resources...');
    
    try {
      // Cleanup GitHub discovery web scraper
      if (this.githubDiscovery) {
        await this.githubDiscovery.cleanup();
      }
      
      // Cleanup validator auto-installer
      if (this.validator) {
        await this.validator.cleanup();
      }
      
      console.log('✅ Cleanup complete');
    } catch (error) {
      console.warn(`⚠️ Cleanup warning: ${error.message}`);
    }
  }
}

module.exports = { MCPCrawler };