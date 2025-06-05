/**
 * Comprehensive Intelligence Collector for Production MCP Crawler
 * 
 * Integrates RealisticMCPIntelligence with production crawler requirements:
 * - Database-ready output format
 * - Performance optimized for batch processing
 * - Graceful fallbacks for auth-required MCPs
 * - Rate limiting and cleanup management
 */

const { RealisticMCPIntelligence } = require('../../../realistic-mcp-intelligence');
const { createOperationalError, ErrorTypes } = require('../resilience/error-manager');

class ComprehensiveIntelligenceCollector {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 2,
      enableInstallation: options.enableInstallation !== false,
      enableValidation: options.enableValidation !== false,
      enableCleanup: options.enableCleanup !== false,
      fallbackToBasicScraping: options.fallbackToBasicScraping !== false,
      ...options
    };
    
    // Skip auto-installer initialization - we'll use RealisticMCPIntelligence's built-in installation
    
    this.stats = {
      attempted: 0,
      successful: 0,
      failed: 0,
      authDetected: 0,
      fallbackUsed: 0,
      errors: []
    };
  }

  /**
   * Collect comprehensive intelligence for an MCP package
   * Returns database-ready intelligence object
   */
  async collectIntelligence(packageInfo) {
    this.stats.attempted++;
    
    try {
      console.log(`🧠 Collecting comprehensive intelligence: ${packageInfo.name}`);
      
      // Step 1: Installation is handled by RealisticMCPIntelligence
      // No separate installation step needed
      
      // Step 2: Start with comprehensive execution (let RealisticMCPIntelligence detect auth)
      // Use quick pre-check only as a hint, not a decision
      const authHint = await this.detectAuthRequirement(packageInfo);
      
      // Step 3: Collect intelligence using RealisticMCPIntelligence
      // Always start with comprehensive execution - it will detect auth requirements
      let intelligence;
      try {
        const collector = new RealisticMCPIntelligence();
        // Start with no-auth assumption, let RealisticMCPIntelligence detect auth needs
        intelligence = await collector.collectIntelligence(packageInfo.name, false);
        
        // Update stats based on actual detected auth requirements
        if (intelligence.auth.required) {
          this.stats.authDetected++;
        }
      } catch (intelligenceError) {
        // Fallback to basic intelligence if comprehensive collection fails
        if (this.options.fallbackToBasicScraping) {
          console.log(`⚠️ Comprehensive intelligence failed, using fallback for ${packageInfo.name}: ${intelligenceError.message}`);
          this.stats.fallbackUsed++;
          intelligence = await this.createFallbackIntelligence(packageInfo, authHint);
        } else {
          throw new Error(`Intelligence collection failed: ${intelligenceError.message}`);
        }
      }
      
      // Step 4: Transform to database format
      const databaseRecord = this.transformToDatabase(intelligence, packageInfo, null);
      
      // Step 5: Cleanup is handled by RealisticMCPIntelligence
      
      this.stats.successful++;
      console.log(`✅ Intelligence collection complete: ${packageInfo.name}`);
      
      return {
        success: true,
        data: databaseRecord,
        intelligence: intelligence,
        fallbackUsed: false
      };
      
    } catch (error) {
      this.stats.failed++;
      this.stats.errors.push({
        package: packageInfo.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.error(`❌ Intelligence collection failed for ${packageInfo.name}: ${error.message}`);
      
      // Try fallback if enabled
      if (this.options.fallbackToBasicScraping && !error.message.includes('fallback')) {
        console.log(`🔄 Attempting fallback for ${packageInfo.name}`);
        try {
          const fallbackIntelligence = await this.createFallbackIntelligence(packageInfo, authHint);
          const databaseRecord = this.transformToDatabase(fallbackIntelligence, packageInfo, null);
          
          this.stats.fallbackUsed++;
          return {
            success: true,
            data: databaseRecord,
            intelligence: fallbackIntelligence,
            fallbackUsed: true
          };
        } catch (fallbackError) {
          console.error(`❌ Fallback also failed: ${fallbackError.message}`);
        }
      }
      
      return {
        success: false,
        error: error.message,
        package: packageInfo.name
      };
    }
  }


  /**
   * Quick detection of auth requirements from package metadata
   */
  async detectAuthRequirement(packageInfo) {
    const indicators = [
      'auth', 'api', 'key', 'token', 'oauth', 'login',
      'hubspot', 'salesforce', 'slack', 'discord', 'stripe'
    ];
    
    const description = (packageInfo.description || '').toLowerCase();
    const name = packageInfo.name.toLowerCase();
    
    return indicators.some(indicator => 
      name.includes(indicator) || description.includes(indicator)
    );
  }

  /**
   * Create fallback intelligence when comprehensive collection fails
   */
  async createFallbackIntelligence(packageInfo, authHint = false) {
    console.log(`🔄 Creating fallback intelligence for ${packageInfo.name}`);
    
    return {
      packageName: packageInfo.name,
      authRequired: authHint,
      testingStrategy: 'fallback_basic',
      
      protocol: {
        version: null,
        serverInfo: {},
        capabilities: {},
        initializationTime: null,
        connectionStability: 'unknown'
      },
      
      tools: {
        count: 0,
        schemas: [],
        executionResults: [],
        workingTools: [],
        failingTools: [],
        complexityAnalysis: {},
        realWorldExamples: []
      },
      
      auth: {
        required: authHint,
        methods: this.guessAuthMethods(packageInfo),
        requiredEnvVars: this.guessEnvVars(packageInfo),
        errorMessages: [],
        setupComplexity: 'unknown',
        setupInstructions: []
      },
      
      performance: {
        initTime: null,
        toolResponseTimes: {},
        resourceUsage: {},
        reliability: 'unknown'
      },
      
      resources: {
        available: [],
        prompts: [],
        notifications: false
      },
      
      errors: {
        patterns: [{ type: 'collection_failed', message: 'Comprehensive intelligence collection failed' }],
        troubleshooting: [],
        commonIssues: [],
        recovery: []
      },
      
      business: {
        useCases: this.guessUseCases(packageInfo),
        valueProposition: packageInfo.description || '',
        integrationComplexity: 'unknown',
        maintenanceLevel: 'unknown'
      },
      
      quality: {
        reliabilityScore: null,
        documentationQuality: 'unknown',
        userExperience: 'unknown',
        overallScore: null
      }
    };
  }

  guessAuthMethods(packageInfo) {
    const name = packageInfo.name.toLowerCase();
    
    if (name.includes('oauth')) return ['oauth'];
    if (name.includes('api') || name.includes('key')) return ['api_key'];
    if (name.includes('token')) return ['token'];
    
    return [];
  }

  guessEnvVars(packageInfo) {
    const name = packageInfo.name.toLowerCase();
    const company = name.split('-')[0] || name.split('_')[0];
    
    if (company === 'hubspot') return ['HUBSPOT_API_KEY'];
    if (company === 'slack') return ['SLACK_BOT_TOKEN'];
    if (company === 'discord') return ['DISCORD_TOKEN'];
    if (company === 'stripe') return ['STRIPE_SECRET_KEY'];
    
    return [`${company.toUpperCase()}_API_KEY`];
  }

  guessUseCases(packageInfo) {
    const description = (packageInfo.description || '').toLowerCase();
    const name = packageInfo.name.toLowerCase();
    
    const useCases = [];
    
    if (name.includes('database') || description.includes('database')) {
      useCases.push('Database operations and queries');
    }
    if (name.includes('file') || description.includes('file')) {
      useCases.push('File management and processing');
    }
    if (name.includes('api') || description.includes('api')) {
      useCases.push('API integration and data fetching');
    }
    if (name.includes('search') || description.includes('search')) {
      useCases.push('Search and information retrieval');
    }
    
    return useCases.length > 0 ? useCases : ['General automation and integration'];
  }

  /**
   * Transform intelligence data to database-compatible format
   */
  transformToDatabase(intelligence, packageInfo, installResult) {
    const now = new Date().toISOString();
    
    return {
      // Basic package info
      name: intelligence.packageName,
      slug: this.generateSlug(intelligence.packageName),
      description: packageInfo.description || intelligence.business.valueProposition,
      endpoint: `npx ${intelligence.packageName}`, // Required field
      package_manager: packageInfo.package_manager || 'npm',
      npm_url: packageInfo.npm_url,
      github_url: packageInfo.github_url,
      
      // Intelligence-derived fields
      auth_required: intelligence.auth.required,
      auth_methods: intelligence.auth.methods,
      auth_setup_complexity: intelligence.auth.setupComplexity,
      required_env_vars: intelligence.auth.requiredEnvVars,
      
      // Tools and capabilities
      tools: intelligence.tools.schemas.map(tool => ({
        name: tool.name,
        description: tool.description,
        schema: tool.inputSchema
      })),
      tool_count: intelligence.tools.count,
      working_tools: intelligence.tools.workingTools.map(t => t.name),
      failing_tools: intelligence.tools.failingTools.map(t => t.name),
      
      // Protocol information
      protocol_version: intelligence.protocol.version,
      server_capabilities: intelligence.protocol.capabilities,
      
      // Performance metrics
      initialization_time: intelligence.protocol.initializationTime,
      average_response_time: this.calculateAverageResponseTime(intelligence.tools.workingTools),
      reliability_score: intelligence.quality.reliabilityScore,
      
      // Resources
      available_resources: intelligence.resources.available,
      available_prompts: intelligence.resources.prompts,
      
      // Quality and health
      health_status: this.determineHealthStatus(intelligence),
      verified: intelligence.tools.workingTools.length > 0,
      overall_intelligence_score: intelligence.quality.overallScore,
      reliability_score: intelligence.quality.reliabilityScore,
      documentation_quality_score: intelligence.quality.documentationQuality,
      
      // Business value
      use_cases: intelligence.business.useCases,
      integration_complexity: intelligence.business.integrationComplexity,
      
      // Error patterns
      common_errors: intelligence.errors.patterns.map(e => e.message),
      troubleshooting_tips: intelligence.errors.troubleshooting,
      
      // Metadata
      last_updated: now,
      last_health_check: now,
      intelligence_collection_method: intelligence.testingStrategy,
      installation_successful: installResult?.success || false,
      
      // Search optimization
      category: this.inferCategory(packageInfo, intelligence),
      tags: this.generateTags(packageInfo, intelligence),
      
      // Version info
      version: packageInfo.version,
      
      // Additional metadata
      testing_notes: this.generateTestingNotes(intelligence, installResult)
    };
  }

  calculateAverageResponseTime(workingTools) {
    if (!workingTools || workingTools.length === 0) return null;
    
    const total = workingTools.reduce((sum, tool) => sum + (tool.responseTime || 0), 0);
    return Math.round(total / workingTools.length);
  }

  determineHealthStatus(intelligence) {
    const totalTools = intelligence.tools.count;
    const workingTools = intelligence.tools.workingTools.length;
    const authRequired = intelligence.auth.required;
    
    // If we couldn't establish a connection at all
    if (!intelligence.protocol.version) {
      return 'unknown'; // Connection failed
    }
    
    // If auth is required and we couldn't test tools fully
    if (authRequired && totalTools > 0 && workingTools === 0) {
      // We connected but couldn't test tools due to auth - that's not "down"
      return 'unknown'; // Need auth to assess properly
    }
    
    // If we successfully connected and established protocol
    if (totalTools === 0) {
      // MCP connected successfully but has no tools - this is healthy for resource/prompt MCPs
      return 'healthy';
    }
    
    // If we have tools and could test them
    if (workingTools === totalTools) {
      return 'healthy'; // All tools working
    } else if (workingTools > 0) {
      return 'degraded'; // Some tools working, some failing
    } else {
      return 'down'; // No tools working despite being available
    }
  }

  inferCategory(packageInfo, intelligence) {
    const name = packageInfo.name.toLowerCase();
    const description = (packageInfo.description || '').toLowerCase();
    const useCases = intelligence.business.useCases.join(' ').toLowerCase();
    
    const categories = {
      'databases': ['database', 'sql', 'postgres', 'mysql', 'mongodb', 'redis'],
      'cloud-storage': ['storage', 's3', 'blob', 'drive', 'cloud'],
      'content-creation': ['content', 'document', 'pdf', 'image', 'generate'],
      'communication': ['slack', 'discord', 'email', 'chat', 'message'],
      'web-apis': ['api', 'rest', 'http', 'web'],
      'development-tools': ['git', 'github', 'deploy', 'ci', 'build'],
      'ai-tools': ['ai', 'ml', 'openai', 'anthropic', 'gpt'],
      'productivity': ['calendar', 'task', 'todo', 'note'],
      'finance': ['payment', 'stripe', 'invoice', 'financial'],
      'infrastructure': ['server', 'monitoring', 'log', 'metric']
    };
    
    const text = `${name} ${description} ${useCases}`;
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }
    
    return 'other';
  }

  generateTags(packageInfo, intelligence) {
    const tags = [];
    
    // Add auth-related tags
    if (intelligence.auth.required) {
      tags.push('auth-required');
      tags.push(...intelligence.auth.methods.map(method => `auth-${method}`));
    } else {
      tags.push('no-auth');
    }
    
    // Add tool count tags
    if (intelligence.tools.count > 10) tags.push('many-tools');
    if (intelligence.tools.count > 0 && intelligence.tools.count <= 3) tags.push('few-tools');
    
    // Add quality tags
    if (intelligence.quality.overallScore > 0.8) tags.push('high-quality');
    if (intelligence.quality.reliabilityScore === 1) tags.push('fully-working');
    
    // Add performance tags
    if (intelligence.protocol.initializationTime < 2000) tags.push('fast-init');
    
    // Add package manager tag
    tags.push(packageInfo.package_manager || 'npm');
    
    return [...new Set(tags)];
  }

  generateSlug(packageName) {
    return packageName
      .toLowerCase()
      .replace(/[@\/]/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  generateTestingNotes(intelligence, installResult) {
    const notes = [];
    
    if (!installResult?.success) {
      notes.push('Installation failed - using fallback intelligence');
    }
    
    if (intelligence.auth.required) {
      notes.push(`Auth required: ${intelligence.auth.methods.join(', ')}`);
    }
    
    if (intelligence.tools.workingTools.length !== intelligence.tools.count) {
      notes.push(`${intelligence.tools.failingTools.length} tools failed testing`);
    }
    
    if (intelligence.testingStrategy === 'fallback_basic') {
      notes.push('Limited intelligence - comprehensive testing failed');
    }
    
    return notes.join('; ') || 'No special notes';
  }

  async cleanup(packageInfo) {
    try {
      // Cleanup is handled by RealisticMCPIntelligence during its execution
      console.log(`🧹 Cleanup completed for ${packageInfo.name}`);
    } catch (error) {
      console.warn(`⚠️ Cleanup warning for ${packageInfo.name}: ${error.message}`);
    }
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.attempted > 0 ? (this.stats.successful / this.stats.attempted) : 0,
      fallbackRate: this.stats.attempted > 0 ? (this.stats.fallbackUsed / this.stats.attempted) : 0,
      authDetectionRate: this.stats.attempted > 0 ? (this.stats.authDetected / this.stats.attempted) : 0
    };
  }

  async destroy() {
    // No specific cleanup needed - RealisticMCPIntelligence handles its own cleanup
  }
}

module.exports = { ComprehensiveIntelligenceCollector };