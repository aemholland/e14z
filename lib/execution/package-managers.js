/**
 * E14Z Package Manager Abstraction Layer
 * Unified interface for multi-language package management
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { SecureExecutor } = require('./sandbox');

/**
 * Base class for all package managers
 */
class BasePackageManager {
  constructor(options = {}) {
    this.timeout = options.timeout || 120000; // 2 minutes default
    this.enableSecurity = options.enableSecurity !== false;
    this.cacheManager = options.cacheManager;
    
    // Initialize secure executor for all package managers
    this.secureExecutor = new SecureExecutor({
      enableSandboxing: options.enableSandboxing !== false,
      securityLevel: options.securityLevel || 'standard',
      enableResourceLimits: options.enableResourceLimits !== false,
      maxMemory: options.maxMemory,
      maxCpuTime: options.maxCpuTime
    });
  }

  /**
   * Check if this package manager can handle the given MCP
   */
  canHandle(mcp, installMethod) {
    throw new Error('canHandle must be implemented by subclass');
  }

  /**
   * Parse installation command and extract package details
   */
  parseInstallCommand(installMethod) {
    throw new Error('parseInstallCommand must be implemented by subclass');
  }

  /**
   * Install package to cache directory
   */
  async install(packageInfo, cacheDir) {
    throw new Error('install must be implemented by subclass');
  }

  /**
   * Find executable in installed package
   */
  async findExecutable(packageInfo, cacheDir) {
    throw new Error('findExecutable must be implemented by subclass');
  }

  /**
   * Get package metadata for security scanning
   */
  async getPackageMetadata(packageInfo, cacheDir) {
    throw new Error('getPackageMetadata must be implemented by subclass');
  }

  /**
   * Verify package integrity
   */
  async verifyIntegrity(packageInfo, cacheDir) {
    // Default implementation - can be overridden
    return true;
  }

  /**
   * Execute command securely with sandboxing and injection protection
   */
  async executeSecurely(command, args, options = {}) {
    try {
      const result = await this.secureExecutor.execute(command, args, {
        timeout: options.timeout || this.timeout,
        ...options
      });
      
      return {
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        sandboxed: result.sandboxed
      };
    } catch (error) {
      throw new Error(`Secure execution failed: ${error.message}`);
    }
  }

  /**
   * Sanitize package name for security
   */
  sanitizePackageName(name) {
    // Remove potentially dangerous characters
    return name.replace(/[^\w\-\.\/\@]/g, '').substring(0, 200);
  }

  /**
   * Validate package version
   */
  validateVersion(version) {
    // Basic semver-like validation
    return /^[\w\.\-]+$/.test(version) && version.length <= 50;
  }
}

/**
 * NPM Package Manager Implementation
 */
class NPMPackageManager extends BasePackageManager {
  constructor(options = {}) {
    super(options);
    this.type = 'npm';
  }

  canHandle(mcp, installMethod) {
    return installMethod.type === 'npm' || 
           (installMethod.command && installMethod.command.includes('npm')) ||
           (installMethod.command && installMethod.command.startsWith('npx '));
  }

