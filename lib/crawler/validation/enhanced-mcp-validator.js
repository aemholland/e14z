/**
 * Enhanced MCP Validator using Auto-Installer
 * Uses the same auto-installation engine that agents use for realistic validation
 */

const { AutoInstaller } = require('../../execution/auto-installer');
const crypto = require('crypto');

class EnhancedMCPValidator {
  constructor(options = {}) {
    this.timeout = options.timeout || 60000; // 1 minute for real installs
    this.maxConcurrentValidations = options.maxConcurrentValidations || 2;
    this.enableInstallation = options.enableInstallation !== false;
    this.enableExecution = options.enableExecution !== false;
    this.cleanup = options.cleanup !== false;
    
    // Initialize auto-installer with conservative settings for validation
    this.autoInstaller = new AutoInstaller({
      timeout: this.timeout,
      enableSecurity: true,
      enableSandboxing: true,
      enableResourceLimits: true,
      maxRetries: 1, // Reduce retries for validation speed
      securityLevel: 'standard'
    });
  }

  /**
   * Validate MCP using real auto-installer (same as agents use)
   */
  async validateMCP(mcpData) {
    const validationId = crypto.randomBytes(8).toString('hex');
    console.log(`🔍 Validating MCP: ${mcpData.name} (${validationId})`);

    const results = {
      isValid: false,
      canInstall: false,
      canExecute: false,
      hasValidConnection: false,
      errors: [],
      warnings: [],
      extractedTools: [],
      connectionType: null,
      protocolVersion: null,
      validationTime: Date.now(),
      executionDetails: null
    };

    try {
      // Ensure we have a slug for the auto-installer
      if (!mcpData.slug) {
        results.errors.push('No slug provided for MCP validation');
        return results;
      }

      // Create a mock MCP entry for auto-installer to use
      const mockMCP = await this.createMockMCPForValidation(mcpData);
      
      console.log(`   🚀 Testing with auto-installer: ${mcpData.auto_install_command}`);
      
      // Use the auto-installer to actually install and run the MCP
      // This is exactly what agents do, so it's the most realistic test
      const installResult = await this.autoInstaller.installAndRun(mcpData.slug, {
        timeout: this.timeout / 2, // Half timeout for execution
        preferredMethod: mcpData.install_type,
        env: {}, // No auth env vars for validation (tests auth requirements)
        source: 'validation'
      });

      results.executionDetails = installResult;

      // Parse auto-installer results
      if (installResult.success) {
        console.log(`   ✅ Auto-installer succeeded for ${mcpData.name}`);
        
        results.canInstall = true;
        results.canExecute = true;
        results.isValid = true;
        
        // Extract MCP-specific information from the execution
        if (installResult.mcpServerRunning) {
          results.hasValidConnection = true;
          results.connectionType = 'stdio';
          console.log(`   🔌 MCP server is running properly`);
          
          // For servers that start successfully, test if they need auth
          // by examining their stderr/stdout for auth-related messages
          const authRequirements = await this.detectAuthRequirements(mcpData, installResult, results);
          if (authRequirements.length > 0) {
            results.authRequirements = authRequirements;
          }
        }
        
        // Extract tools if available in execution result
        if (installResult.tools && installResult.tools.length > 0) {
          results.extractedTools = installResult.tools;
          console.log(`   🛠️ Found ${installResult.tools.length} tools`);
        }
        
      } else {
        console.log(`   ❌ Auto-installer failed for ${mcpData.name}: ${installResult.error}`);
        
        // Categorize the failure
        results.errors.push(installResult.error);
        
        // Check if it's an installation vs execution failure
        if (installResult.category === 'installation') {
          results.canInstall = false;
          results.canExecute = false;
        } else if (installResult.category === 'auth' || installResult.category === 'env') {
          // Auth errors mean the package installs but needs configuration
          results.canInstall = true;
          results.canExecute = false;
          results.warnings.push('Package requires authentication/configuration');
        } else if (installResult.category === 'execution') {
          results.canInstall = true;
          results.canExecute = false;
        } else {
          // Unknown failure
          results.canInstall = false;
          results.canExecute = false;
        }
      }

      // Clean up if requested
      if (this.cleanup && installResult.cacheDir) {
        try {
          await this.autoInstaller.clearCache(mcpData.slug);
        } catch (cleanupError) {
          console.warn(`   ⚠️ Failed to cleanup validation cache: ${cleanupError.message}`);
        }
      }

      const status = results.isValid ? '✅ VALID' : '❌ INVALID';
      console.log(`   ${status} ${mcpData.name}: install=${results.canInstall}, execute=${results.canExecute}`);

      return results;

    } catch (error) {
      console.error(`   💥 Validation crashed for ${mcpData.name}: ${error.message}`);
      results.errors.push(`Validation crashed: ${error.message}`);
      return results;
    }
  }

