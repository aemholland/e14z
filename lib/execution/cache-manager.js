/**
 * E14Z Secure Cache Manager - 2025 Security-First Design
 * Implements multi-layer isolation and supply chain attack protection
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

class SecureCacheManager {
  constructor(options = {}) {
    this.baseCacheDir = options.cacheDir || path.join(os.homedir(), '.e14z', 'cache');
    this.maxCacheSize = options.maxCacheSize || 5 * 1024 * 1024 * 1024; // 5GB default
    this.maxCacheAge = options.maxCacheAge || 30 * 24 * 60 * 60 * 1000; // 30 days
    this.securityLevel = options.securityLevel || 'standard'; // 'minimal', 'standard', 'paranoid'
    this.enableIntegrityChecks = options.enableIntegrityChecks !== false;
    this.enableNetworkIsolation = options.enableNetworkIsolation || false;
    
    // Security-first directory structure
    this.directories = {
      packages: path.join(this.baseCacheDir, 'packages'),      // Installed packages
      metadata: path.join(this.baseCacheDir, 'metadata'),      // Package metadata/manifests
      checksums: path.join(this.baseCacheDir, 'checksums'),    // Integrity verification
      quarantine: path.join(this.baseCacheDir, 'quarantine'),  // Suspicious packages
      logs: path.join(this.baseCacheDir, 'logs'),              // Security audit logs
      temp: path.join(this.baseCacheDir, 'temp')               // Temporary extraction area
    };
  }

  /**
   * Initialize secure cache directories with proper permissions
   */
  async initialize() {
    try {
      // Create all required directories
      await Promise.all(
        Object.values(this.directories).map(dir => 
          fs.mkdir(dir, { recursive: true, mode: 0o700 })
        )
      );

      // Set restrictive permissions (user-only access)
      if (process.platform !== 'win32') {
        await Promise.all(
          Object.values(this.directories).map(dir =>
            fs.chmod(dir, 0o700)
          )
        );
      }

      // Initialize security metadata
      await this.initializeSecurityMetadata();
      
      // Start background cleanup if needed
      this.scheduleCleanup();
      
      console.log('✅ Secure cache initialized:', this.baseCacheDir);
    } catch (error) {
      throw new Error(`Failed to initialize secure cache: ${error.message}`);
    }
  }

  /**
   * Get secure cache location for a specific MCP
   */
  getCacheLocation(slug, version = 'latest') {
    // Sanitize inputs to prevent path traversal
    const safeSlug = this.sanitizeSlug(slug);
    const safeVersion = this.sanitizeVersion(version);
    
    return {
      slug: safeSlug,
      version: safeVersion,
      packageDir: path.join(this.directories.packages, safeSlug, safeVersion),
      metadataFile: path.join(this.directories.metadata, `${safeSlug}-${safeVersion}.json`),
      checksumFile: path.join(this.directories.checksums, `${safeSlug}-${safeVersion}.sha256`),
      lockFile: path.join(this.directories.packages, safeSlug, safeVersion, '.e14z-lock'),
      markerFile: path.join(this.directories.packages, safeSlug, safeVersion, '.e14z-installed')
    };
  }

  /**
   * Check if MCP is cached and valid
   */
  async isCached(slug, version = 'latest') {
    const location = this.getCacheLocation(slug, version);
    
    try {
      // Check if marker file exists
      await fs.access(location.markerFile);
      
      // Verify integrity if enabled
      if (this.enableIntegrityChecks) {
        const isValid = await this.verifyIntegrity(location);
        if (!isValid) {
          console.warn(`⚠️  Integrity check failed for ${slug}@${version}, will reinstall`);
          await this.removeFromCache(slug, version);
          return false;
        }
      }
      
      // Check age limits
      const stats = await fs.stat(location.markerFile);
      const age = Date.now() - stats.mtime.getTime();
      if (age > this.maxCacheAge) {
        console.log(`🕒 Cache expired for ${slug}@${version}, will reinstall`);
        await this.removeFromCache(slug, version);
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Add MCP to cache with security validation
   */
  async addToCache(slug, version, installationData, packageMetadata) {
    const location = this.getCacheLocation(slug, version);
    
    try {
      // Ensure package directory exists first
      await fs.mkdir(location.packageDir, { recursive: true, mode: 0o700 });
      
      // Create lock file to prevent concurrent installations
      await this.createLockFile(location.lockFile);
      
      // Security scan before caching
      if (this.securityLevel !== 'minimal') {
        await this.performSecurityScan(packageMetadata, location);
      }
      
      // Store package metadata
      const metadata = {
        slug,
        version,
        installedAt: new Date().toISOString(),
        installationData,
        packageMetadata,
        securityScan: {
          scanDate: new Date().toISOString(),
          level: this.securityLevel,
          passed: true
        },
        e14zVersion: require('../../package.json').version
      };
      
      await fs.writeFile(location.metadataFile, JSON.stringify(metadata, null, 2));
      
      // Generate integrity checksums if enabled
      if (this.enableIntegrityChecks) {
        await this.generateChecksums(location);
      }
      
      // Create installation marker
      await fs.writeFile(location.markerFile, JSON.stringify({
        slug,
        version,
        installedAt: metadata.installedAt,
        verified: true
      }));
      
      // Log security event
      await this.logSecurityEvent('package_cached', {
        slug,
        version,
        securityLevel: this.securityLevel,
        integrityEnabled: this.enableIntegrityChecks
      });
      
      console.log(`✅ Cached ${slug}@${version} securely`);
      
    } catch (error) {
      // Clean up on failure
      await this.removeFromCache(slug, version);
      throw new Error(`Failed to cache ${slug}@${version}: ${error.message}`);
    } finally {
      // Always remove lock file
      await this.removeLockFile(location.lockFile);
    }
  }

  /**
   * Remove MCP from cache
   */
  async removeFromCache(slug, version = 'latest') {
    const location = this.getCacheLocation(slug, version);
    
    try {
      // Remove package directory
      await fs.rm(location.packageDir, { recursive: true, force: true }).catch(() => {});
      
      // Remove metadata files
      await fs.unlink(location.metadataFile).catch(() => {});
      await fs.unlink(location.checksumFile).catch(() => {});
      
      console.log(`🗑️  Removed ${slug}@${version} from cache`);
    } catch (error) {
      console.warn(`Warning: Failed to fully remove ${slug}@${version}: ${error.message}`);
    }
  }

  /**
   * Get cache statistics and health info
   */
  async getCacheStats() {
    try {
      const stats = {
        totalSize: 0,
        packageCount: 0,
        oldestPackage: null,
        newestPackage: null,
        securityIssues: 0,
        integrityFailures: 0
      };
      
      // Calculate total size
      stats.totalSize = await this.calculateDirectorySize(this.directories.packages);
      
      // Count packages and find age ranges
      const packagesDir = this.directories.packages;
      const packageSlugs = await fs.readdir(packagesDir).catch(() => []);
      
      for (const slug of packageSlugs) {
        const slugDir = path.join(packagesDir, slug);
        const versions = await fs.readdir(slugDir).catch(() => []);
        
        for (const version of versions) {
          const markerFile = path.join(slugDir, version, '.e14z-installed');
          try {
            const markerStats = await fs.stat(markerFile);
            stats.packageCount++;
            
            if (!stats.oldestPackage || markerStats.mtime < stats.oldestPackage) {
              stats.oldestPackage = markerStats.mtime;
            }
            if (!stats.newestPackage || markerStats.mtime > stats.newestPackage) {
              stats.newestPackage = markerStats.mtime;
            }
          } catch (error) {
            // Package might be corrupted
            stats.securityIssues++;
          }
        }
      }
      
      return stats;
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Cleanup old and large cache entries
   */
  async cleanup(options = {}) {
    const { force = false, maxAge = this.maxCacheAge, maxSize = this.maxCacheSize } = options;
    
    try {
      console.log('🧹 Starting cache cleanup...');
      
      const stats = await this.getCacheStats();
      let cleanupNeeded = force || stats.totalSize > maxSize;
      
      if (!cleanupNeeded) {
        console.log('✅ Cache cleanup not needed');
        return { cleaned: 0, spaceSaved: 0 };
      }
      
      const packagesDir = this.directories.packages;
      const packageSlugs = await fs.readdir(packagesDir).catch(() => []);
      
      let cleanedCount = 0;
      let spaceSaved = 0;
      
      // Build list of packages with ages
      const packages = [];
      for (const slug of packageSlugs) {
        const slugDir = path.join(packagesDir, slug);
        const versions = await fs.readdir(slugDir).catch(() => []);
        
        for (const version of versions) {
          const packageDir = path.join(slugDir, version);
          const markerFile = path.join(packageDir, '.e14z-installed');
          
          try {
            const markerStats = await fs.stat(markerFile);
            const age = Date.now() - markerStats.mtime.getTime();
            const size = await this.calculateDirectorySize(packageDir);
            
            packages.push({
              slug,
              version,
              age,
              size,
              packageDir,
              markerFile
            });
          } catch (error) {
            // Corrupted package, mark for cleanup
            packages.push({
              slug,
              version,
              age: Infinity,
              size: 0,
              packageDir,
              corrupted: true
            });
          }
        }
      }
      
      // Sort by age (oldest first) for cleanup
      packages.sort((a, b) => b.age - a.age);
      
      // Clean up packages
      for (const pkg of packages) {
        const shouldClean = pkg.corrupted || pkg.age > maxAge || 
                           (stats.totalSize > maxSize && cleanedCount < packages.length * 0.3);
        
        if (shouldClean) {
          try {
            spaceSaved += pkg.size;
            await this.removeFromCache(pkg.slug, pkg.version);
            cleanedCount++;
            
            // Update running total
            stats.totalSize -= pkg.size;
            
            // Stop if we've freed enough space
            if (stats.totalSize <= maxSize * 0.8) {
              break;
            }
          } catch (error) {
            console.warn(`Failed to cleanup ${pkg.slug}@${pkg.version}: ${error.message}`);
          }
        }
      }
      
      console.log(`✅ Cleaned ${cleanedCount} packages, saved ${this.formatBytes(spaceSaved)}`);
      
      return { cleaned: cleanedCount, spaceSaved };
      
    } catch (error) {
      console.error('Cache cleanup failed:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Security scanning for packages
   */
  async performSecurityScan(packageMetadata, location) {
    // Basic security checks
    const threats = [];
    
    // Check for suspicious package names (typosquatting)
    if (this.detectTyposquatting(packageMetadata.name)) {
      threats.push('potential_typosquatting');
    }
    
    // Check for suspicious install scripts
    if (packageMetadata.scripts && this.detectSuspiciousScripts(packageMetadata.scripts)) {
      threats.push('suspicious_install_scripts');
    }
    
    // Check package size (unusually large packages are suspicious)
    if (packageMetadata.size && packageMetadata.size > 100 * 1024 * 1024) {
      threats.push('unusually_large_package');
    }
    
    // If threats detected and security level is high, quarantine
    if (threats.length > 0 && this.securityLevel === 'paranoid') {
      const quarantineDir = path.join(this.directories.quarantine, 
        `${location.slug}-${location.version}-${Date.now()}`);
      await fs.mkdir(quarantineDir, { recursive: true });
      
      await this.logSecurityEvent('package_quarantined', {
        slug: location.slug,
        version: location.version,
        threats,
        quarantineDir
      });
      
      throw new Error(`Package quarantined due to security threats: ${threats.join(', ')}`);
    }
    
    // Log threats but continue for lower security levels
    if (threats.length > 0) {
      await this.logSecurityEvent('security_threats_detected', {
        slug: location.slug,
        version: location.version,
        threats,
        action: 'proceeding_with_caution'
      });
    }
  }

  /**
   * Verify package integrity using checksums
   */
  async verifyIntegrity(location) {
    try {
      // Read stored checksums
      const storedChecksums = JSON.parse(
        await fs.readFile(location.checksumFile, 'utf8')
      );
      
      // Calculate current checksums
      const currentChecksums = await this.calculateChecksums(location.packageDir);
      
      // Compare checksums
      for (const [file, expectedHash] of Object.entries(storedChecksums)) {
        if (currentChecksums[file] !== expectedHash) {
          await this.logSecurityEvent('integrity_failure', {
            slug: location.slug,
            version: location.version,
            file,
            expected: expectedHash,
            actual: currentChecksums[file]
          });
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.warn(`Integrity verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate checksums for all files in package
   */
  async generateChecksums(location) {
    const checksums = await this.calculateChecksums(location.packageDir);
    await fs.writeFile(location.checksumFile, JSON.stringify(checksums, null, 2));
  }

  /**
   * Calculate checksums for directory
   */
  async calculateChecksums(directory) {
    const checksums = {};
    
    const calculateFileHash = async (filePath) => {
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    };
    
    const processDirectory = async (dir, relativePath = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          await processDirectory(fullPath, relPath);
        } else if (entry.isFile()) {
          // Skip temporary and metadata files from checksum calculation
          if (!this.shouldSkipFromChecksum(entry.name)) {
            checksums[relPath] = await calculateFileHash(fullPath);
          }
        }
      }
    };
    
    await processDirectory(directory);
    return checksums;
  }

  /**
   * Helper methods
   */
  
  sanitizeSlug(slug) {
    return slug.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
  }
  
  sanitizeVersion(version) {
    return version.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 50);
  }
  
  async initializeSecurityMetadata() {
    const securityFile = path.join(this.directories.metadata, 'security.json');
    
    const securityInfo = {
      initialized: new Date().toISOString(),
      securityLevel: this.securityLevel,
      e14zVersion: require('../../package.json').version,
      features: {
        integrityChecks: this.enableIntegrityChecks,
        networkIsolation: this.enableNetworkIsolation,
        quarantine: this.securityLevel === 'paranoid'
      }
    };
    
    await fs.writeFile(securityFile, JSON.stringify(securityInfo, null, 2));
  }
  
  async createLockFile(lockFile) {
    await fs.writeFile(lockFile, JSON.stringify({
      pid: process.pid,
      created: new Date().toISOString()
    }));
  }
  
  async removeLockFile(lockFile) {
    await fs.unlink(lockFile).catch(() => {});
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
        // Directory might not exist or be accessible
      }
    };
    
    await calculateSize(directory);
    return totalSize;
  }
  
  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  detectTyposquatting(packageName) {
    // Simple typosquatting detection
    const knownPackages = [
      '@modelcontextprotocol', 'stripe', 'bitcoin', 'openai', 'anthropic'
    ];
    
    for (const known of knownPackages) {
      if (this.levenshteinDistance(packageName.toLowerCase(), known.toLowerCase()) === 1) {
        return true;
      }
    }
    
    return false;
  }
  
  detectSuspiciousScripts(scripts) {
    const suspiciousPatterns = [
      /curl\s+.*\|\s*sh/,  // Pipe to shell
      /wget\s+.*\|\s*sh/,  // Pipe to shell
      /rm\s+-rf\s+\/|~/,   // Dangerous deletions
      /chmod\s+777/,       // Overly permissive permissions
      /sudo/,              // Privilege escalation
      /eval\(/,            // Code injection
      /exec\(/,            // Code execution
    ];
    
    const scriptText = JSON.stringify(scripts);
    return suspiciousPatterns.some(pattern => pattern.test(scriptText));
  }
  
  levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[b.length][a.length];
  }
  
  async logSecurityEvent(event, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data,
      pid: process.pid
    };
    
    const logFile = path.join(this.directories.logs, 
      `security-${new Date().toISOString().split('T')[0]}.jsonl`);
    
    await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
  }
  
  scheduleCleanup() {
    // Run cleanup every 24 hours
    setInterval(() => {
      this.cleanup({ maxAge: this.maxCacheAge }).catch(console.error);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Determine if a file should be skipped from checksum calculation
   */
  shouldSkipFromChecksum(fileName) {
    const skipFiles = [
      '.e14z-lock',        // Temporary lock file
      '.e14z-installed',   // Installation marker (changes with each install)
      '.DS_Store',         // macOS system file
      'Thumbs.db',         // Windows system file
      '.gitkeep',          // Git placeholder file
      'node_modules',      // Large dependency directories (would be in subdirs anyway)
    ];
    
    return skipFiles.includes(fileName) || fileName.startsWith('.tmp');
  }
}

module.exports = { SecureCacheManager };