  parseInstallCommand(installMethod) {
    const command = installMethod.command;
    let packageName, version = 'latest';
    let isNpxCommand = false;
    let originalCommand = null;
    
    if (command.startsWith('npx ')) {
      isNpxCommand = true;
      originalCommand = command;
      
      // Handle: npx -y @circleci/mcp-server-circleci or npx @stripe/mcp-server
      const args = command.replace('npx ', '').split(' ');
      
      // Filter out flags (anything starting with -) and find the package name
      const packageArgs = args.filter(arg => !arg.startsWith('-'));
      packageName = packageArgs[0];
      
      if (!packageName) {
        throw new Error(`Cannot extract package name from npx command: ${command}`);
      }
      
      // Extract version if specified (e.g., @stripe/mcp-server@1.2.3)
      if (packageName.includes('@') && !packageName.startsWith('@')) {
        // Regular package with version (e.g., package@1.2.3)
        const versionSplit = packageName.split('@');
        packageName = versionSplit[0];
        version = versionSplit[1];
      } else if (packageName.includes('@') && packageName.startsWith('@')) {
        // Scoped package with version (e.g., @stripe/mcp-server@1.2.3)
        const parts = packageName.split('@');
        if (parts.length > 2) {
          packageName = `@${parts[1]}`;
          version = parts[2];
        }
      }
    } else if (command.includes('npm install ')) {
      // Handle: npm install @stripe/mcp-server
      packageName = command.replace(/.*npm install /, '').split(' ')[0];
      
      if (packageName.includes('@') && !packageName.startsWith('@')) {
        const versionSplit = packageName.split('@');
        packageName = versionSplit[0];
        version = versionSplit[1];
      } else if (packageName.includes('@') && packageName.startsWith('@')) {
        // Scoped package with version (e.g., @stripe/mcp-server@1.2.3)
        const parts = packageName.split('@');
        if (parts.length > 2) {
          packageName = `@${parts[1]}`;
          version = parts[2];
        }
      }
    } else {
      throw new Error(`Cannot parse npm command: ${command}`);
    }

    return {
      name: this.sanitizePackageName(packageName),
      version: this.validateVersion(version) ? version : 'latest',
      registry: 'npm',
      scope: packageName.startsWith('@') ? packageName.split('/')[0] : null,
      isNpxCommand,
      originalCommand
    };
  }

  async install(packageInfo, cacheDir) {
    // For npx commands, we don't need to install locally - just verify the command works
    if (packageInfo.isNpxCommand) {
      console.log(`🚀 Preparing NPX command: ${packageInfo.originalCommand}`);
      
      // Test that npx is available
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const testArgs = ['--help']; // Use --help to test npx without actually running the package
      
      const result = await this.executeSecurely(npx, testArgs, {
        cwd: cacheDir,
        env: { ...process.env },
        timeout: 10000 // Short timeout for testing
      });
      
      if (result.code !== 0) {
        throw new Error(`NPX is not available: ${result.stderr}`);
      }
      
      console.log(`✅ NPX command ready for MCP server: ${packageInfo.originalCommand}`);
      return { 
        code: 0, 
        stdout: 'NPX command prepared for MCP server execution', 
        stderr: '',
        isMCPServer: true 
      };
    }
    
    // Regular npm install for non-npx commands
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const packageSpec = packageInfo.version === 'latest' ? 
      packageInfo.name : `${packageInfo.name}@${packageInfo.version}`;
    
    console.log(`📦 Installing NPM package: ${packageSpec}`);
    
    // Create package.json for clean installation
    const packageJsonPath = path.join(cacheDir, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify({
      name: `e14z-cache-${crypto.randomBytes(4).toString('hex')}`,
      version: '1.0.0',
      private: true,
      dependencies: {}
    }, null, 2));

    const result = await this.executeSecurely(npm, ['install', packageSpec, '--no-save'], {
      cwd: cacheDir,
      env: { 
        ...process.env,
        npm_config_audit: 'false', // Skip audit for faster install
        npm_config_fund: 'false'   // Skip funding messages
      },
      timeout: this.timeout
    });
    
    if (result.code !== 0) {
      throw new Error(`NPM installation failed: ${result.stderr}`);
    }
    
    console.log(`✅ NPM package installed: ${packageSpec}`);
    return result;
  }

