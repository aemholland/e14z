/**
 * Production-Ready MCP Crawler
 * Integrates all resilience components for 24/7 operation
 * Built with 2025 Node.js Best Practices
 */

// Load environment variables first - try .env.local then .env
const fs = require('fs');
const path = require('path');

// Find the root directory (where package.json is)
let rootDir = __dirname;
while (rootDir !== '/' && !fs.existsSync(path.join(rootDir, 'package.json'))) {
  rootDir = path.dirname(rootDir);
}

// Load environment variables with priority: .env.local > .env
const envLocalPath = path.join(rootDir, '.env.local');
const envPath = path.join(rootDir, '.env');

if (fs.existsSync(envLocalPath)) {
  console.log('📋 Loading environment from .env.local');
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log('📋 Loading environment from .env');
  require('dotenv').config({ path: envPath });
} else {
  console.warn('⚠️ No .env or .env.local file found, using system environment variables');
}

const { RobustHttpClient } = require('./resilience/http-client');
const { RateLimiter } = require('./resilience/rate-limiter');
const { QueueProcessor } = require('./resilience/queue-processor');
const { DatabaseManager } = require('./resilience/database-manager');
const { handler: errorHandler, createOperationalError, ErrorTypes } = require('./resilience/error-manager');

// Import existing discovery and scraping modules
const { NPMDiscovery } = require('./discovery/npm-discovery');
const { GitHubEnhancedDiscovery } = require('./discovery/github-enhanced-discovery');
const { NPMScraper } = require('./scraping/npm-scraper');
const { ComprehensiveIntelligenceCollector } = require('./scraping/comprehensive-intelligence-collector');
const { EnhancedMCPValidator } = require('./validation/enhanced-mcp-validator');

class ProductionMCPCrawler extends QueueProcessor {
  constructor(options = {}) {
    super({
      name: 'production-mcp-crawler',
      batchSize: options.batchSize || 3,
      maxConcurrentBatches: options.maxConcurrentBatches || 2,
      processingInterval: options.processingInterval || 2000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000
    });

    // Configuration
    this.sources = options.sources || ['npm'];
    this.maxPackages = options.maxPackages || 25;
    this.dryRun = options.dryRun !== false; // Default to dry run for safety
    this.shouldValidateMCPs = options.shouldValidateMCPs || false;
    this.shouldStoreMCPs = options.shouldStoreMCPs || false;
    this.useComprehensiveIntelligence = options.useComprehensiveIntelligence !== false; // Default to true

    // Resilience components
    this.httpClient = new RobustHttpClient({
      name: 'mcp-crawler-http',
      maxRetries: 3,
      baseTimeout: 30000
    });

    this.rateLimiter = new RateLimiter({
      globalMaxConcurrent: 5,
      domainMaxConcurrent: 2,
      requestsPerSecond: 3,
      burstSize: 10
    });

    this.databaseManager = new DatabaseManager({
      name: 'mcp-crawler-db',
      maxRetries: 3,
      maxConnections: 5
    });

    // Discovery and scraping
    this.discoveryModules = this.initializeDiscoveryModules();
    
    // Initialize intelligence collection strategy
    if (this.useComprehensiveIntelligence) {
      this.intelligenceCollector = new ComprehensiveIntelligenceCollector({
        timeout: 60000,
        maxRetries: 2,
        enableInstallation: true,
        enableValidation: true,
        enableCleanup: true,
        fallbackToBasicScraping: true
      });
      console.log('🧠 Using comprehensive intelligence collection');
    } else {
      this.scraper = new NPMScraper();
      console.log('📦 Using basic NPM scraping');
    }
    
    // Validation
    if (this.shouldValidateMCPs) {
      this.validator = new EnhancedMCPValidator({
        timeout: 45000, // 45 seconds per validation
        enableInstallation: true,
        enableExecution: true,
        cleanup: true
      });
    }

    // Operational state
    this.isRunning = false;
    this.startTime = null;
    this.stats = {
      discovered: 0,
      scraped: 0,
      validated: 0,
      stored: 0,
      failed: 0,
      errors: []
    };

    this.setupMonitoring();
  }

  initializeDiscoveryModules() {
    const modules = {};
    
    if (this.sources.includes('npm')) {
      modules.npm = new NPMDiscovery();
    }
    
    if (this.sources.includes('github')) {
      modules.github = new GitHubEnhancedDiscovery();
    }

    return modules;
  }

  setupMonitoring() {
    // Health monitoring every 30 seconds
    setInterval(() => {
      this.logHealthStatus();
    }, 30000);

    // Detailed stats every 5 minutes
    setInterval(() => {
      this.logDetailedStats();
    }, 300000);
  }

