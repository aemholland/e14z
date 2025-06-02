/**
 * E14Z Sandboxing and Command Injection Protection
 * Implements secure execution environment with multiple layers of protection
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

/**
 * Command injection protection utilities
 */
class CommandSanitizer {
  constructor() {
    // Dangerous characters that should be escaped or blocked
    this.dangerousChars = [';', '&', '|', '`', '$', '(', ')', '<', '>', '\n', '\r'];
    this.dangerousPatterns = [
      /\$\(/g,          // Command substitution
      /`[^`]*`/g,       // Backtick execution
      /&&/g,            // Command chaining
      /\|\|/g,          // OR command chaining
      /;/g,             // Command separator
      />/g,             // Output redirection
      /</g,             // Input redirection
      /\|/g,            // Pipe
      /\bexec\b/gi,     // Exec calls
      /\beval\b/gi,     // Eval calls
      /\brm\s+-rf\b/gi, // Dangerous deletions
      /\bsudo\b/gi,     // Privilege escalation
      /\bsu\b/gi,       // User switching
    ];
  }

  /**
   * Sanitize command arguments to prevent injection
   */
  sanitizeArgs(args) {
    if (!Array.isArray(args)) {
      throw new Error('Arguments must be an array');
    }

    return args.map(arg => {
      if (typeof arg !== 'string') {
        throw new Error('All arguments must be strings');
      }

      // Check for dangerous patterns
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(arg)) {
          throw new Error(`Dangerous pattern detected in argument: ${arg}`);
        }
      }

      // Check for dangerous characters
      for (const char of this.dangerousChars) {
        if (arg.includes(char)) {
          throw new Error(`Dangerous character '${char}' detected in argument: ${arg}`);
        }
      }

      // Validate length (prevent buffer overflow attempts)
      if (arg.length > 10000) {
        throw new Error(`Argument too long (max 10000 chars): ${arg.substring(0, 100)}...`);
      }

      return arg;
    });
  }

  /**
   * Sanitize command path to prevent path traversal and ensure it's executable
   */
  sanitizeCommand(command) {
    if (typeof command !== 'string') {
      throw new Error('Command must be a string');
    }

    // Check for path traversal attempts
    if (command.includes('..') || command.includes('~')) {
      throw new Error(`Path traversal detected in command: ${command}`);
    }

    // Check for dangerous patterns in command itself
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Dangerous pattern detected in command: ${command}`);
      }
    }

    // Ensure command is not trying to execute shell interpreters directly
    const dangerousCommands = ['sh', 'bash', 'zsh', 'fish', 'cmd', 'powershell', 'eval', 'exec'];
    const commandBaseName = path.basename(command).toLowerCase();
    
    if (dangerousCommands.includes(commandBaseName)) {
      throw new Error(`Direct shell execution not allowed: ${command}`);
    }

    return command;
  }

  /**
   * Sanitize environment variables
   */
  sanitizeEnvironment(env) {
    const sanitizedEnv = {};
    
    // Dangerous environment variables that should be filtered
    const dangerousEnvVars = [
      'LD_PRELOAD',     // Library preloading
      'LD_LIBRARY_PATH', // Library path manipulation
      'DYLD_INSERT_LIBRARIES', // macOS library injection
      'DYLD_LIBRARY_PATH',     // macOS library path
      'IFS',            // Input field separator manipulation
      'PS4',            // Shell debug prompt
      'BASH_ENV',       // Bash environment file
      'ENV',            // Environment file
      'FPATH',          // Function path
      'PERL5LIB',       // Perl library path
      'PYTHONPATH',     // Python path (we'll handle this separately)
      'RUBYLIB',        // Ruby library path
    ];

    // Safe environment variables to preserve
    const safeEnvVars = [
      'PATH', 'HOME', 'USER', 'USERNAME', 'LOGNAME', 'SHELL', 'TERM', 'LANG', 'LC_ALL',
      'TZ', 'PWD', 'TMPDIR', 'TEMP', 'TMP', 'NODE_ENV', 'npm_config_cache'
    ];

    for (const [key, value] of Object.entries(env || {})) {
      // Skip dangerous environment variables
      if (dangerousEnvVars.includes(key)) {
        console.warn(`⚠️  Filtered dangerous environment variable: ${key}`);
        continue;
      }

      // Validate key
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        console.warn(`⚠️  Invalid environment variable name: ${key}`);
        continue;
      }

      // Validate value
      if (typeof value !== 'string') {
        console.warn(`⚠️  Environment variable value must be string: ${key}`);
        continue;
      }

      // Check for injection attempts in values
      let hasInjection = false;
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(value)) {
          console.warn(`⚠️  Dangerous pattern in environment variable ${key}: ${value}`);
          hasInjection = true;
          break;
        }
      }

      if (!hasInjection) {
        sanitizedEnv[key] = value;
      }
    }

    // Ensure safe defaults are present
    for (const safeVar of safeEnvVars) {
      if (!sanitizedEnv[safeVar] && process.env[safeVar]) {
        sanitizedEnv[safeVar] = process.env[safeVar];
      }
    }

    return sanitizedEnv;
  }
}

