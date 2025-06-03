/**
 * Base Package Manager Class
 * Shared functionality for all package managers
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

module.exports = { BasePackageManager };