/**
 * Enhanced E14Z Execution Engine with Auto-Installation
 * Integrates AutoInstaller for NPX-like functionality
 */

const { AutoInstaller } = require('./auto-installer');
const { ExecutionEngine } = require('./engine');

class EnhancedExecutionEngine extends ExecutionEngine {
  constructor(options = {}) {
    super(options);
    this.autoInstaller = new AutoInstaller(options);
    this.enableAutoInstall = options.enableAutoInstall !== false; // Default: enabled
  }

  /**
   * Enhanced MCP execution with auto-installation
   */
  async executeMCP(slug, options = {}) {
    const validSlug = this.validateSlug(slug);
    
    try {
      // First try the original approach (for locally installed MCPs)
      const originalResult = await super.executeMCP(slug, { 
        ...options, 
        skipAuthCheck: true // We'll handle auth separately
      });
      
      // If it succeeded, return it
      if (originalResult.success) {
        return originalResult;
      }
      
      // If auto-install is disabled, return original error
      if (!this.enableAutoInstall) {
        return originalResult;
      }
      
      // If it failed due to command not found, try auto-installation
      if (originalResult.error && originalResult.error.includes('Command not found')) {
        console.log(`🤖 Auto-installing ${validSlug}...`);
        return await this.autoInstaller.installAndRun(validSlug, options);
      }
      
      // Other failures, return original result
      return originalResult;
      
    } catch (error) {
      // If we can't even get MCP details, try auto-install anyway
      if (this.enableAutoInstall) {
        console.log(`🤖 Attempting auto-install for ${validSlug}...`);
        return await this.autoInstaller.installAndRun(validSlug, options);
      }
      
      return {
        success: false,
        error: error.message,
        slug: validSlug
      };
    }
  }

  /**
   * Check if auto-installation is available for an MCP
   */
  async canAutoInstall(slug) {
    try {
      const mcp = await this.getMCPDetails(slug);
      const installMethod = this.autoInstaller.selectInstallMethod(mcp);
      return {
        available: true,
        method: installMethod.type,
        command: installMethod.command
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Clear installation cache for an MCP
   */
  async clearCache(slug) {
    const path = require('path');
    const fs = require('fs').promises;
    const os = require('os');
    
    const cacheDir = path.join(os.homedir(), '.e14z', 'cache', slug);
    
    try {
      await fs.rm(cacheDir, { recursive: true, force: true });
      return { success: true, message: `Cache cleared for ${slug}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List cached MCPs
   */
  async listCached() {
    const path = require('path');
    const fs = require('fs').promises;
    const os = require('os');
    
    const cacheBaseDir = path.join(os.homedir(), '.e14z', 'cache');
    
    try {
      const entries = await fs.readdir(cacheBaseDir);
      const cached = [];
      
      for (const entry of entries) {
        const entryPath = path.join(cacheBaseDir, entry);
        const markerFile = path.join(entryPath, '.e14z-installed');
        
        try {
          const stat = await fs.stat(entryPath);
          if (stat.isDirectory()) {
            let installInfo = { installed_at: 'unknown' };
            
            try {
              const markerContent = await fs.readFile(markerFile, 'utf8');
              installInfo = JSON.parse(markerContent);
            } catch (e) {
              // Marker file not found or invalid
            }
            
            cached.push({
              slug: entry,
              path: entryPath,
              ...installInfo
            });
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
      
      return { success: true, cached };
    } catch (error) {
      return { success: false, error: error.message, cached: [] };
    }
  }
}

module.exports = { EnhancedExecutionEngine };