/**
 * Process sandboxing and resource limits
 */
class ProcessSandbox {
  constructor(options = {}) {
    this.enableResourceLimits = options.enableResourceLimits !== false;
    this.enableNetworkIsolation = options.enableNetworkIsolation || false;
    this.enableFileSystemIsolation = options.enableFileSystemIsolation || false;
    this.maxMemory = options.maxMemory || 512 * 1024 * 1024; // 512MB
    this.maxCpuTime = options.maxCpuTime || 60 * 1000; // 60 seconds
    this.allowedPaths = options.allowedPaths || [];
    this.sanitizer = new CommandSanitizer();
  }

  /**
   * Detect if the command is a long-running MCP server process
   */
  detectMCPServer(command, args) {
    // Check command name patterns
    const commandName = path.basename(command).toLowerCase();
    if (commandName.includes('mcp') || commandName === 'npx' || commandName === 'npx.cmd') {
      // Check arguments for MCP patterns
      const allArgs = args.join(' ').toLowerCase();
      if (allArgs.includes('mcp') || 
          allArgs.includes('server') || 
          allArgs.includes('@notionhq') ||
          allArgs.includes('@stripe') ||
          allArgs.includes('@anthropic') ||
          allArgs.includes('notion-mcp-server') ||
          allArgs.includes('mcp-server')) {
        return true;
      }
    }
    
    // Check for specific MCP server patterns
    const mcpPatterns = [
      /mcp-server/i,
      /notion-mcp/i,
      /stripe.*mcp/i,
      /@\w+\/mcp/i,
      /mcp.*server/i
    ];
    
    const fullCommand = `${command} ${args.join(' ')}`;
    return mcpPatterns.some(pattern => pattern.test(fullCommand));
  }

  /**
   * Execute command in sandbox with security restrictions
   */
  async executeInSandbox(command, args, options = {}) {
    // 1. Sanitize inputs
    const sanitizedCommand = this.sanitizer.sanitizeCommand(command);
    const sanitizedArgs = this.sanitizer.sanitizeArgs(args || []);
    const sanitizedEnv = this.sanitizer.sanitizeEnvironment(options.env);

    // 2. Detect if this is a long-running MCP server process
    const isMCPServer = this.detectMCPServer(command, sanitizedArgs);
    
    // 3. Set up sandbox options
    const sandboxOptions = {
      stdio: options.stdio || 'pipe',
      cwd: options.cwd || process.cwd(),
      env: sanitizedEnv,
      timeout: isMCPServer ? 0 : Math.min(options.timeout || 30000, this.maxCpuTime), // No timeout for MCP servers
      killSignal: 'SIGKILL',
      windowsHide: true, // Hide window on Windows
      shell: false,      // Never use shell
      isMCPServer: isMCPServer,
      ...this.getResourceLimits(),
      ...this.getSecurityOptions()
    };

    // 4. Validate working directory
    await this.validateWorkingDirectory(sandboxOptions.cwd);

    // 5. Execute with monitoring
    return await this.executeWithMonitoring(sanitizedCommand, sanitizedArgs, sandboxOptions);
  }

  /**
   * Get resource limit options for spawn
   */
  getResourceLimits() {
    const limits = {};

    if (this.enableResourceLimits && process.platform !== 'win32') {
      // Unix-like systems support ulimit-style restrictions
      limits.uid = process.getuid ? process.getuid() : undefined;
      limits.gid = process.getgid ? process.getgid() : undefined;
      
      // Note: Node.js doesn't directly support memory/CPU limits via spawn options
      // These would need to be implemented via ulimit or cgroups externally
    }

    return limits;
  }

