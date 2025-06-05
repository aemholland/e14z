/**
 * Production Database Manager with Connection Pooling and Retry Logic
 * Handles Supabase connections robustly with automatic failover
 */

const { createClient } = require('@supabase/supabase-js');
const { createOperationalError, ErrorTypes } = require('./error-manager');

class DatabaseManager {
  constructor(options = {}) {
    this.name = options.name || 'database-manager';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.connectionTimeout = options.connectionTimeout || 30000;
    this.maxConnections = options.maxConnections || 10;
    
    this.clients = [];
    this.activeConnections = 0;
    this.connectionQueue = [];
    this.isHealthy = true;
    this.lastHealthCheck = Date.now();
    
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      retriedQueries: 0,
      averageQueryTime: 0,
      connectionErrors: 0,
      timeouts: 0,
      poolHits: 0,
      poolMisses: 0
    };

    this.setupHealthMonitoring();
  }

  async initialize() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw createOperationalError(
        ErrorTypes.DATABASE_ERROR,
        'Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)'
      );
    }

    // Create initial connection pool
    console.log(`🔗 Initializing database connection pool (${this.maxConnections} connections)`);
    
    for (let i = 0; i < Math.min(3, this.maxConnections); i++) {
      try {
        const client = await this.createConnection();
        this.clients.push({
          client,
          inUse: false,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          queryCount: 0
        });
      } catch (error) {
        console.error(`❌ Failed to create initial connection ${i + 1}:`, error.message);
        throw createOperationalError(
          ErrorTypes.DATABASE_ERROR,
          `Failed to initialize database connection pool: ${error.message}`
        );
      }
    }

    console.log(`✅ Database connection pool initialized with ${this.clients.length} connections`);
  }

  async createConnection() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'User-Agent': 'E14Z-MCP-Crawler/1.0'
        }
      }
    });

    // Test the connection
    await this.testConnection(client);
    
    return client;
  }

  async testConnection(client) {
    try {
      const { error } = await client.from('mcps').select('id').limit(1);
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is OK
        throw error;
      }
    } catch (error) {
      throw createOperationalError(
        ErrorTypes.DATABASE_ERROR,
        `Database connection test failed: ${error.message}`
      );
    }
  }

  async acquireConnection() {
    // Look for available connection
    for (const connection of this.clients) {
      if (!connection.inUse) {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        this.activeConnections++;
        this.stats.poolHits++;
        return connection;
      }
    }

    // Create new connection if under limit
    if (this.clients.length < this.maxConnections) {
      this.stats.poolMisses++;
      
      try {
        const client = await this.createConnection();
        const connection = {
          client,
          inUse: true,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          queryCount: 0
        };
        
        this.clients.push(connection);
        this.activeConnections++;
        
        console.log(`🔗 Created new database connection (${this.clients.length}/${this.maxConnections})`);
        return connection;
        
      } catch (error) {
        this.stats.connectionErrors++;
        throw createOperationalError(
          ErrorTypes.DATABASE_ERROR,
          `Failed to create database connection: ${error.message}`
        );
      }
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(createOperationalError(
          ErrorTypes.DATABASE_ERROR,
          `Database connection timeout after ${this.connectionTimeout}ms`
        ));
      }, this.connectionTimeout);

      this.connectionQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  releaseConnection(connection) {
    connection.inUse = false;
    this.activeConnections = Math.max(0, this.activeConnections - 1);

    // Process queue
    if (this.connectionQueue.length > 0) {
      const waiter = this.connectionQueue.shift();
      connection.inUse = true;
      connection.lastUsed = Date.now();
      this.activeConnections++;
      waiter.resolve(connection);
    }
  }

  async executeQuery(operation, retryCount = 0) {
    this.stats.totalQueries++;
    const startTime = Date.now();
    let connection = null;

    try {
      connection = await this.acquireConnection();
      connection.queryCount++;

      const result = await operation(connection.client);
      
      const duration = Date.now() - startTime;
      this.updateQueryTimeStats(duration);
      this.stats.successfulQueries++;

      console.log(`📊 DB query completed in ${duration}ms`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.stats.failedQueries++;

      if (this.shouldRetryQuery(error, retryCount)) {
        this.stats.retriedQueries++;
        
        const delay = this.calculateRetryDelay(retryCount);
        console.warn(`🔄 Retrying DB query (attempt ${retryCount + 1}/${this.maxRetries}) after ${delay}ms: ${error.message}`);
        
        await this.sleep(delay);
        return this.executeQuery(operation, retryCount + 1);
      }

      console.error(`❌ DB query failed after ${duration}ms:`, error.message);
      throw this.convertDatabaseError(error);

    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  shouldRetryQuery(error, retryCount) {
    if (retryCount >= this.maxRetries) {
      return false;
    }

    // Retry on connection errors, timeouts, and temporary server errors
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNABORTED',
      'connection lost',
      'connection terminated',
      'temporary failure',
      'service unavailable'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  calculateRetryDelay(retryCount) {
    // Exponential backoff with jitter
    const baseDelay = this.retryDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 500; // Up to 500ms jitter
    return Math.min(baseDelay + jitter, 10000); // Max 10 seconds
  }

  convertDatabaseError(error) {
    if (error.message?.includes('timeout')) {
      this.stats.timeouts++;
      return createOperationalError(
        ErrorTypes.TIMEOUT_ERROR,
        `Database query timeout: ${error.message}`
      );
    }

    if (error.code?.startsWith('PGRST')) {
      return createOperationalError(
        ErrorTypes.DATABASE_ERROR,
        `PostgreSQL error: ${error.message}`
      );
    }

    return createOperationalError(
      ErrorTypes.DATABASE_ERROR,
      `Database error: ${error.message}`
    );
  }

  updateQueryTimeStats(duration) {
    if (this.stats.successfulQueries === 1) {
      this.stats.averageQueryTime = duration;
    } else {
      // Rolling average
      this.stats.averageQueryTime = 
        (this.stats.averageQueryTime * 0.9) + (duration * 0.1);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setupHealthMonitoring() {
    setInterval(async () => {
      await this.performHealthCheck();
      this.cleanupOldConnections();
    }, 30000); // Every 30 seconds
  }

  async performHealthCheck() {
    try {
      await this.executeQuery(async (client) => {
        const { error } = await client.from('mcps').select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        return { success: true };
      });

      if (!this.isHealthy) {
        console.log('✅ Database health check passed - connection restored');
        this.isHealthy = true;
      }
      
      this.lastHealthCheck = Date.now();

    } catch (error) {
      console.error('❌ Database health check failed:', error.message);
      this.isHealthy = false;
    }
  }

  cleanupOldConnections() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    const minConnections = 2;

    for (let i = this.clients.length - 1; i >= 0; i--) {
      const connection = this.clients[i];
      
      if (!connection.inUse && 
          this.clients.length > minConnections &&
          (now - connection.lastUsed) > maxAge) {
        
        this.clients.splice(i, 1);
        console.log(`🧹 Cleaned up old database connection (age: ${Math.round((now - connection.lastUsed) / 1000)}s)`);
      }
    }
  }

  getStats() {
    const successRate = this.stats.totalQueries > 0 ? 
      (this.stats.successfulQueries / this.stats.totalQueries) * 100 : 100;

    const poolUtilization = this.maxConnections > 0 ?
      (this.activeConnections / this.maxConnections) * 100 : 0;

    return {
      database: this.name,
      isHealthy: this.isHealthy,
      successRate: successRate.toFixed(1),
      poolSize: this.clients.length,
      activeConnections: this.activeConnections,
      maxConnections: this.maxConnections,
      poolUtilization: poolUtilization.toFixed(1),
      queueSize: this.connectionQueue.length,
      averageQueryTime: Math.round(this.stats.averageQueryTime),
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
      ...this.stats
    };
  }

  async getHealth() {
    const timeSinceLastCheck = Date.now() - this.lastHealthCheck;
    const isStale = timeSinceLastCheck > 60000; // 1 minute

    return {
      healthy: this.isHealthy && !isStale,
      lastCheck: new Date(this.lastHealthCheck).toISOString(),
      timeSinceLastCheck,
      isStale,
      stats: this.getStats()
    };
  }

  // Map scraped MCP data to valid database schema fields (exact current schema)
  mapToValidSchema(mcp) {
    // Valid database schema fields based on the ACTUAL current mcps table (54 columns)
    const validFields = {
      // Core required fields (id, slug, name, endpoint, category are required)
      name: mcp.name,
      slug: mcp.slug,
      endpoint: mcp.endpoint || `npx ${mcp.name}`, // Generate endpoint if missing
      category: mcp.category,
      
      // Optional basic fields
      description: mcp.description,
      connection_type: mcp.connection_type || 'stdio',
      auth_method: mcp.auth_method,
      protocol_version: mcp.protocol_version || '2024-11-05',
      
      // Arrays and objects
      tags: mcp.tags || [],
      use_cases: mcp.use_cases || [],
      tools: mcp.tools,
      tool_endpoints: mcp.tool_endpoints || [],
      
      // Installation (agent-optimized)
      install_type: mcp.installationMethods?.[0]?.type || mcp.install_type,
      installation_methods: mcp.installationMethods || mcp.installation_methods,
      install_command: mcp.installationMethods?.[0]?.command || mcp.install_command,
      package_manager: mcp.package_manager,
      auto_install_command: mcp.installationMethods?.[0]?.command || mcp.auto_install_command,
      clean_command: mcp.clean_command,
      
      // Authentication
      auth_required: mcp.auth_required || false,
      auth_methods: mcp.auth_methods || [],
      required_env_vars: mcp.required_env_vars || [],
      optional_env_vars: mcp.optional_env_vars || [],
      credentials_needed: mcp.credentials_needed || [],
      setup_complexity: mcp.setup_complexity || 'simple',
      auth_summary: mcp.auth_summary,
      setup_instructions: mcp.setup_instructions,
      
      // Status and verification
      verified: mcp.verified || false,
      verified_at: mcp.verified_at,
      verification_notes: mcp.verification_notes,
      health_status: mcp.health_status || 'unknown',
      auto_discovered: mcp.auto_discovered || false,
      discovery_source: mcp.discovery_source,
      overall_score: mcp.qualityScore || mcp.overall_intelligence_score,
      rating: mcp.totalScore || mcp.rating,
      
      // URLs and documentation (agent-optimized)
      github_url: mcp.githubUrl || mcp.github_url,
      documentation_url: mcp.documentationUrl || mcp.documentation_url,
      website_url: mcp.websiteUrl || mcp.website_url,
      
      // Author and metadata (agent-optimized)
      author: mcp.author,
      company: mcp.company,
      license: mcp.license,
      
      // GitHub metrics
      stars: mcp.stars || 0,
      language: mcp.language,
      topics: mcp.topics || [],
      
      // Pricing
      pricing_model: mcp.pricing_model || 'free',
      pricing_details: mcp.pricing_details || {},
      
      // Status fields
      source_type: mcp.source_type || 'wrapped',
      official_status: mcp.official_status || 'community',
      is_official: mcp.is_official || false,
      has_readme: mcp.has_readme || false,
      recent_activity: mcp.recent_activity || false,
      
      // Timestamps
      last_scraped_at: mcp.last_scraped_at,
      last_health_check: mcp.last_health_check,
      created_at: mcp.created_at,
      updated_at: mcp.updated_at,
      
      // Claiming
      claimed_by: mcp.claimed_by,
      claim_verification: mcp.claim_verification,
      
      // ✅ COMPREHENSIVE INTELLIGENCE FIELDS (Match Supabase Schema)
      // Tool Intelligence
      working_tools: mcp.working_tools || [],
      failing_tools: mcp.failing_tools || [],
      working_tools_count: mcp.working_tools?.length || 0,
      failing_tools_count: mcp.failing_tools?.length || 0,
      tool_execution_results: mcp.tools || [],
      tool_response_times: mcp.tool_response_times || {},
      // Calculate tool success rate from working/failing counts (no tool_count column in schema)
      tool_success_rate: (mcp.working_tools?.length || 0) + (mcp.failing_tools?.length || 0) > 0 
        ? (mcp.working_tools?.length || 0) / ((mcp.working_tools?.length || 0) + (mcp.failing_tools?.length || 0)) 
        : null,
      
      // Performance Intelligence  
      initialization_time_ms: mcp.initialization_time,
      average_response_time_ms: mcp.average_response_time,
      min_response_time_ms: mcp.min_response_time,
      max_response_time_ms: mcp.max_response_time,
      connection_stability: 'stable', // Default for successful connections
      reliability_score: mcp.reliability_score,
      
      // Auth Intelligence
      auth_error_messages: mcp.auth_error_messages || mcp.common_errors || [],
      auth_setup_instructions: mcp.auth_setup_instructions || mcp.troubleshooting_tips || [],
      detected_env_vars: mcp.required_env_vars || [],
      auth_failure_mode: mcp.auth_required ? 'required' : 'none',
      
      // Resource Intelligence  
      available_resources: mcp.available_resources || [],
      prompt_templates: mcp.available_prompts || [],
      
      // Quality Intelligence
      documentation_quality_score: mcp.documentation_quality,
      user_experience_rating: mcp.user_experience_rating || 'unknown',
      integration_complexity: mcp.integration_complexity,
      maintenance_level: mcp.maintenance_level || 'unknown',
      value_proposition: mcp.value_proposition || mcp.description,
      
      // Tool Complexity Analysis
      tool_complexity_analysis: mcp.tool_complexity_analysis || {},
      simple_tools_count: mcp.simple_tools_count || 0,
      complex_tools_count: mcp.complex_tools_count || 0,
      
      // Testing and Intelligence Metadata
      testing_strategy: mcp.intelligence_collection_method,
      intelligence_collection_date: new Date().toISOString(),
      overall_intelligence_score: mcp.overall_intelligence_score,
      
      // Error and Troubleshooting Intelligence
      error_patterns: mcp.common_errors || [],
      troubleshooting_data: mcp.troubleshooting_tips || [],
      common_issues: mcp.common_issues || [],
      
      // Enhanced Fields that exist in schema
      server_capabilities: mcp.server_capabilities,
      performance_metrics: {
        initialization_time: mcp.initialization_time,
        average_response_time: mcp.average_response_time,
        reliability_score: mcp.reliability_score
      }
    };

    // Remove undefined/null values to avoid database errors
    const cleaned = {};
    for (const [key, value] of Object.entries(validFields)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  async insertMCPs(mcps) {
    if (!Array.isArray(mcps) || mcps.length === 0) {
      return { data: [], error: null };
    }

    return this.executeQuery(async (client) => {
      // Map to valid schema and insert in batches
      const batchSize = 10;
      const results = [];
      
      for (let i = 0; i < mcps.length; i += batchSize) {
        const batch = mcps.slice(i, i + batchSize).map(mcp => this.mapToValidSchema(mcp));
        
        try {
          // Use upsert to handle duplicates gracefully
          const { data, error } = await client
            .from('mcps')
            .upsert(batch, { 
              onConflict: 'slug',
              ignoreDuplicates: false 
            })
            .select('id, name, slug');

          if (error) {
            console.error(`❌ Batch insert error (items ${i}-${i + batch.length - 1}):`, error);
            throw error;
          }

          if (data) {
            results.push(...data);
          }

          console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} MCPs`);
          
        } catch (error) {
          console.error(`❌ Failed to insert batch ${Math.floor(i / batchSize) + 1}:`, error);
          throw error;
        }
      }

      return { data: results, error: null };
    });
  }

  async destroy() {
    console.log(`🛑 Destroying database manager ${this.name}`);
    
    // Reject all queued requests
    this.connectionQueue.forEach(waiter => {
      waiter.reject(createOperationalError(
        ErrorTypes.DATABASE_ERROR,
        'Database manager shutting down'
      ));
    });
    
    this.connectionQueue.length = 0;
    this.clients.length = 0;
    this.activeConnections = 0;
    
    console.log(`✅ Database manager ${this.name} destroyed`);
  }
}

module.exports = { DatabaseManager };