  async initialize() {
    console.log('🚀 Initializing Production MCP Crawler...');
    
    try {
      // Initialize database
      if (this.shouldStoreMCPs && !this.dryRun) {
        await this.databaseManager.initialize();
        console.log('✅ Database manager initialized');
      }

      // Test HTTP client
      await this.testHttpClient();
      console.log('✅ HTTP client tested');

      // Initialize discovery modules
      for (const [name, module] of Object.entries(this.discoveryModules)) {
        if (module.initialize) {
          await module.initialize();
        }
        console.log(`✅ ${name} discovery module initialized`);
      }

      console.log('🎉 Production MCP Crawler initialization complete');
      
    } catch (error) {
      console.error('❌ Failed to initialize crawler:', error.message);
      throw createOperationalError(
        ErrorTypes.VALIDATION_ERROR,
        `Crawler initialization failed: ${error.message}`
      );
    }
  }

  async testHttpClient() {
    try {
      // Test with a simple HTTP request
      await this.httpClient.get('https://httpbin.org/status/200');
    } catch (error) {
      console.warn('⚠️ HTTP client test failed, but continuing:', error.message);
    }
  }

  async crawl() {
    if (this.isRunning) {
      throw createOperationalError(
        ErrorTypes.VALIDATION_ERROR,
        'Crawler is already running'
      );
    }

    this.isRunning = true;
    this.startTime = Date.now();
    
    console.log('🚀 Starting Production MCP Crawl');
    console.log(`📊 Configuration: ${this.maxPackages} packages, sources: [${this.sources.join(', ')}], dry run: ${this.dryRun}`);

    try {
      // Phase 1: Discovery
      const discoveredPackages = await this.performDiscovery();
      console.log(`📡 Discovery complete: ${discoveredPackages.length} packages found`);

      // Phase 2: Queue processing (scraping)
      await this.queuePackagesForProcessing(discoveredPackages);
      
      // Phase 3: Wait for processing to complete
      await this.drain();

      // Phase 4: Store results (if enabled)
      if (this.shouldStoreMCPs && !this.dryRun && this.processedMCPs.length > 0) {
        await this.storeResults();
      }

      const duration = Date.now() - this.startTime;
      console.log('🎉 Crawl completed successfully');
      console.log(`📊 Final stats: ${JSON.stringify(this.stats, null, 2)}`);
      console.log(`⏱️ Total duration: ${Math.round(duration / 1000)}s`);

      return this.stats;

    } catch (error) {
      console.error('❌ Crawl failed:', error.message);
      this.stats.errors.push(error.message);
      throw error;
      
    } finally {
      this.isRunning = false;
    }
  }

  async performDiscovery() {
    console.log('📡 Starting discovery phase...');
    const allPackages = [];

    for (const source of this.sources) {
      const discoveryModule = this.discoveryModules[source];
      if (!discoveryModule) {
        console.warn(`⚠️ No discovery module for source: ${source}`);
        continue;
      }

      try {
        console.log(`🔍 Discovering from ${source}...`);
        
        // Use the correct method name for each discovery module
        let packages;
        if (source === 'npm' && discoveryModule.discoverMCPs) {
          // NPM discovery doesn't accept parameters, returns all then we filter
          packages = await discoveryModule.discoverMCPs();
        } else if (source === 'github' && discoveryModule.discoverMCPs) {
          // GitHub discovery also uses discoverMCPs method
          packages = await discoveryModule.discoverMCPs();
        } else if (discoveryModule.discover) {
          packages = await discoveryModule.discover(this.maxPackages);
        } else {
          throw new Error(`No compatible discovery method found for ${source}`);
        }
        
        // Apply filtering and deduplication
        const filteredPackages = this.filterPackages(packages);
        allPackages.push(...filteredPackages);
        
        console.log(`✅ ${source}: ${filteredPackages.length} packages discovered`);
        
      } catch (error) {
        console.error(`❌ Discovery failed for ${source}:`, error.message);
        this.stats.errors.push(`Discovery ${source}: ${error.message}`);
      }
    }

    // Remove duplicates
    const uniquePackages = this.deduplicatePackages(allPackages);
    this.stats.discovered = uniquePackages.length;
    
    return uniquePackages.slice(0, this.maxPackages);
  }

  filterPackages(packages) {
    // Apply MCP-specific filtering
    return packages.filter(pkg => {
      // Basic validation
      if (!pkg.name) {
        return false;
      }

      // If coming from NPM discovery, packages are already filtered as MCP servers
      // Just add the missing package_manager field and return them
      if (pkg.discoveryMethod) {
        pkg.package_manager = 'npm'; // Add missing field
        return true;
      }

      // For other sources, apply MCP-specific checks
      if (!pkg.package_manager) {
        return false;
      }

      if (pkg.name.includes('mcp') || 
          pkg.description?.toLowerCase().includes('mcp') ||
          pkg.description?.toLowerCase().includes('model context protocol')) {
        return true;
      }

      return false;
    });
  }