  /**
   * Get security options for process isolation
   */
  getSecurityOptions() {
    const securityOptions = {};

    if (process.platform === 'linux') {
      // Linux-specific security options
      if (this.enableNetworkIsolation) {
        // Note: Network namespaces would require external tools like unshare
        console.log('🔒 Network isolation requested (requires external tools)');
      }

      if (this.enableFileSystemIsolation) {
        // Note: File system namespaces would require external tools
        console.log('🔒 File system isolation requested (requires external tools)');
      }
    }

    return securityOptions;
  }

  /**
   * Validate that working directory is safe
   */
  async validateWorkingDirectory(cwd) {
    try {
      // Check if directory exists and is accessible
      const stats = await fs.stat(cwd);
      if (!stats.isDirectory()) {
        throw new Error(`Working directory is not a directory: ${cwd}`);
      }

      // Check for path traversal attempts
      const resolvedCwd = path.resolve(cwd);
      if (resolvedCwd !== cwd && !cwd.startsWith(resolvedCwd)) {
        throw new Error(`Suspicious working directory path: ${cwd}`);
      }

      // Check against allowed paths if configured
      if (this.allowedPaths.length > 0) {
        const isAllowed = this.allowedPaths.some(allowedPath => 
          resolvedCwd.startsWith(path.resolve(allowedPath))
        );
        
        if (!isAllowed) {
          throw new Error(`Working directory not in allowed paths: ${cwd}`);
        }
      }

    } catch (error) {
      throw new Error(`Invalid working directory: ${error.message}`);
    }
  }

  /**
   * Execute process with resource monitoring
   */
  async executeWithMonitoring(command, args, options) {
    return new Promise((resolve, reject) => {
      console.log(`🔒 Executing in sandbox: ${command} ${args.join(' ')}`);
      
      const startTime = Date.now();
      let memoryPeak = 0;
      
      const child = spawn(command, args, options);
      
      let stdout = '';
      let stderr = '';
      
      // Collect output
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

      // Monitor resource usage (basic implementation)
      const monitor = setInterval(() => {
        try {
          if (child.pid) {
            // Note: More sophisticated monitoring would use tools like pidstat
            const memoryUsage = process.memoryUsage();
            memoryPeak = Math.max(memoryPeak, memoryUsage.rss);
            
            // Check memory limits (basic check)
            if (this.enableResourceLimits && memoryUsage.rss > this.maxMemory) {
              console.warn(`⚠️  Memory limit exceeded: ${memoryUsage.rss} > ${this.maxMemory}`);
              child.kill('SIGKILL');
            }
          }
        } catch (error) {
          // Process might have exited
        }
      }, 1000);

      // Handle process completion
      child.on('close', (code, signal) => {
        clearInterval(monitor);
        
        const duration = Date.now() - startTime;
        const result = {
          code,
          signal,
          stdout,
          stderr,
          duration,
          memoryPeak,
          sandboxed: true
        };
        
        console.log(`🔒 Sandbox execution completed: code=${code}, duration=${duration}ms`);
        resolve(result);
      });

      child.on('error', (error) => {
        clearInterval(monitor);
        console.error(`🔒 Sandbox execution error: ${error.message}`);
        reject(error);
      });

      // Handle timeout (only for non-MCP servers)
      if (options.timeout && !options.isMCPServer) {
        setTimeout(() => {
          if (!child.killed) {
            console.warn(`⚠️  Process timeout, killing: ${command}`);
            child.kill('SIGKILL');
          }
        }, options.timeout);
      } else if (options.isMCPServer) {
        // For MCP servers, we detect startup completion and return early
        this.handleMCPServerStartup(child, resolve, reject, {
          command,
          args,
          startTime,
          monitor
        });
      }
    });
  }