  async findExecutable(packageInfo, cacheDir) {
    // For npx commands, return the original command for direct execution
    if (packageInfo.isNpxCommand && packageInfo.originalCommand) {
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      // Parse the original command to extract args
      const commandParts = packageInfo.originalCommand.split(' ');
      const npxArgs = commandParts.slice(1); // Remove 'npx' from the beginning
      
      return {
        command: npx,
        args: npxArgs,
        type: 'npx',
        originalCommand: packageInfo.originalCommand,
        isMCPServer: true // Mark as MCP server for special handling
      };
    }
    
    // Regular executable finding for locally installed packages
    const binDir = path.join(cacheDir, 'node_modules', '.bin');
    const nodeModulesDir = path.join(cacheDir, 'node_modules');
    
    try {
      // 1. Check for executables in .bin directory
      const binFiles = await fs.readdir(binDir).catch(() => []);
      
      // Look for exact package name or common variations
      const packageBaseName = packageInfo.name.split('/').pop(); // Remove scope
      const candidates = [
        packageBaseName,
        packageBaseName.replace(/-/g, ''),
        packageBaseName.replace(/mcp-?/g, ''),
        ...binFiles.filter(f => f.includes('mcp') || f.includes(packageBaseName))
      ];
      
      for (const candidate of candidates) {
        if (binFiles.includes(candidate)) {
          const execPath = path.join(binDir, candidate);
          const stats = await fs.stat(execPath);
          if (stats.isFile()) {
            return {
              command: execPath,
              args: [],
              type: 'binary'
            };
          }
        }
      }
      
      // 2. Check package.json bin field
      const packagePath = path.join(nodeModulesDir, packageInfo.name);
      const packageJsonPath = path.join(packagePath, 'package.json');
      
      try {
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);
        
        if (packageJson.bin) {
          let binPath;
          if (typeof packageJson.bin === 'string') {
            binPath = packageJson.bin;
          } else {
            // Use first bin entry or one matching package name
            const binName = Object.keys(packageJson.bin)[0];
            binPath = packageJson.bin[binName];
          }
          
          const fullBinPath = path.join(packagePath, binPath);
          return {
            command: 'node',
            args: [fullBinPath],
            type: 'node'
          };
        }
        
        // 3. Fallback to main entry point
        if (packageJson.main) {
          const mainPath = path.join(packagePath, packageJson.main);
          return {
            command: 'node',
            args: [mainPath],
            type: 'node'
          };
        }
      } catch (error) {
        // Package.json not found or invalid
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to find executable for ${packageInfo.name}:`, error.message);
      return null;
    }
  }

  async getPackageMetadata(packageInfo, cacheDir) {
    try {
      const packagePath = path.join(cacheDir, 'node_modules', packageInfo.name);
      const packageJsonPath = path.join(packagePath, 'package.json');
      
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      
      // Calculate package size
      const stats = await fs.stat(packagePath);
      const size = await this.calculateDirectorySize(packagePath);
      
      return {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        author: packageJson.author,
        repository: packageJson.repository,
        scripts: packageJson.scripts,
        dependencies: packageJson.dependencies,
        size: size,
        license: packageJson.license,
        homepage: packageJson.homepage
      };
    } catch (error) {
      return {
        name: packageInfo.name,
        version: packageInfo.version,
        error: `Failed to read package metadata: ${error.message}`
      };
    }
  }

  async calculateDirectorySize(directory) {
    let totalSize = 0;
    
    const calculateSize = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await calculateSize(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          }
        }
      } catch (error) {
        // Directory might not be accessible
      }
    };
    
    await calculateSize(directory);
    return totalSize;
  }
}

/**
 * Python/Pip Package Manager Implementation
 */
class PipPackageManager extends BasePackageManager {
  constructor(options = {}) {
    super(options);
    this.type = 'pip';
  }

  canHandle(mcp, installMethod) {
    return installMethod.type === 'pip' || 
           (installMethod.command && installMethod.command.includes('pip'));
  }

  parseInstallCommand(installMethod) {
    const command = installMethod.command;
    let packageName, version = 'latest';
    
    if (command.includes('pip install ')) {
      // Handle: pip install anthropic-mcp-server
      packageName = command.replace(/.*pip install /, '').split(' ')[0];
      
      if (packageName.includes('==')) {
        const parts = packageName.split('==');
        packageName = parts[0];
        version = parts[1];
      } else if (packageName.includes('>=')) {
        const parts = packageName.split('>=');
        packageName = parts[0];
        version = parts[1];
      }
    } else {
      throw new Error(`Cannot parse pip command: ${command}`);
    }

    return {
      name: this.sanitizePackageName(packageName),
      version: this.validateVersion(version) ? version : 'latest',
      registry: 'pypi'
    };
  }

  async install(packageInfo, cacheDir) {
    const python = process.platform === 'win32' ? 'python.exe' : 'python3';
    const packageSpec = packageInfo.version === 'latest' ? 
      packageInfo.name : `${packageInfo.name}==${packageInfo.version}`;
    
    console.log(`🐍 Installing Python package: ${packageSpec}`);
    
    // Install to local directory
    const result = await this.executeSecurely(python, [
      '-m', 'pip', 'install', 
      '--target', cacheDir,
      '--no-cache-dir',
      '--no-deps', // Avoid dependency conflicts 
      packageSpec
    ], {
      cwd: cacheDir,
      env: { ...process.env },
      timeout: this.timeout
    });
    
    if (result.code !== 0) {
      throw new Error(`Pip installation failed: ${result.stderr}`);
    }
    
    console.log(`✅ Python package installed: ${packageSpec}`);
    return result;
  }

  async findExecutable(packageInfo, cacheDir) {
    // Python packages typically expose console scripts
    // For now, return a generic python execution command
    // TODO: Implement proper console script detection
    
    const packagePath = path.join(cacheDir, packageInfo.name);
    const mainModule = path.join(packagePath, '__main__.py');
    
    try {
      await fs.access(mainModule);
      return {
        command: process.platform === 'win32' ? 'python.exe' : 'python3',
        args: ['-m', packageInfo.name],
        type: 'python',
        env: { PYTHONPATH: cacheDir }
      };
    } catch (error) {
      // Fallback to direct module execution
      return {
        command: process.platform === 'win32' ? 'python.exe' : 'python3',
        args: ['-c', `import ${packageInfo.name}; ${packageInfo.name}.main()`],
        type: 'python',
        env: { PYTHONPATH: cacheDir }
      };
    }
  }

  async getPackageMetadata(packageInfo, cacheDir) {
    // TODO: Implement Python package metadata extraction
    return {
      name: packageInfo.name,
      version: packageInfo.version,
      registry: 'pypi'
    };
  }
}

/**
 * Git Repository Package Manager Implementation
 */
class GitPackageManager extends BasePackageManager {
  constructor(options = {}) {
    super(options);
    this.type = 'git';
  }

  canHandle(mcp, installMethod) {
    return installMethod.type === 'git' || 
           (installMethod.command && installMethod.command.includes('git clone'));
  }

  parseInstallCommand(installMethod) {
    const command = installMethod.command;
    let repositoryUrl, branch = 'main';
    
    if (command.includes('git clone ')) {
      // Handle: git clone https://github.com/user/repo.git
      const parts = command.replace(/.*git clone /, '').split(' ');
      repositoryUrl = parts[0];
      
      if (command.includes(' -b ')) {
        const branchIndex = parts.indexOf('-b');
        if (branchIndex >= 0 && branchIndex + 1 < parts.length) {
          branch = parts[branchIndex + 1];
        }
      }
    } else {
      throw new Error(`Cannot parse git command: ${command}`);
    }

    // Extract repo name from URL
    const repoName = repositoryUrl.split('/').pop().replace('.git', '');

    return {
      name: this.sanitizePackageName(repoName),
      repositoryUrl,
      branch,
      registry: 'git'
    };
  }

  async install(packageInfo, cacheDir) {
    console.log(`📥 Cloning Git repository: ${packageInfo.repositoryUrl}`);
    
    const result = await this.executeSecurely('git', [
      'clone', 
      '--depth', '1',
      '--branch', packageInfo.branch,
      packageInfo.repositoryUrl,
      'repo'
    ], {
      cwd: cacheDir,
      env: { ...process.env },
      timeout: this.timeout
    });
    
    if (result.code !== 0) {
      throw new Error(`Git clone failed: ${result.stderr}`);
    }
    
    // Check for additional setup steps (npm install, pip install, etc.)
    const repoDir = path.join(cacheDir, 'repo');
    await this.runSetupCommands(repoDir);
    
    console.log(`✅ Git repository cloned: ${packageInfo.name}`);
    return result;
  }

  async runSetupCommands(repoDir) {
    // Check for package.json and run npm install
    try {
      await fs.access(path.join(repoDir, 'package.json'));
      console.log('📦 Running npm install for cloned repository...');
      
      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      await this.executeSecurely(npm, ['install'], {
        cwd: repoDir,
        timeout: this.timeout
      });
    } catch (error) {
      // No package.json or npm install failed
    }
    
    // Check for requirements.txt and run pip install
    try {
      await fs.access(path.join(repoDir, 'requirements.txt'));
      console.log('🐍 Running pip install for cloned repository...');
      
      const python = process.platform === 'win32' ? 'python.exe' : 'python3';
      await this.executeSecurely(python, ['-m', 'pip', 'install', '-r', 'requirements.txt'], {
        cwd: repoDir,
        timeout: this.timeout
      });
    } catch (error) {
      // No requirements.txt or pip install failed
    }
  }

  async findExecutable(packageInfo, cacheDir) {
    const repoDir = path.join(cacheDir, 'repo');
    
    // First, check package.json for proper executable info
    try {
      const packageJsonPath = path.join(repoDir, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      
      // Check for bin field first
      if (packageJson.bin) {
        let binPath;
        if (typeof packageJson.bin === 'string') {
          binPath = packageJson.bin;
        } else {
          const binName = Object.keys(packageJson.bin)[0];
          binPath = packageJson.bin[binName];
        }
        
        const fullBinPath = path.join(repoDir, binPath);
        return {
          command: 'node',
          args: [fullBinPath],
          type: 'node',
          isMCPServer: true
        };
      }
      
      // Check for main field
      if (packageJson.main) {
        const mainPath = path.join(repoDir, packageJson.main);
        return {
          command: 'node',
          args: [mainPath],
          type: 'node',
          isMCPServer: true
        };
      }
      
      // Check for scripts that might be MCP servers
      if (packageJson.scripts) {
        for (const [scriptName, scriptCommand] of Object.entries(packageJson.scripts)) {
          if (scriptName.includes('start') || scriptName.includes('mcp') || scriptName.includes('server')) {
            // Try to parse npm script command
            if (scriptCommand.startsWith('node ')) {
              const scriptPath = scriptCommand.replace('node ', '').split(' ')[0];
              const fullScriptPath = path.join(repoDir, scriptPath);
              return {
                command: 'node',
                args: [fullScriptPath],
                type: 'node',
                isMCPServer: true
              };
            }
          }
        }
      }
    } catch (error) {
      // No package.json or parsing failed, continue with file search
    }
    
    // Look for common executable patterns
    const candidates = [
      path.join(repoDir, 'bin', packageInfo.name),
      path.join(repoDir, 'src', 'main.js'),
      path.join(repoDir, 'src', 'index.js'),
      path.join(repoDir, 'lib', 'main.js'),
      path.join(repoDir, 'lib', 'index.js'),
      path.join(repoDir, 'main.js'),
      path.join(repoDir, 'index.js'),
      path.join(repoDir, 'server.js'),
      path.join(repoDir, 'app.js'),
      path.join(repoDir, 'main.py'),
      path.join(repoDir, '__main__.py')
    ];
    
    for (const candidate of candidates) {
      try {
        const stats = await fs.stat(candidate);
        if (stats.isFile()) {
          const ext = path.extname(candidate);
          if (ext === '.js') {
            return {
              command: 'node',
              args: [candidate],
              type: 'node',
              isMCPServer: true
            };
          } else if (ext === '.py') {
            return {
              command: process.platform === 'win32' ? 'python.exe' : 'python3',
              args: [candidate],
              type: 'python',
              isMCPServer: true
            };
          } else {
            return {
              command: candidate,
              args: [],
              type: 'binary',
              isMCPServer: true
            };
          }
        }
      } catch (error) {
        // File doesn't exist, continue
      }
    }
    
    return null;
  }

  async getPackageMetadata(packageInfo, cacheDir) {
    const repoDir = path.join(cacheDir, 'repo');
    
    try {
      // Try to read package.json
      const packageJsonPath = path.join(repoDir, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      
      return {
        name: packageJson.name || packageInfo.name,
        version: packageJson.version || 'unknown',
        description: packageJson.description,
        repository: packageInfo.repositoryUrl,
        registry: 'git'
      };
    } catch (error) {
      // Fallback to basic info
      return {
        name: packageInfo.name,
        repository: packageInfo.repositoryUrl,
        branch: packageInfo.branch,
        registry: 'git'
      };
    }
  }
}

/**
 * Docker Package Manager Implementation  
 */
class DockerPackageManager extends BasePackageManager {
  constructor(options = {}) {
    super(options);
    this.type = 'docker';
  }

  canHandle(mcp, installMethod) {
    return installMethod.type === 'docker' || 
           (installMethod.command && installMethod.command.startsWith('docker '));
  }

  parseInstallCommand(installMethod) {
    const command = installMethod.command;
    
    // Extract image name from docker command
    let imageName = 'unknown';
    if (command.includes('docker run')) {
      const runIndex = command.indexOf('docker run');
      const afterRun = command.substring(runIndex + 10).trim();
      const parts = afterRun.split(' ');
      
      // Find the image name (last non-flag argument before container commands)
      for (let i = parts.length - 1; i >= 0; i--) {
        if (!parts[i].startsWith('-') && !parts[i].includes('=')) {
          imageName = parts[i];
          break;
        }
      }
    } else if (command.includes('docker build')) {
      imageName = 'custom-build';
    }

    return {
      name: this.sanitizePackageName(imageName),
      command: command,
      registry: 'docker',
      originalCommand: command
    };
  }

  async install(packageInfo, cacheDir) {
    console.log(`🐳 Preparing Docker command: ${packageInfo.command}`);
    
    // For Docker commands, we don't need to install anything locally
    // Just verify Docker is available
    try {
      const result = await this.executeSecurely('docker', ['--version'], {
        cwd: cacheDir,
        timeout: 10000
      });
      
      if (result.code !== 0) {
        throw new Error('Docker is not available or not running');
      }
      
      console.log(`✅ Docker command ready: ${packageInfo.command}`);
      return { 
        code: 0, 
        stdout: 'Docker command prepared for execution', 
        stderr: '',
        isDockerCommand: true 
      };
    } catch (error) {
      throw new Error(`Docker verification failed: ${error.message}`);
    }
  }

  async findExecutable(packageInfo, cacheDir) {
    // For Docker commands, return the original command for direct execution
    if (packageInfo.originalCommand || packageInfo.command) {
      const dockerCommand = packageInfo.originalCommand || packageInfo.command;
      const commandParts = dockerCommand.split(' ');
      
      return {
        command: 'docker',
        args: commandParts.slice(1), // Remove 'docker' from the beginning
        type: 'docker',
        originalCommand: dockerCommand,
        isMCPServer: true // Most Docker MCPs are servers
      };
    }
    
    return null;
  }

  async getPackageMetadata(packageInfo, cacheDir) {
    return {
      name: packageInfo.name,
      command: packageInfo.command,
      registry: 'docker',
      type: 'docker-container'
    };
  }
}

/**
 * Package Manager Factory
 */
class PackageManagerFactory {
  constructor(options = {}) {
    this.managers = [
      new NPMPackageManager(options),
      new PipPackageManager(options),
      new GitPackageManager(options),
      new DockerPackageManager(options)
    ];
  }

  /**
   * Get appropriate package manager for MCP installation method
   */
  getManager(mcp, installMethod) {
    for (const manager of this.managers) {
      if (manager.canHandle(mcp, installMethod)) {
        return manager;
      }
    }
    
    throw new Error(`No package manager available for installation method: ${installMethod.type || 'unknown'}`);
  }

  /**
   * List all available package managers
   */
  getAvailableManagers() {
    return this.managers.map(m => ({
      type: m.type,
      name: m.constructor.name
    }));
  }
}

module.exports = {
  BasePackageManager,
  NPMPackageManager,
  PipPackageManager,
  GitPackageManager,
  DockerPackageManager,
  PackageManagerFactory
};