/**
 * E14Z Enhanced Error Handling and Rollback System
 * Provides transaction-like behavior for package installations
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Error categories for better handling
 */
const ErrorCategories = {
  NETWORK: 'network',
  PERMISSION: 'permission', 
  CORRUPTION: 'corruption',
  SECURITY: 'security',
  DEPENDENCY: 'dependency',
  EXECUTION: 'execution',
  TIMEOUT: 'timeout',
  DISK_SPACE: 'disk_space',
  UNSUPPORTED: 'unsupported'
};

/**
 * Categorized error class with recovery suggestions
 */
class CategorizedError extends Error {
  constructor(message, category, recoverable = false, suggestions = []) {
    super(message);
    this.name = 'CategorizedError';
    this.category = category;
    this.recoverable = recoverable;
    this.suggestions = suggestions;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      recoverable: this.recoverable,
      suggestions: this.suggestions,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Installation transaction for rollback capability
 */
class InstallationTransaction {
  constructor(slug, version, cacheManager) {
    this.slug = slug;
    this.version = version;
    this.cacheManager = cacheManager;
    this.operations = [];
    this.tempFiles = [];
    this.completed = false;
    this.rolledBack = false;
    this.startTime = Date.now();
  }

  /**
   * Record an operation for potential rollback
   */
  recordOperation(type, details) {
    this.operations.push({
      type,
      details,
      timestamp: Date.now()
    });
  }

  /**
   * Record temporary file for cleanup
   */
  recordTempFile(filePath) {
    this.tempFiles.push(filePath);
  }

  /**
   * Mark transaction as completed successfully
   */
  markCompleted() {
    this.completed = true;
  }

  /**
   * Rollback all operations performed in this transaction
   */
  async rollback() {
    if (this.rolledBack) {
      return { success: true, message: 'Already rolled back' };
    }

    console.log(`🔄 Rolling back installation transaction for ${this.slug}@${this.version}...`);
    
    const rollbackResults = [];
    
    // Rollback operations in reverse order
    for (const operation of this.operations.reverse()) {
      try {
        await this.rollbackOperation(operation);
        rollbackResults.push({ operation: operation.type, success: true });
      } catch (error) {
        console.warn(`Failed to rollback operation ${operation.type}:`, error.message);
        rollbackResults.push({ 
          operation: operation.type, 
          success: false, 
          error: error.message 
        });
      }
    }

    // Clean up temporary files
    await this.cleanupTempFiles();

    // Remove from cache if present
    try {
      await this.cacheManager.removeFromCache(this.slug, this.version);
      rollbackResults.push({ operation: 'cache_removal', success: true });
    } catch (error) {
      rollbackResults.push({ 
        operation: 'cache_removal', 
        success: false, 
        error: error.message 
      });
    }

    this.rolledBack = true;
    console.log(`✅ Rollback completed for ${this.slug}@${this.version}`);
    
    return { 
      success: true, 
      operations: rollbackResults,
      duration: Date.now() - this.startTime
    };
  }

  /**
   * Rollback a specific operation
   */
  async rollbackOperation(operation) {
    switch (operation.type) {
      case 'directory_created':
        await fs.rm(operation.details.path, { recursive: true, force: true }).catch(() => {});
        break;
        
      case 'file_created':
        await fs.unlink(operation.details.path).catch(() => {});
        break;
        
      case 'file_downloaded':
        await fs.unlink(operation.details.path).catch(() => {});
        break;
        
      case 'package_installed':
        // Package manager specific cleanup would go here
        break;
        
      default:
        console.warn(`Unknown operation type for rollback: ${operation.type}`);
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles() {
    for (const tempFile of this.tempFiles) {
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        // Temp file might already be cleaned up
      }
    }
  }

  /**
   * Get transaction summary
   */
  getSummary() {
    return {
      slug: this.slug,
      version: this.version,
      completed: this.completed,
      rolledBack: this.rolledBack,
      operationCount: this.operations.length,
      tempFileCount: this.tempFiles.length,
      duration: Date.now() - this.startTime
    };
  }
}

/**
 * Enhanced error handler with categorization and recovery
 */
class ErrorHandler {
  constructor(options = {}) {
    this.enableRetry = options.enableRetry !== false;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.enableRollback = options.enableRollback !== false;
  }

  /**
   * Categorize error and provide recovery suggestions
   */
  categorizeError(error, context = {}) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || message.includes('timeout') || 
        message.includes('enotfound') || message.includes('econnrefused')) {
      return new CategorizedError(
        error.message,
        ErrorCategories.NETWORK,
        true,
        [
          'Check internet connection',
          'Verify proxy settings',
          'Try again in a few moments',
          'Use different package registry if available'
        ]
      );
    }

    // Permission errors
    if (message.includes('permission') || message.includes('eacces') || 
        message.includes('eperm') || message.includes('access denied')) {
      return new CategorizedError(
        error.message,
        ErrorCategories.PERMISSION,
        true,
        [
          'Check file system permissions',
          'Ensure write access to cache directory',
          'Try running with appropriate privileges'
        ]
      );
    }

    // Disk space errors
    if (message.includes('enospc') || message.includes('no space') || 
        message.includes('disk full')) {
      return new CategorizedError(
        error.message,
        ErrorCategories.DISK_SPACE,
        true,
        [
          'Free up disk space',
          'Clear package cache',
          'Move cache to different location with more space'
        ]
      );
    }

    // Security errors
    if (message.includes('quarantine') || message.includes('security') || 
        message.includes('suspicious') || message.includes('threat')) {
      return new CategorizedError(
        error.message,
        ErrorCategories.SECURITY,
        false,
        [
          'Package has been flagged as suspicious',
          'Review package source and reputation',
          'Consider using alternative package',
          'Lower security level if appropriate'
        ]
      );
    }

    // Dependency errors
    if (message.includes('dependency') || message.includes('peer dep') || 
        message.includes('missing') || message.includes('not found')) {
      return new CategorizedError(
        error.message,
        ErrorCategories.DEPENDENCY,
        true,
        [
          'Install missing dependencies manually',
          'Update package manager',
          'Check package compatibility',
          'Try different package version'
        ]
      );
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return new CategorizedError(
        error.message,
        ErrorCategories.TIMEOUT,
        true,
        [
          'Increase timeout duration',
          'Check internet connection speed',
          'Try again during off-peak hours'
        ]
      );
    }

    // Corruption errors
    if (message.includes('corrupt') || message.includes('integrity') || 
        message.includes('checksum') || message.includes('hash')) {
      return new CategorizedError(
        error.message,
        ErrorCategories.CORRUPTION,
        true,
        [
          'Clear package cache',
          'Re-download package',
          'Check network stability',
          'Verify package source integrity'
        ]
      );
    }

    // Execution errors
    if (message.includes('command not found') || message.includes('exec') || 
        message.includes('spawn') || message.includes('exit code')) {
      return new CategorizedError(
        error.message,
        ErrorCategories.EXECUTION,
        true,
        [
          'Check if required runtime is installed',
          'Verify package executable permissions',
          'Update environment PATH',
          'Install package dependencies'
        ]
      );
    }

    // Unsupported operation
    if (message.includes('not supported') || message.includes('unsupported') || 
        message.includes('not implemented')) {
      return new CategorizedError(
        error.message,
        ErrorCategories.UNSUPPORTED,
        false,
        [
          'Feature not available on this platform',
          'Try alternative installation method',
          'Check platform compatibility',
          'Update to newer version'
        ]
      );
    }

    // Default: unknown error
    return new CategorizedError(
      error.message,
      'unknown',
      true,
      [
        'Check error details for specific issues',
        'Try clearing cache and retrying',
        'Report issue if problem persists'
      ]
    );
  }

  /**
   * Execute operation with automatic retry and error handling
   */
  async executeWithRetry(operation, context = {}) {
    let lastError;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempt++;

        const categorizedError = this.categorizeError(error, context);
        
        console.warn(`Attempt ${attempt}/${this.maxRetries + 1} failed:`, categorizedError.message);

        // Don't retry non-recoverable errors
        if (!categorizedError.recoverable || attempt > this.maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed, throw categorized error
    throw this.categorizeError(lastError, context);
  }

  /**
   * Create transaction for operation with rollback capability
   */
  createTransaction(slug, version, cacheManager) {
    return new InstallationTransaction(slug, version, cacheManager);
  }

  /**
   * Handle error with appropriate response and recovery suggestions
   */
  handleError(error, context = {}) {
    const categorizedError = this.categorizeError(error, context);
    
    console.error(`❌ ${categorizedError.category.toUpperCase()} ERROR:`, categorizedError.message);
    
    if (categorizedError.suggestions.length > 0) {
      console.log('💡 Suggestions:');
      categorizedError.suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });
    }

    return categorizedError;
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats() {
    // TODO: Implement error tracking and statistics
    return {
      totalErrors: 0,
      errorsByCategory: {},
      recoveryRate: 0
    };
  }
}

module.exports = {
  ErrorHandler,
  InstallationTransaction,
  CategorizedError,
  ErrorCategories
};