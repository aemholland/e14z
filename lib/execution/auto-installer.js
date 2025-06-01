/**
 * E14Z Auto-Installation Engine - NPX-like functionality for MCPs
 * Enhanced with multi-package manager support and security features
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { PackageManagerFactory } = require('./package-managers');
const { SecureCacheManager } = require('./cache-manager');
const { ErrorHandler, ErrorCategories } = require('./error-handler');
const { SecureExecutor } = require('./sandbox');
const { EnhancedPackageVerifier } = require('./package-verifier');

class AutoInstaller {
  constructor(options = {}) {
    this.baseUrl = options.apiUrl || process.env.E14Z_API_URL || 'https://www.e14z.com';
    this.timeout = options.timeout || 60000; // 1 minute for installs
    
    // Initialize secure cache manager
    this.cacheManager = new SecureCacheManager({
      cacheDir: options.cacheDir,
      securityLevel: options.securityLevel || 'standard',
      enableIntegrityChecks: options.enableIntegrityChecks !== false,
      maxCacheSize: options.maxCacheSize,
      maxCacheAge: options.maxCacheAge
    });
    
    // Initialize package manager factory
    this.packageFactory = new PackageManagerFactory({
      timeout: this.timeout,
      enableSecurity: options.enableSecurity !== false,
      cacheManager: this.cacheManager
    });
    
    // Initialize error handler
    this.errorHandler = new ErrorHandler({
      enableRetry: options.enableRetry !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      enableRollback: options.enableRollback !== false
    });
    
    // Initialize secure executor for command injection protection
    this.secureExecutor = new SecureExecutor({
      enableSandboxing: options.enableSandboxing !== false,
      securityLevel: options.securityLevel || 'standard',
      enableResourceLimits: options.enableResourceLimits !== false,
      enableNetworkIsolation: options.enableNetworkIsolation || false,
      enableFileSystemIsolation: options.enableFileSystemIsolation || false,
      maxMemory: options.maxMemory,
      maxCpuTime: options.maxCpuTime,
      allowedPaths: options.allowedPaths
    });
    
    // Initialize enhanced package verifier
    this.packageVerifier = new EnhancedPackageVerifier({
      enableNetworkChecks: options.enableNetworkChecks || false,
      securityLevel: options.securityLevel || 'standard',
      maxPackageSize: options.maxPackageSize,
      maxFiles: options.maxFiles
    });
    
    this.initialized = false;
  }

  /**
   * Initialize auto-installer (lazy initialization)
   */
  async initialize() {
    if (!this.initialized) {
      await this.cacheManager.initialize();
      this.initialized = true;
    }
  }

  /**
   * Main entry point: Install and execute MCP with enhanced error handling
   */
  async installAndRun(slug, options = {}) {
    const context = { slug, operation: 'install_and_run' };
    
    try {
      return await this.errorHandler.executeWithRetry(async () => {
        // 0. Initialize if needed
        await this.initialize();
        
        // 1. Get MCP metadata
        const mcp = await this.getMCPDetails(slug);
        
        // 2. Find compatible installation method
        const installMethod = this.selectInstallMethod(mcp, options);
        
        // 3. Get package manager for this installation method
        const packageManager = this.packageFactory.getManager(mcp, installMethod);
        
        // 4. Parse package information
        const packageInfo = packageManager.parseInstallCommand(installMethod);
        
        // 5. Check secure cache or install
        const isInstalled = await this.cacheManager.isCached(slug, packageInfo.version);
        
        let cacheLocation;
        if (isInstalled) {
          console.log(`✅ Using cached ${slug}@${packageInfo.version}`);
          cacheLocation = this.cacheManager.getCacheLocation(slug, packageInfo.version);
        } else {
          console.log(`📦 Installing ${slug}@${packageInfo.version}...`);
          cacheLocation = await this.installWithTransaction(slug, packageInfo, packageManager, installMethod);
        }
        
        // 6. Execute from secure cache
        return await this.executeFromSecureCache(slug, mcp, packageInfo, packageManager, cacheLocation, options);
      }, context);
      
    } catch (error) {
      const categorizedError = this.errorHandler.handleError(error, context);
      
      return {
        success: false,
        error: categorizedError.message,
        category: categorizedError.category,
        recoverable: categorizedError.recoverable,
        suggestions: categorizedError.suggestions,
        slug: slug
      };
    }
  }

  /**
   * Get MCP details from API
   */
  async getMCPDetails(slug) {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${this.baseUrl}/api/mcp/${slug}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch MCP details: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.error) {
      throw new Error(`MCP not found: ${data.error}`);
    }
    
    return data.mcp;
  }

  /**
   * Select best installation method based on priority and availability
   */
  selectInstallMethod(mcp, options = {}) {
    const methods = mcp.installation_methods || [];
    
    // Enhanced priority order: npm, pip, git
    const priorityOrder = ['npm', 'pip', 'git'];
    
    // Allow user to specify preferred method
    if (options.preferredMethod) {
      const preferred = methods.find(m => m.type === options.preferredMethod);
      if (preferred) {
        return preferred;
      }
    }
    
    // Find first available method in priority order
    for (const type of priorityOrder) {
      const method = methods.find(m => m.type === type);
      if (method) {
        return method;
      }
    }
    
    // Fallback: try to parse primary endpoint
    if (mcp.endpoint) {
      if (mcp.endpoint.includes('npx') || mcp.endpoint.includes('npm')) {
        return {
          type: 'npm',
          command: mcp.endpoint,
          description: 'Parsed from endpoint'
        };
      } else if (mcp.endpoint.includes('pip')) {
        return {
          type: 'pip',
          command: mcp.endpoint,
          description: 'Parsed from endpoint'
        };
      } else if (mcp.endpoint.includes('git clone')) {
        return {
          type: 'git',
          command: mcp.endpoint,
          description: 'Parsed from endpoint'
        };
      }
    }
    
    throw new Error(`No supported installation method found for ${mcp.name}. Supported: ${priorityOrder.join(', ')}`);
  }

  /**
   * Install MCP with transaction support for rollback capability
   */
  async installWithTransaction(slug, packageInfo, packageManager, installMethod) {
    const transaction = this.errorHandler.createTransaction(slug, packageInfo.version, this.cacheManager);
    const cacheLocation = this.cacheManager.getCacheLocation(slug, packageInfo.version);
    
    try {
      console.log(`🔄 Starting installation transaction for ${slug}@${packageInfo.version}`);
      
      // 1. Create package directory
      await fs.mkdir(cacheLocation.packageDir, { recursive: true });
      transaction.recordOperation('directory_created', { path: cacheLocation.packageDir });
      
      // 2. Install package using appropriate package manager
      console.log(`📥 Installing package via ${packageManager.type}...`);
      await packageManager.install(packageInfo, cacheLocation.packageDir);
      transaction.recordOperation('package_installed', { 
        packageManager: packageManager.type,
        packageInfo 
      });
      
      // 3. Get package metadata for security scanning
      console.log(`🔍 Analyzing package metadata...`);
      const packageMetadata = await packageManager.getPackageMetadata(packageInfo, cacheLocation.packageDir);
      
      // 4. Enhanced package verification
      console.log(`🛡️  Performing enhanced security verification...`);
      const verificationResult = await this.packageVerifier.verifyPackage(
        packageInfo, 
        packageMetadata, 
        cacheLocation.packageDir
      );
      
      // Handle verification results
      if (!verificationResult.passed) {
        const criticalThreats = verificationResult.threats.filter(t => t.severity === 'critical');
        if (criticalThreats.length > 0) {
          throw new Error(`Package verification failed - Critical threats detected: ${criticalThreats.map(t => t.message).join(', ')}`);
        } else {
          console.warn(`⚠️  Package verification warnings (score: ${verificationResult.score}/100):`);
          verificationResult.threats.forEach(threat => {
            console.warn(`   - ${threat.severity.toUpperCase()}: ${threat.message}`);
          });
        }
      } else {
        console.log(`✅ Package verification passed (score: ${verificationResult.score}/100, confidence: ${verificationResult.confidence})`);
      }
      
      // 5. Add to secure cache with validation
      console.log(`🔐 Adding to secure cache with validation...`);
      await this.cacheManager.addToCache(slug, packageInfo.version, {
        packageInfo,
        installMethod,
        packageManager: packageManager.type,
        installedAt: new Date().toISOString(),
        transactionId: crypto.randomBytes(8).toString('hex'),
        verification: verificationResult
      }, packageMetadata);
      
      // 5. Mark transaction as completed
      transaction.markCompleted();
      console.log(`✅ Installation transaction completed for ${slug}@${packageInfo.version}`);
      
      return cacheLocation;
      
    } catch (error) {
      console.error(`❌ Installation transaction failed for ${slug}@${packageInfo.version}: ${error.message}`);
      
      // Rollback the transaction
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(`Failed to rollback transaction: ${rollbackError.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Execute MCP from secure cache with enhanced environment setup
   */
  async executeFromSecureCache(slug, mcp, packageInfo, packageManager, cacheLocation, options = {}) {
    try {
      // 1. Find executable using package manager
      const execCommand = await packageManager.findExecutable(packageInfo, cacheLocation.packageDir);
      
      if (!execCommand) {
        throw new Error(`Could not determine how to execute ${slug}`);
      }
      
      // 2. Set up secure execution environment
      const env = {
        ...process.env,
        // Add package-specific environment variables
        ...execCommand.env,
        // Add any auth environment variables from options
        ...options.env
      };
      
      // 3. Enhanced PATH setup for different package types
      if (execCommand.type === 'node') {
        const binDir = path.join(cacheLocation.packageDir, 'node_modules', '.bin');
        env.PATH = `${binDir}:${process.env.PATH}`;
      } else if (execCommand.type === 'python') {
        env.PYTHONPATH = cacheLocation.packageDir;
      }
      
      console.log(`🚀 Executing ${slug}@${packageInfo.version}: ${execCommand.command} ${execCommand.args.join(' ')}`);
      
      // 4. Execute with secure sandbox protection
      // MCP servers need longer timeouts or no timeout for persistent processes
      const isMCPServer = execCommand.args.some(arg => 
        arg.includes('mcp') || arg.includes('server') || 
        execCommand.command.includes('mcp') || 
        slug.includes('mcp')
      );
      
      const timeout = options.timeout || (isMCPServer ? 0 : 30000); // No timeout for MCP servers
      
      const result = await this.secureExecutor.execute(execCommand.command, execCommand.args, {
        cwd: cacheLocation.packageDir,
        env: env,
        stdio: options.stdio || 'pipe',
        timeout: timeout
      });
      
      return {
        success: result.code === 0,
        command: `${execCommand.command} ${execCommand.args.join(' ')}`,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.code,
        cacheDir: cacheLocation.packageDir,
        version: packageInfo.version,
        packageManager: packageManager.type
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        slug: slug,
        version: packageInfo.version,
        cacheDir: cacheLocation.packageDir
      };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    await this.initialize();
    return await this.cacheManager.getCacheStats();
  }

  /**
   * Clear cache for specific MCP or all MCPs
   */
  async clearCache(slug = null, version = null) {
    await this.initialize();
    
    if (slug) {
      await this.cacheManager.removeFromCache(slug, version || 'latest');
      return { success: true, message: `Cache cleared for ${slug}` };
    } else {
      const result = await this.cacheManager.cleanup({ force: true });
      return { success: true, message: `Cleaned ${result.cleaned} packages`, ...result };
    }
  }

  /**
   * List all cached MCPs
   */
  async listCached() {
    try {
      await this.initialize();
      const stats = await this.cacheManager.getCacheStats();
      
      // TODO: Implement proper cache listing from SecureCacheManager
      return {
        success: true,
        cached: [],
        stats: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        cached: []
      };
    }
  }

  /**
   * Check if MCP can be auto-installed
   */
  async canAutoInstall(slug) {
    const context = { slug, operation: 'can_auto_install' };
    
    try {
      const mcp = await this.getMCPDetails(slug);
      const installMethod = this.selectInstallMethod(mcp);
      const packageManager = this.packageFactory.getManager(mcp, installMethod);
      const packageInfo = packageManager.parseInstallCommand(installMethod);
      
      return {
        available: true,
        method: installMethod.type,
        command: installMethod.command,
        packageInfo: packageInfo,
        packageManager: packageManager.type
      };
    } catch (error) {
      const categorizedError = this.errorHandler.handleError(error, context);
      
      return {
        available: false,
        error: categorizedError.message,
        category: categorizedError.category,
        suggestions: categorizedError.suggestions
      };
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats() {
    return this.errorHandler.getErrorStats();
  }

  /**
   * Force rollback of a failed installation
   */
  async forceRollback(slug, version = 'latest') {
    try {
      await this.initialize();
      
      console.log(`🔄 Force rolling back ${slug}@${version}...`);
      
      // Remove from cache
      await this.cacheManager.removeFromCache(slug, version);
      
      return {
        success: true,
        message: `Successfully rolled back ${slug}@${version}`
      };
    } catch (error) {
      const categorizedError = this.errorHandler.handleError(error, {
        slug,
        version,
        operation: 'force_rollback'
      });
      
      return {
        success: false,
        error: categorizedError.message,
        category: categorizedError.category
      };
    }
  }

  /**
   * Spawn command with timeout and proper error handling
   */
  async spawnCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });
      
      let stdout = '';
      let stderr = '';
      
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
          if (options.stdio === 'inherit') {
            process.stdout.write(data);
          }
        });
      }
      
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          if (options.stdio === 'inherit') {
            process.stderr.write(data);
          }
        });
      }
      
      const timeout = options.timeout ? setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout) : null;
      
      child.on('close', (code) => {
        if (timeout) clearTimeout(timeout);
        resolve({ code, stdout, stderr });
      });
      
      child.on('error', (error) => {
        if (timeout) clearTimeout(timeout);
        reject(error);
      });
    });
  }
}

module.exports = { AutoInstaller };