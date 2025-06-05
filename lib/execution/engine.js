/**
 * E14Z Execution Engine - Secure MCP execution with authentication detection
 * Implements security best practices and CVE-2024-27980 mitigations
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { which } = require('which');
const semver = require('semver');

class ExecutionEngine {
  constructor(options = {}) {
    this.baseUrl = options.apiUrl || process.env.E14Z_API_URL || 'https://www.e14z.com';
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 2;
  }

  /**
   * Validate and sanitize MCP slug for security
   */
  validateSlug(slug) {
    // Allow npm package format: @scope/package-name, hyphens, underscores, dots
    if (!/^[@a-zA-Z0-9_.\/-]+$/.test(slug)) {
      throw new Error(`Invalid MCP slug: ${slug}. Only alphanumeric, @, /, -, _, and . allowed.`);
    }
    
    // Prevent path traversal but allow forward slashes for npm scoped packages
    if (slug.includes('..') || slug.includes('\\')) {
      throw new Error(`Invalid MCP slug: ${slug}. Path traversal not allowed.`);
    }
    
    return slug;
  }

  /**
   * Fetch MCP details with clean command
   */
  async getMCPDetails(slug) {
    const validSlug = this.validateSlug(slug);
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${this.baseUrl}/api/mcp/${validSlug}`, {
        timeout: 10000,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch MCP details: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`MCP not found: ${data.error}`);
      }

      return data.mcp;
    } catch (error) {
      throw new Error(`Failed to get MCP details: ${error.message}`);
    }
  }

  /**
   * Parse and validate clean command for security
   */
  parseCleanCommand(cleanCommand) {
    if (!cleanCommand || typeof cleanCommand !== 'string') {
      throw new Error('MCP has no clean command defined');
    }

    // Split command safely
    const parts = cleanCommand.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    // Validate command doesn't contain dangerous characters
    if (/[;&|<>$`\\]/.test(command)) {
      throw new Error(`Unsafe command detected: ${command}`);
    }

    // Validate arguments don't contain injection attempts
    for (const arg of args) {
      if (/[;&|<>$`\\]/.test(arg)) {
        throw new Error(`Unsafe argument detected: ${arg}`);
      }
    }

    return { command, args };
  }

  /**
   * Check if command is available and get full path
   */
  async resolveCommand(command) {
    try {
      // Use which to get full path - prevents PATH manipulation attacks
      const fullPath = await which(command);
      return fullPath;
    } catch (error) {
      throw new Error(`Command not found: ${command}. Please install it first.`);
    }
  }

  /**
   * Detect authentication requirements
   */
  detectAuthRequirements(mcp) {
    const authMethod = mcp.auth_method;
    
    if (!authMethod || authMethod === 'none') {
      return { required: false, type: 'none' };
    }

    const requirements = {
      required: true,
      type: authMethod,
      instructions: []
    };

    switch (authMethod) {
      case 'api_key':
        requirements.instructions.push('This MCP requires an API key');
        requirements.instructions.push('Set the required environment variable before running');
        break;
      case 'oauth':
        requirements.instructions.push('This MCP requires OAuth authentication');
        requirements.instructions.push('You may need to authenticate in a browser');
        break;
      case 'credentials':
        requirements.instructions.push('This MCP requires credentials or connection strings');
        requirements.instructions.push('Set the required environment variables');
        break;
      default:
        requirements.instructions.push(`This MCP requires authentication: ${authMethod}`);
    }

    return requirements;
  }

  /**
   * Execute MCP with security checks
   */
  async executeMCP(slug, options = {}) {
    const validSlug = this.validateSlug(slug);
    
    try {
      // Get MCP details
      const mcp = await this.getMCPDetails(validSlug);
      
      if (!mcp.clean_command) {
        throw new Error(`MCP ${validSlug} is not configured for direct execution. Use 'e14z discover ${validSlug}' for setup instructions.`);
      }

      // Check authentication requirements
      const authReqs = this.detectAuthRequirements(mcp);
      if (authReqs.required && !options.skipAuthCheck) {
        return {
          success: false,
          authRequired: true,
          authType: authReqs.type,
          instructions: authReqs.instructions,
          mcp: mcp
        };
      }

      // Parse and validate command
      const { command, args } = this.parseCleanCommand(mcp.clean_command);
      
      // Resolve command to full path
      const commandPath = await this.resolveCommand(command);
      
      // Prepare execution environment
      const env = { 
        ...process.env,
        // Security: Remove dangerous environment variables
        SHELL: undefined,
        PATH: process.env.PATH, // Keep PATH but don't allow override
      };

      // Execute with spawn for security (not exec/execSync)
      const result = await this.spawnCommand(commandPath, args, {
        env,
        timeout: this.timeout,
        stdio: options.stdio || 'pipe'
      });

      return {
        success: true,
        command: mcp.clean_command,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.code,
        mcp: mcp
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        mcp: null
      };
    }
  }

  /**
   * Secure spawn wrapper with timeout
   */
  async spawnCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: options.stdio || 'pipe',
        env: options.env || process.env,
        cwd: process.cwd(),
        // Security options
        detached: false,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      // Set timeout
      const timeout = setTimeout(() => {
        isTimedOut = true;
        child.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, options.timeout || this.timeout);

      // Collect output
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

      child.on('close', (code, signal) => {
        clearTimeout(timeout);
        
        if (isTimedOut) {
          reject(new Error(`Command timed out after ${options.timeout || this.timeout}ms`));
        } else {
          resolve({
            code,
            signal,
            stdout,
            stderr
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * List available MCPs with execution status
   */
  async listExecutableMCPs() {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${this.baseUrl}/api/discover?limit=100`, {
        timeout: 10000,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch MCPs: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Filter and annotate MCPs with execution info
      const mcps = (data.results || []).map(mcp => {
        const authReqs = this.detectAuthRequirements(mcp);
        
        return {
          slug: mcp.slug,
          name: mcp.name,
          description: mcp.description,
          category: mcp.category,
          executable: !!mcp.clean_command,
          clean_command: mcp.clean_command,
          auth_required: authReqs.required,
          auth_type: authReqs.type,
          verified: mcp.verified
        };
      });

      return mcps;
    } catch (error) {
      throw new Error(`Failed to list MCPs: ${error.message}`);
    }
  }
}

module.exports = { ExecutionEngine };