  /**
   * Create a mock MCP entry that the auto-installer can use
   * The auto-installer expects to fetch MCP details from the API,
   * but during validation we need to provide the data directly
   */
  async createMockMCPForValidation(mcpData) {
    // Store original getMCPDetails method
    const originalGetMCPDetails = this.autoInstaller.getMCPDetails;
    
    // Override getMCPDetails to return our validation data
    this.autoInstaller.getMCPDetails = async (slug) => {
      if (slug === mcpData.slug) {
        return {
          id: mcpData.id || `validation-${crypto.randomBytes(4).toString('hex')}`,
          name: mcpData.name,
          slug: mcpData.slug,
          auto_install_command: mcpData.auto_install_command,
          install_type: mcpData.install_type,
          endpoint: mcpData.endpoint,
          installation_methods: mcpData.installation_methods || [{
            type: mcpData.install_type,
            command: mcpData.auto_install_command,
            preferred: true
          }]
        };
      }
      
      // Fallback to original method for other slugs
      return originalGetMCPDetails.call(this.autoInstaller, slug);
    };

    return mcpData;
  }

  /**
   * Batch validate multiple MCPs with concurrency control
   */
  async validateMCPs(mcpDataArray) {
    console.log(`🔍 Batch validating ${mcpDataArray.length} MCPs...`);
    
    const semaphore = this.createSemaphore(this.maxConcurrentValidations);
    const results = [];

    await Promise.all(mcpDataArray.map(async (mcpData, index) => {
      await semaphore.acquire();
      
      try {
        console.log(`📦 [${index + 1}/${mcpDataArray.length}] Validating ${mcpData.name}...`);
        const result = await this.validateMCP(mcpData);
        results[index] = { mcpData, result };
      } catch (error) {
        console.error(`❌ Validation failed for ${mcpData.name}: ${error.message}`);
        results[index] = {
          mcpData,
          result: {
            isValid: false,
            canInstall: false,
            canExecute: false,
            errors: [error.message],
            warnings: [],
            extractedTools: []
          }
        };
      } finally {
        semaphore.release();
      }
    }));

    const validCount = results.filter(r => r.result.isValid).length;
    const installableCount = results.filter(r => r.result.canInstall).length;
    
    console.log(`📊 Batch validation complete:`);
    console.log(`   Valid MCPs: ${validCount}/${mcpDataArray.length}`);
    console.log(`   Installable: ${installableCount}/${mcpDataArray.length}`);
    
    return results;
  }