  /**
   * Handle MCP server startup - detect when it's ready and return success
   */
  handleMCPServerStartup(child, resolve, reject, context) {
    const { command, args, startTime, monitor } = context;
    let outputBuffer = '';
    let hasStarted = false;
    
    // MCP servers typically start quickly and then listen for input
    // We detect startup by looking for specific patterns or waiting for a short period
    const startupTimeout = setTimeout(() => {
      if (!hasStarted && !child.killed) {
        hasStarted = true;
        clearInterval(monitor);
        
        // MCP server is considered successfully started if it's still running
        const duration = Date.now() - startTime;
        console.log(`🔒 MCP Server startup detected: running for ${duration}ms`);
        
        resolve({
          code: 0, // Success - server is running
          signal: null,
          stdout: outputBuffer,
          stderr: '',
          duration,
          memoryPeak: 0,
          sandboxed: true,
          mcpServerRunning: true,
          pid: child.pid
        });
      }
    }, 3000); // Wait 3 seconds for startup

    // Monitor output for startup indicators
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        outputBuffer += data.toString();
        
        // Look for MCP server startup patterns
        const output = outputBuffer.toLowerCase();
        if ((output.includes('server') && output.includes('start')) ||
            output.includes('listening') ||
            output.includes('ready') ||
            output.includes('initialized') ||
            outputBuffer.length > 100) { // Or if we get substantial output
          
          if (!hasStarted) {
            hasStarted = true;
            clearTimeout(startupTimeout);
            clearInterval(monitor);
            
            const duration = Date.now() - startTime;
            console.log(`🔒 MCP Server startup confirmed: ${duration}ms`);
            
            resolve({
              code: 0, // Success
              signal: null,
              stdout: outputBuffer,
              stderr: '',
              duration,
              memoryPeak: 0,
              sandboxed: true,
              mcpServerRunning: true,
              pid: child.pid
            });
          }
        }
      });
    }

    // If the process exits early, it's an error
    child.on('close', (code, signal) => {
      if (!hasStarted) {
        clearTimeout(startupTimeout);
        clearInterval(monitor);
        
        const duration = Date.now() - startTime;
        console.log(`🔒 MCP Server exited early: code=${code}, duration=${duration}ms`);
        
        resolve({
          code: code || 1,
          signal,
          stdout: outputBuffer,
          stderr: '',
          duration,
          memoryPeak: 0,
          sandboxed: true,
          mcpServerRunning: false
        });
      }
    });

    child.on('error', (error) => {
      if (!hasStarted) {
        clearTimeout(startupTimeout);
        clearInterval(monitor);
        console.error(`🔒 MCP Server startup error: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Create isolated temporary directory for execution
   */
  async createIsolatedTempDir(prefix = 'e14z-sandbox-') {
    const tempDir = path.join(os.tmpdir(), prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    
    await fs.mkdir(tempDir, { mode: 0o700 });
    
    // Set restrictive permissions
    if (process.platform !== 'win32') {
      await fs.chmod(tempDir, 0o700);
    }

    return tempDir;
  }

  /**
   * Clean up isolated temporary directory
   */
  async cleanupIsolatedTempDir(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up isolated temp directory: ${tempDir}`);
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${tempDir}: ${error.message}`);
    }
  }
}

/**
 * High-level secure execution wrapper
 */
class SecureExecutor {
  constructor(options = {}) {
    this.sandbox = new ProcessSandbox(options);
    this.enableSandboxing = options.enableSandboxing !== false;
    this.securityLevel = options.securityLevel || 'standard'; // 'minimal', 'standard', 'strict'
  }

  /**
   * Execute command with appropriate security level
   */
  async execute(command, args, options = {}) {
    if (!this.enableSandboxing || this.securityLevel === 'minimal') {
      // Basic sanitization only
      const sanitizer = new CommandSanitizer();
      const sanitizedCommand = sanitizer.sanitizeCommand(command);
      const sanitizedArgs = sanitizer.sanitizeArgs(args || []);
      const sanitizedEnv = sanitizer.sanitizeEnvironment(options.env);
      
      return await this.basicExecute(sanitizedCommand, sanitizedArgs, {
        ...options,
        env: sanitizedEnv
      });
    } else {
      // Full sandboxing
      return await this.sandbox.executeInSandbox(command, args, options);
    }
  }

  /**
   * Basic execution without full sandboxing
   */
  async basicExecute(command, args, options) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        shell: false,
        ...options
      });
      
      let stdout = '';
      let stderr = '';
      
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }
      
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        resolve({ code, stdout, stderr, sandboxed: false });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }
}

module.exports = {
  CommandSanitizer,
  ProcessSandbox,
  SecureExecutor
};