  deduplicatePackages(packages) {
    const seen = new Set();
    return packages.filter(pkg => {
      const key = `${pkg.package_manager}:${pkg.name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async queuePackagesForProcessing(packages) {
    console.log(`📥 Queuing ${packages.length} packages for processing...`);
    
    this.processedMCPs = [];
    
    for (const pkg of packages) {
      await this.add(pkg, 1, { type: 'mcp-package' });
    }
  }

  // Override QueueProcessor's processItem method
  async processItem(item) {
    const pkg = item.data;
    
    try {
      // Rate limiting
      const release = await this.rateLimiter.acquire(pkg.github_url || pkg.npm_url || 'unknown://unknown');
      
      try {
        // Scrape/collect intelligence for the package
        const scrapedMCP = await this.scrapePackage(pkg);
        
        if (scrapedMCP) {
          this.stats.scraped++;
          console.log(`✅ Processed: ${scrapedMCP.name}`);
          
          // For comprehensive intelligence, validation is already done during intelligence collection
          // For basic scraping, we still need separate validation
          if (this.shouldValidateMCPs && this.validator && !this.useComprehensiveIntelligence) {
            try {
              console.log(`🔍 Validating: ${scrapedMCP.name}`);
              const validationResult = await this.validator.validateMCP(scrapedMCP);
              
              // Use Claude-powered health status determination
              scrapedMCP.health_status = this.determineHealthStatus(validationResult);
              scrapedMCP.verified = validationResult.isValid;
              scrapedMCP.last_health_check = new Date().toISOString();
              
              // Extract tools from execution result if available
              if (validationResult.extractedTools && validationResult.extractedTools.length > 0) {
                scrapedMCP.tools = validationResult.extractedTools;
                console.log(`🛠️ Found ${validationResult.extractedTools.length} tools from execution`);
              }
              
              // Re-analyze with execution data for enhanced tool detection
              if (validationResult.executionDetails && this.scraper.claudeAnalyzer) {
                try {
                  const enhancedAnalysis = await this.scraper.claudeAnalyzer.analyzePackageComprehensively(
                    { name: scrapedMCP.name }, 
                    { description: scrapedMCP.description }, 
                    null, 
                    validationResult.executionDetails, 
                    null
                  );
                  
                  // Update with enhanced data
                  if (enhancedAnalysis.tools.length > scrapedMCP.tools.length) {
                    scrapedMCP.tools = enhancedAnalysis.tools;
                    console.log(`🧠 Enhanced tool detection: ${enhancedAnalysis.tools.length} tools`);
                  }
                  
                  if (enhancedAnalysis.useCases.length > 0) {
                    scrapedMCP.use_cases = enhancedAnalysis.useCases;
                    console.log(`📋 Generated ${enhancedAnalysis.useCases.length} use cases`);
                  }
                } catch (enhanceError) {
                  console.log(`⚠️ Enhancement analysis failed: ${enhanceError.message}`);
                }
              }
              
              if (validationResult.errors.length > 0) {
                console.log(`⚠️ Validation warnings for ${scrapedMCP.name}: ${validationResult.errors.join(', ')}`);
              }
              
              this.stats.validated++;
              console.log(`✅ Validated: ${scrapedMCP.name} - ${scrapedMCP.health_status}`);
              
            } catch (validationError) {
              console.log(`❌ Validation failed for ${scrapedMCP.name}: ${validationError.message}`);
              scrapedMCP.health_status = 'down';
              scrapedMCP.last_health_check = new Date().toISOString();
            }
          }
          
          this.processedMCPs.push(scrapedMCP);
          return scrapedMCP;
        } else {
          throw createOperationalError(
            ErrorTypes.PARSING_ERROR,
            `Failed to scrape package: ${pkg.name}`
          );
        }
        
      } finally {
        release();
      }
      
    } catch (error) {
      this.stats.failed++;
      console.error(`❌ Failed to process ${pkg.name}:`, error.message);
      throw error;
    }
  }

  async scrapePackage(pkg) {
    try {
      if (this.useComprehensiveIntelligence) {
        // Use comprehensive intelligence collection
        console.log(`🧠 Collecting comprehensive intelligence for ${pkg.name}...`);
        const result = await this.intelligenceCollector.collectIntelligence(pkg);
        
        if (result.success) {
          console.log(`✅ Comprehensive intelligence collected for ${pkg.name}`);
          if (result.fallbackUsed) {
            console.log(`⚠️ Fallback was used for ${pkg.name}`);
          }
          return result.data; // Already in database format
        } else {
          throw new Error(`Intelligence collection failed: ${result.error}`);
        }
        
      } else {
        // Use traditional NPM scraper
        const originalHttpClient = this.scraper.httpClient;
        this.scraper.httpClient = this.httpClient;
        
        const scrapedMCP = await this.scraper.scrapeMCPPackage(pkg);
        
        // Restore original HTTP client
        this.scraper.httpClient = originalHttpClient;
        
        return scrapedMCP;
      }
      
    } catch (error) {
      throw createOperationalError(
        ErrorTypes.PARSING_ERROR,
        `Scraping failed for ${pkg.name}: ${error.message}`
      );
    }
  }

  async storeResults() {
    if (!this.processedMCPs || this.processedMCPs.length === 0) {
      console.log('📦 No MCPs to store');
      return;
    }

    console.log(`📦 Storing ${this.processedMCPs.length} MCPs to database...`);
    
    try {
      const result = await this.databaseManager.insertMCPs(this.processedMCPs);
      
      if (result.error) {
        throw createOperationalError(
          ErrorTypes.DATABASE_ERROR,
          `Database insertion failed: ${result.error.message}`
        );
      }

      this.stats.stored = result.data?.length || 0;
      console.log(`✅ Successfully stored ${this.stats.stored} MCPs`);
      
    } catch (error) {
      console.error('❌ Failed to store MCPs:', error.message);
      this.stats.errors.push(`Storage: ${error.message}`);
      throw error;
    }
  }

  logHealthStatus() {
    const httpStats = this.httpClient.getStats();
    const rateLimiterStats = this.rateLimiter.getStats();
    const dbStats = this.databaseManager.getStats();
    const queueStats = this.getStats();

    console.log('🏥 HEALTH STATUS:');
    console.log(`   HTTP: ${httpStats.successRate}% success (${httpStats.totalRequests} requests)`);
    console.log(`   Rate Limiter: ${rateLimiterStats.globalActive}/${rateLimiterStats.globalMaxConcurrent} active`);
    console.log(`   Database: ${dbStats.isHealthy ? '✅' : '❌'} ${dbStats.successRate}% success`);
    console.log(`   Queue: ${queueStats.queueSize} pending, ${queueStats.activeBatches} active batches`);
  }

  logDetailedStats() {
    console.log('📊 DETAILED STATS:');
    console.log('HTTP Client:', JSON.stringify(this.httpClient.getStats(), null, 2));
    console.log('Rate Limiter:', JSON.stringify(this.rateLimiter.getStats(), null, 2));
    console.log('Database:', JSON.stringify(this.databaseManager.getStats(), null, 2));
    console.log('Queue Processor:', JSON.stringify(this.getStats(), null, 2));
    console.log('Crawler:', JSON.stringify(this.stats, null, 2));
  }

  async getSystemHealth() {
    const httpHealth = await this.httpClient.healthCheck();
    const dbHealth = await this.databaseManager.getHealth();
    const queueStats = this.getStats();
    
    const overallHealthy = (
      httpHealth.healthy &&
      dbHealth.healthy &&
      parseFloat(queueStats.successRate) > 70
    );

    return {
      healthy: overallHealthy,
      components: {
        http: httpHealth,
        database: dbHealth,
        queue: queueStats,
        rateLimiter: this.rateLimiter.getStats()
      },
      crawlerStats: this.stats,
      uptime: this.startTime ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Determine health status using Claude-powered logic
   */
  determineHealthStatus(validationResult) {
    if (!validationResult) {
      return 'down';
    }

    // Healthy: Package installs, runs, and responds properly as MCP server
    if (validationResult.isValid && 
        validationResult.canInstall && 
        validationResult.canExecute && 
        validationResult.hasValidConnection) {
      return 'healthy';
    }

    // Degraded: Package installs and may partially work but has issues
    if (validationResult.canInstall && 
        (validationResult.errors.some(err => err.includes('auth')) ||
         validationResult.errors.some(err => err.includes('config')) ||
         validationResult.errors.some(err => err.includes('environment')))) {
      return 'degraded';
    }

    // Degraded: Installs but doesn't execute properly  
    if (validationResult.canInstall && !validationResult.canExecute) {
      return 'degraded';
    }

    // Down: Won't install or completely broken
    return 'down';
  }

  async destroy() {
    console.log('🛑 Shutting down Production MCP Crawler...');
    
    try {
      // Stop processing
      await super.destroy();
      
      // Cleanup components
      await this.rateLimiter.destroy();
      this.httpClient.destroy();
      await this.databaseManager.destroy();
      
      // Cleanup validator if enabled
      if (this.validator && this.validator.destroy) {
        await this.validator.destroy();
      }
      
      // Cleanup intelligence collector if enabled
      if (this.intelligenceCollector && this.intelligenceCollector.destroy) {
        await this.intelligenceCollector.destroy();
      }
      
      console.log('✅ Production MCP Crawler shutdown complete');
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = { ProductionMCPCrawler };