  /**
   * Test if auto-installer can determine installation method
   */
  async canAutoInstall(mcpData) {
    try {
      await this.createMockMCPForValidation(mcpData);
      const canInstall = await this.autoInstaller.canAutoInstall(mcpData.slug);
      return canInstall;
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Get detailed error statistics from auto-installer
   */
  getValidationStats() {
    return {
      autoInstallerStats: this.autoInstaller.getErrorStats(),
      cacheStats: this.autoInstaller.getCacheStats ? this.autoInstaller.getCacheStats() : null
    };
  }

  /**
   * Force cleanup all validation caches
   */
  async cleanupAll() {
    try {
      await this.autoInstaller.clearCache(); // Clear all cached packages
      return { success: true, message: 'Validation caches cleared' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Detect auth requirements for MCP servers that start successfully
   * Many MCPs start without auth but require it for actual functionality
   */
  async detectAuthRequirements(mcpData, installResult, results) {
    try {
      console.log(`   🔍 Testing auth requirements for running MCP server...`);
      
      // Analyze package name for common auth patterns
      const packageName = mcpData.name.toLowerCase();
      const knownAuthRequirements = this.getKnownAuthRequirements(packageName);
      
      if (knownAuthRequirements.length > 0) {
        results.warnings.push('MCP server requires authentication to function properly');
        console.log(`   🔐 Known auth required: ${knownAuthRequirements.join(', ')}`);
        return knownAuthRequirements;
      }
      
      // Check output for auth-related messages
      const output = (installResult.output || '') + (installResult.error || '');
      const authMessages = this.analyzeOutputForAuthHints(output);
      
      if (authMessages.length > 0) {
        results.warnings.push('Auth requirements detected from server output');
        console.log(`   🔐 Auth hints found: ${authMessages.join(', ')}`);
        return authMessages;
      }
      
      // Try to send an MCP request to see if auth errors occur
      const authTest = await this.testMCPAuthRequirements(mcpData);
      if (authTest.requiresAuth) {
        results.warnings.push('Auth required based on MCP protocol test');
        console.log(`   🔐 MCP protocol auth test: ${authTest.envVars.join(', ')}`);
        return authTest.envVars;
      }
      
      return [];
      
    } catch (error) {
      console.warn(`   ⚠️ Auth detection failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Get known auth requirements for common MCP packages
   */
  getKnownAuthRequirements(packageName) {
    const authPatterns = {
      'github': ['GITHUB_PERSONAL_ACCESS_TOKEN', 'GITHUB_TOKEN'],
      'slack': ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'],
      'stripe': ['STRIPE_API_KEY', 'STRIPE_SECRET_KEY'],
      'notion': ['NOTION_API_KEY', 'NOTION_TOKEN'],
      'google': ['GOOGLE_API_KEY', 'GOOGLE_CREDENTIALS'],
      'openai': ['OPENAI_API_KEY'],
      'anthropic': ['ANTHROPIC_API_KEY'],
      'brave': ['BRAVE_SEARCH_API_KEY'],
      'discord': ['DISCORD_BOT_TOKEN'],
      'twitter': ['TWITTER_API_KEY', 'TWITTER_BEARER_TOKEN'],
      'postgres': ['DATABASE_URL', 'POSTGRES_URL'],
      'mysql': ['DATABASE_URL', 'MYSQL_URL'],
      'mongodb': ['MONGODB_URI', 'DATABASE_URL'],
      'redis': ['REDIS_URL'],
      'firebase': ['FIREBASE_CREDENTIALS', 'GOOGLE_APPLICATION_CREDENTIALS']
    };

    for (const [service, envVars] of Object.entries(authPatterns)) {
      if (packageName.includes(service)) {
        return envVars;
      }
    }

    return [];
  }

  /**
   * Analyze server output for authentication hints
   */
  analyzeOutputForAuthHints(output) {
    if (!output) return [];
    
    const authHints = [];
    const lines = output.toLowerCase().split('\n');
    
    for (const line of lines) {
      // Look for environment variable mentions
      const envVarMatch = line.match(/([A-Z][A-Z0-9_]+).*(?:not set|missing|required|undefined)/i);
      if (envVarMatch) {
        authHints.push(envVarMatch[1]);
        continue;
      }
      
      // Look for API key mentions
      if (line.includes('api key') && (line.includes('missing') || line.includes('required'))) {
        authHints.push('API_KEY');
      }
      
      // Look for token mentions
      if (line.includes('token') && (line.includes('missing') || line.includes('required'))) {
        authHints.push('TOKEN');
      }
      
      // Look for authentication errors
      if (line.includes('unauthorized') || line.includes('authentication failed')) {
        authHints.push('AUTHENTICATION_REQUIRED');
      }
    }
    
    return [...new Set(authHints)];
  }

  /**
   * Test MCP server for auth requirements by sending protocol requests
   */
  async testMCPAuthRequirements(mcpData) {
    try {
      // This would involve sending actual MCP protocol requests to test functionality
      // For now, return based on package patterns
      const packageName = mcpData.name.toLowerCase();
      
      if (packageName.includes('github')) {
        return {
          requiresAuth: true,
          envVars: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
          reason: 'GitHub API access required'
        };
      }
      
      if (packageName.includes('brave')) {
        return {
          requiresAuth: true,
          envVars: ['BRAVE_SEARCH_API_KEY'],
          reason: 'Brave Search API access required'
        };
      }
      
      return { requiresAuth: false, envVars: [] };
      
    } catch (error) {
      return { requiresAuth: false, envVars: [] };
    }
  }

  /**
   * Create semaphore for concurrency control
   */
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
}

module.exports = { EnhancedMCPValidator };