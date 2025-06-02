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
const { MultiStepExecutor } = require('./multi-step-executor');

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
   * Get installation command from the simplified auto_install_command field
   */
  selectInstallMethod(mcp, options = {}) {
    // Use the simplified auto_install_command field from database
    if (mcp.auto_install_command) {
      const command = mcp.auto_install_command.trim();
      
      // Determine installation type based on command
      let type = 'other';
      if (command.startsWith('npx ') || command.includes('npm install')) {
        type = 'npm';
      } else if (command.startsWith('pip ') || command.includes('pip install')) {
        type = 'pip';
      } else if (command.startsWith('git clone')) {
        type = 'git';
      } else if (command.startsWith('docker ')) {
        type = 'docker';
      }
      
      return {
        type: type,
        command: command,
        description: 'Auto-install command from database'
      };
    }
    
    // Fallback to old method if auto_install_command is not available
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
    
    throw new Error(`No supported installation method found for ${mcp.name}. Install command: ${mcp.auto_install_command || 'none'}`);
  }

  /**
   * Check if command is complex multi-step
   */
  isComplexCommand(command) {
    return command.includes('&&') || 
           (command.includes('git clone') && command.includes('pip install')) ||
           (command.includes('cd ') && command.includes('install')) ||
           command.includes('source ') ||
           command.includes('venv');
  }

  /**
   * Check if command needs git branch discovery
   */
  needsGitBranchDiscovery(command) {
    return command.startsWith('git clone') && !command.includes('--branch');
  }

  /**
   * Execute enhanced git installation with branch discovery
   */
  async executeEnhancedGitInstallation(command, workingDir) {
    const executor = new MultiStepExecutor({
      workingDir: workingDir,
      timeout: this.timeout
    });
    
    console.log(`🔧 Enhanced git installation: ${command}`);
    
    // Parse the git command and execute with branch discovery
    const step = executor.parseStep(command, workingDir);
    const result = await executor.executeGitClone(step);
    
    if (!result.success) {
      throw new Error(`Enhanced git installation failed: ${result.error}`);
    }
    
    console.log(`✅ Enhanced git installation completed successfully`);
    return result;
  }

  /**
   * Execute complex multi-step installation
   */
  async executeComplexInstallation(command, workingDir) {
    const executor = new MultiStepExecutor({
      workingDir: workingDir,
      timeout: this.timeout
    });
    
    console.log(`🔧 Parsing complex command: ${command}`);
    const steps = executor.parseCommand(command);
    console.log(`   Found ${steps.length} installation steps`);
    
    const result = await executor.executeSteps(steps);
    
    if (!result.success) {
      throw new Error(`Complex installation failed: ${result.error}`);
    }
    
    console.log(`✅ Complex installation completed successfully (${result.completedSteps} steps)`);
    return result;
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
      
      // 2. Check if this is a complex multi-step command
      if (this.isComplexCommand(installMethod.command)) {
        console.log(`🔧 Detected complex multi-step command, using advanced executor...`);
        await this.executeComplexInstallation(installMethod.command, cacheLocation.packageDir);
        transaction.recordOperation('complex_package_installed', { 
          command: installMethod.command,
          packageInfo 
        });
      } else if (this.needsGitBranchDiscovery(installMethod.command)) {
        console.log(`🔧 Detected git command needing branch discovery, using enhanced git...`);
        await this.executeEnhancedGitInstallation(installMethod.command, cacheLocation.packageDir);
        transaction.recordOperation('enhanced_git_installed', { 
          command: installMethod.command,
          packageInfo 
        });
      } else {
        // 3. Install package using appropriate package manager
        console.log(`📥 Installing package via ${packageManager.type}...`);
        await packageManager.install(packageInfo, cacheLocation.packageDir);
        transaction.recordOperation('package_installed', { 
          packageManager: packageManager.type,
          packageInfo 
        });
      }
      
      // 3. Get package metadata for security scanning
      console.log(`🔍 Analyzing package metadata...`);
      let packageMetadata;
      if (this.isComplexCommand(installMethod.command) || this.needsGitBranchDiscovery(installMethod.command)) {
        // For complex/enhanced installations, create basic metadata
        packageMetadata = {
          name: packageInfo.name,
          version: packageInfo.version,
          installMethod: this.isComplexCommand(installMethod.command) ? 'complex' : 'enhanced_git',
          command: installMethod.command,
          installedFiles: []
        };
      } else {
        packageMetadata = await packageManager.getPackageMetadata(packageInfo, cacheLocation.packageDir);
      }
      
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
   * Find executable in complex installation directory
   */
  async findExecutableInComplexInstallation(packageInfo, packageDir, mcp) {
    try {
      console.log(`🔍 Searching for executable in: ${packageDir}`);
      
      // Strategy 1: Check for package managers' entry points
      const packageEntryPoint = await this.findPackageEntryPoint(packageDir);
      if (packageEntryPoint) {
        console.log(`   Found package entry point: ${packageEntryPoint.originalCommand}`);
        return packageEntryPoint;
      }
      
      // Strategy 2: Recursive search for MCP-specific files
      const mcpExecutable = await this.recursiveFindMCPExecutable(packageDir, mcp);
      if (mcpExecutable) {
        console.log(`   Found MCP executable: ${mcpExecutable.originalCommand}`);
        return mcpExecutable;
      }
      
      // Strategy 3: Look for any executable files
      const anyExecutable = await this.findAnyExecutable(packageDir);
      if (anyExecutable) {
        console.log(`   Found executable file: ${anyExecutable.originalCommand}`);
        return anyExecutable;
      }
      
      console.log(`   No executable found in ${packageDir}`);
      return null;
    } catch (error) {
      console.warn(`Failed to find executable in complex installation: ${error.message}`);
      return null;
    }
  }

  /**
   * Find entry point from package managers (package.json, setup.py, pyproject.toml)
   */
  async findPackageEntryPoint(packageDir) {
    try {
      // Check package.json for Node.js projects
      const packageJsonPath = path.join(packageDir, 'package.json');
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        if (packageJson.main) {
          const mainFile = path.join(packageDir, packageJson.main);
          return {
            command: 'node',
            args: [mainFile],
            type: 'node',
            isMCPServer: true,
            originalCommand: `node ${mainFile}`
          };
        }
        if (packageJson.bin) {
          const binName = Object.keys(packageJson.bin)[0];
          const binPath = path.join(packageDir, packageJson.bin[binName]);
          return {
            command: 'node',
            args: [binPath],
            type: 'node',
            isMCPServer: true,
            originalCommand: `node ${binPath}`
          };
        }
      } catch (error) {
        // package.json doesn't exist or is invalid
      }
      
      // Check setup.py for Python projects
      const setupPyPath = path.join(packageDir, 'setup.py');
      try {
        await fs.stat(setupPyPath);
        // Look for __main__.py or main.py in the same directory
        const mainPyPatterns = ['__main__.py', 'main.py', 'server.py'];
        for (const pattern of mainPyPatterns) {
          const mainPyPath = path.join(packageDir, pattern);
          try {
            await fs.stat(mainPyPath);
            return {
              command: 'python3',
              args: [mainPyPath],
              type: 'python',
              isMCPServer: true,
              originalCommand: `python3 ${mainPyPath}`
            };
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        // setup.py doesn't exist
      }
      
      // Check pyproject.toml for Python projects
      const pyprojectPath = path.join(packageDir, 'pyproject.toml');
      try {
        const pyprojectContent = await fs.readFile(pyprojectPath, 'utf8');
        // Simple check for main module (not full TOML parsing)
        if (pyprojectContent.includes('main') || pyprojectContent.includes('server')) {
          const mainPyPath = path.join(packageDir, 'main.py');
          try {
            await fs.stat(mainPyPath);
            return {
              command: 'python3',
              args: [mainPyPath],
              type: 'python',
              isMCPServer: true,
              originalCommand: `python3 ${mainPyPath}`
            };
          } catch (error) {
            // Try server.py
            const serverPyPath = path.join(packageDir, 'server.py');
            try {
              await fs.stat(serverPyPath);
              return {
                command: 'python3',
                args: [serverPyPath],
                type: 'python',
                isMCPServer: true,
                originalCommand: `python3 ${serverPyPath}`
              };
            } catch (error) {
              // Continue searching
            }
          }
        }
      } catch (error) {
        // pyproject.toml doesn't exist
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Recursively search for MCP-specific executable files
   */
  async recursiveFindMCPExecutable(packageDir, mcp, maxDepth = 3) {
    try {
      return await this.searchDirectory(packageDir, mcp, 0, maxDepth);
    } catch (error) {
      return null;
    }
  }

  /**
   * Search directory for MCP executables
   */
  async searchDirectory(dirPath, mcp, currentDepth, maxDepth) {
    if (currentDepth >= maxDepth) return null;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // First pass: look for files in current directory
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(dirPath, entry.name);
          const executable = await this.checkFileForMCPExecutable(filePath, entry.name, mcp);
          if (executable) return executable;
        }
      }
      
      // Second pass: recurse into subdirectories
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subdirPath = path.join(dirPath, entry.name);
          const executable = await this.searchDirectory(subdirPath, mcp, currentDepth + 1, maxDepth);
          if (executable) return executable;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a file is an MCP executable
   */
  async checkFileForMCPExecutable(filePath, fileName, mcp) {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) return null;
      
      // Check for MCP-related names
      const lowerName = fileName.toLowerCase();
      const mcpPatterns = [
        'server',
        'mcp',
        mcp.slug,
        'main',
        '__main__',
        'run',
        'start',
        'app'
      ];
      
      const hasMCPPattern = mcpPatterns.some(pattern => 
        lowerName.includes(pattern) || 
        lowerName === pattern + '.py' || 
        lowerName === pattern + '.js' || 
        lowerName === pattern + '.sh' ||
        lowerName === pattern
      );
      
      if (!hasMCPPattern) return null;
      
      // Determine execution method based on file extension
      if (fileName.endsWith('.py')) {
        return {
          command: 'python3',
          args: [filePath],
          type: 'python',
          isMCPServer: true,
          originalCommand: `python3 ${filePath}`
        };
      } else if (fileName.endsWith('.js')) {
        return {
          command: 'node',
          args: [filePath],
          type: 'node',
          isMCPServer: true,
          originalCommand: `node ${filePath}`
        };
      } else if (fileName.endsWith('.sh') || (stats.mode & parseInt('111', 8))) {
        // Executable file
        return {
          command: filePath,
          args: [],
          type: 'executable',
          isMCPServer: true,
          originalCommand: filePath
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find any executable file as last resort
   */
  async findAnyExecutable(packageDir) {
    try {
      const entries = await fs.readdir(packageDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(packageDir, entry.name);
          try {
            const stats = await fs.stat(filePath);
            if (stats.mode & parseInt('111', 8)) {
              // This is an executable file
              return {
                command: filePath,
                args: [],
                type: 'executable',
                isMCPServer: true,
                originalCommand: filePath
              };
            }
          } catch (error) {
            continue;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Execute MCP from secure cache with enhanced environment setup
   */
  async executeFromSecureCache(slug, mcp, packageInfo, packageManager, cacheLocation, options = {}) {
    try {
      // 1. Find executable using package manager or complex installation detection
      let execCommand;
      
      if (this.isComplexCommand(mcp.auto_install_command || '') || this.needsGitBranchDiscovery(mcp.auto_install_command || '')) {
        // For complex/enhanced installations, try to find the executable in the installation directory
        execCommand = await this.findExecutableInComplexInstallation(packageInfo, cacheLocation.packageDir, mcp);
      } else {
        execCommand = await packageManager.findExecutable(packageInfo, cacheLocation.packageDir);
      }
      
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
      const isMCPServer = execCommand.isMCPServer || 
                         execCommand.args.some(arg => 
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
      
      console.log(`🔍 Execution result for ${slug}:`, {
        code: result.code,
        mcpServerRunning: result.mcpServerRunning,
        isMCPServer: isMCPServer,
        hasStdout: !!result.stdout,
        hasStderr: !!result.stderr,
        pid: result.pid
      });
      
      // For MCP servers, success is determined differently:
      // - mcpServerRunning === true: Server successfully started (from sandbox detection)
      // - code === 0: Explicit success for regular commands
      // - code === null: Process still running (success for persistent MCP servers)
      const isMCPServerSuccess = result.mcpServerRunning === true || 
                                (isMCPServer && result.code === null) ||
                                (!isMCPServer && result.code === 0);
      
      console.log(`🎯 MCP Server Success Determination: ${isMCPServerSuccess} (isMCPServer: ${isMCPServer})`);

      return {
        success: isMCPServerSuccess,
        command: `${execCommand.command} ${execCommand.args.join(' ')}`,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.code,
        cacheDir: cacheLocation.packageDir,
        version: packageInfo.version,
        packageManager: packageManager.type,
        mcpServerRunning: result.mcpServerRunning || false,
        pid: result.pid
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