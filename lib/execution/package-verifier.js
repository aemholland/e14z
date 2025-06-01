/**
 * E14Z Enhanced Package Verification System
 * Advanced security scanning and integrity verification
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Package reputation and security database
 */
class PackageReputationDB {
  constructor() {
    // Known malicious packages (would be loaded from external source in production)
    this.maliciousPackages = new Set([
      'discord.js-selfbot',
      'discordselfbot',
      'bitcoinjs-wallet-stealer',
      'node-toolkit-stealer',
      'discordapi.js',
      'discord-selfbot',
      'noblox.js-proxy',
      'electron-discord-webapp'
    ]);

    // Known trusted publishers/organizations
    this.trustedPublishers = new Set([
      '@types',
      '@microsoft',
      '@google',
      '@anthropic',
      '@openai',
      '@stripe',
      '@supabase',
      '@vercel',
      '@modelcontextprotocol'
    ]);

    // Common typosquatting targets
    this.popularPackages = [
      'express', 'react', 'lodash', 'request', 'chalk', 'commander', 'axios',
      'moment', 'underscore', 'async', 'bluebird', 'debug', 'glob', 'semver',
      'stripe', 'bitcoin', 'openai', 'anthropic', 'discord.js', 'electron'
    ];

    // Suspicious file extensions and patterns
    this.suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif'];
    this.suspiciousFilePatterns = [
      /\.min\.js$/, // Minified files can hide malicious code
      /^[0-9a-f]{32,}$/, // Hash-like filenames
      /\.(dll|so|dylib)$/, // Native libraries
      /\.(zip|tar|gz|rar|7z)$/i // Archive files
    ];
  }

  /**
   * Check if package is known to be malicious
   */
  isMalicious(packageName) {
    return this.maliciousPackages.has(packageName.toLowerCase());
  }

  /**
   * Check if publisher is trusted
   */
  isTrustedPublisher(packageName) {
    if (packageName.startsWith('@')) {
      const scope = packageName.split('/')[0];
      return this.trustedPublishers.has(scope);
    }
    return false;
  }

  /**
   * Enhanced typosquatting detection
   */
  detectTyposquatting(packageName) {
    const name = packageName.toLowerCase();
    
    for (const popular of this.popularPackages) {
      const distance = this.levenshteinDistance(name, popular);
      
      // Check for single character differences
      if (distance === 1 && name !== popular) {
        return {
          detected: true,
          target: popular,
          method: 'character_substitution',
          confidence: 0.9
        };
      }
      
      // Check for character swapping
      if (this.isCharacterSwap(name, popular)) {
        return {
          detected: true,
          target: popular,
          method: 'character_swap',
          confidence: 0.8
        };
      }
      
      // Check for homograph attacks (similar looking characters)
      if (this.isHomographAttack(name, popular)) {
        return {
          detected: true,
          target: popular,
          method: 'homograph_attack',
          confidence: 0.7
        };
      }
    }
    
    return { detected: false };
  }

  /**
   * Check if two strings differ by character swapping
   */
  isCharacterSwap(str1, str2) {
    if (str1.length !== str2.length) return false;
    
    let differences = 0;
    for (let i = 0; i < str1.length - 1; i++) {
      if (str1[i] !== str2[i]) {
        if (str1[i] === str2[i + 1] && str1[i + 1] === str2[i]) {
          differences++;
          i++; // Skip next character as it's part of the swap
        } else {
          return false;
        }
      }
    }
    
    return differences === 1;
  }

  /**
   * Check for homograph attacks (visually similar characters)
   */
  isHomographAttack(str1, str2) {
    const homographs = {
      'a': ['α', 'а'], // Greek alpha, Cyrillic a
      'e': ['е'], // Cyrillic e
      'o': ['о', '0'], // Cyrillic o, zero
      'p': ['р'], // Cyrillic p
      'c': ['с'], // Cyrillic c
      'x': ['х'], // Cyrillic x
      'y': ['у'], // Cyrillic y
      'i': ['і', '1', 'l'], // Cyrillic i, one, lowercase L
      's': ['ѕ'], // Cyrillic s
    };
    
    if (str1.length !== str2.length) return false;
    if (str1 === str2) return false; // Exact match is not a homograph attack
    
    let foundHomograph = false;
    
    for (let i = 0; i < str1.length; i++) {
      const char1 = str1[i];
      const char2 = str2[i];
      
      if (char1 !== char2) {
        const possibleHomographs = homographs[char2] || [];
        if (!possibleHomographs.includes(char1)) {
          return false;
        }
        foundHomograph = true;
      }
    }
    
    return foundHomograph; // Only return true if we found actual homograph substitutions
  }

  /**
   * Levenshtein distance calculation
   */
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
}

/**
 * Enhanced package verifier with multiple security checks
 */
class EnhancedPackageVerifier {
  constructor(options = {}) {
    this.reputationDB = new PackageReputationDB();
    this.enableNetworkChecks = options.enableNetworkChecks || false;
    this.securityLevel = options.securityLevel || 'standard';
    this.maxPackageSize = options.maxPackageSize || 100 * 1024 * 1024; // 100MB
    this.maxFiles = options.maxFiles || 10000;
  }

  /**
   * Comprehensive package verification
   */
  async verifyPackage(packageInfo, packageMetadata, packagePath) {
    const verificationResult = {
      passed: true,
      threats: [],
      warnings: [],
      score: 100, // Start with perfect score
      details: {}
    };

    try {
      // 1. Basic package information validation
      await this.validateBasicInfo(packageInfo, packageMetadata, verificationResult);

      // 2. Reputation and trust checks
      await this.checkReputation(packageInfo, packageMetadata, verificationResult);

      // 3. Content analysis
      await this.analyzePackageContent(packagePath, verificationResult);

      // 4. Dependency analysis
      await this.analyzeDependencies(packageMetadata, verificationResult);

      // 5. License validation
      await this.validateLicense(packageMetadata, verificationResult);

      // 6. Script analysis
      await this.analyzeScripts(packageMetadata, verificationResult);

      // 7. File system analysis
      await this.analyzeFileSystem(packagePath, verificationResult);

      // Calculate final score and status
      this.calculateFinalScore(verificationResult);

    } catch (error) {
      verificationResult.passed = false;
      verificationResult.threats.push({
        type: 'verification_error',
        severity: 'high',
        message: `Verification failed: ${error.message}`
      });
    }

    return verificationResult;
  }

  /**
   * Validate basic package information
   */
  async validateBasicInfo(packageInfo, packageMetadata, result) {
    // Check for missing required fields
    if (!packageMetadata.name) {
      result.threats.push({
        type: 'missing_metadata',
        severity: 'medium',
        message: 'Package name is missing'
      });
      result.score -= 10;
    }

    if (!packageMetadata.version) {
      result.warnings.push({
        type: 'missing_version',
        message: 'Package version is missing'
      });
      result.score -= 5;
    }

    // Check for suspicious version patterns
    if (packageMetadata.version && /[^\w\.\-]/.test(packageMetadata.version)) {
      result.threats.push({
        type: 'suspicious_version',
        severity: 'medium',
        message: `Suspicious characters in version: ${packageMetadata.version}`
      });
      result.score -= 15;
    }

    // Check package size
    if (packageMetadata.size > this.maxPackageSize) {
      result.threats.push({
        type: 'oversized_package',
        severity: 'medium',
        message: `Package is unusually large: ${packageMetadata.size} bytes`
      });
      result.score -= 20;
    }
  }

  /**
   * Check package reputation and trust
   */
  async checkReputation(packageInfo, packageMetadata, result) {
    const packageName = packageMetadata.name || packageInfo.name;

    // Check if package is known malicious
    if (this.reputationDB.isMalicious(packageName)) {
      result.passed = false;
      result.threats.push({
        type: 'known_malicious',
        severity: 'critical',
        message: `Package is known to be malicious: ${packageName}`
      });
      result.score = 0;
      return;
    }

    // Check for typosquatting
    const typoSquatResult = this.reputationDB.detectTyposquatting(packageName);
    if (typoSquatResult.detected) {
      const severity = typoSquatResult.confidence > 0.8 ? 'high' : 'medium';
      result.threats.push({
        type: 'typosquatting',
        severity,
        message: `Potential typosquatting of '${typoSquatResult.target}' using ${typoSquatResult.method}`,
        confidence: typoSquatResult.confidence
      });
      result.score -= Math.round(30 * typoSquatResult.confidence);
    }

    // Check publisher trust
    if (this.reputationDB.isTrustedPublisher(packageName)) {
      result.score += 10; // Bonus for trusted publishers
      result.details.trustedPublisher = true;
    }

    // Check author information
    if (!packageMetadata.author && !packageMetadata.maintainers) {
      result.warnings.push({
        type: 'anonymous_package',
        message: 'Package has no identifiable author or maintainers'
      });
      result.score -= 10;
    }
  }

  /**
   * Analyze package content for suspicious patterns
   */
  async analyzePackageContent(packagePath, result) {
    try {
      const files = await this.getFileList(packagePath);
      
      if (files.length > this.maxFiles) {
        result.threats.push({
          type: 'excessive_files',
          severity: 'medium',
          message: `Package contains too many files: ${files.length}`
        });
        result.score -= 15;
      }

      // Check for suspicious files
      for (const file of files) {
        const fileName = path.basename(file);
        const ext = path.extname(file).toLowerCase();

        // Check suspicious extensions
        if (this.reputationDB.suspiciousExtensions.includes(ext)) {
          result.threats.push({
            type: 'suspicious_file',
            severity: 'high',
            message: `Suspicious file extension: ${file}`
          });
          result.score -= 25;
        }

        // Check suspicious patterns
        for (const pattern of this.reputationDB.suspiciousFilePatterns) {
          if (pattern.test(fileName)) {
            result.warnings.push({
              type: 'suspicious_filename',
              message: `Suspicious filename pattern: ${file}`
            });
            result.score -= 5;
            break;
          }
        }

        // Check for hidden files in unexpected locations
        if (fileName.startsWith('.') && !this.isExpectedHiddenFile(fileName)) {
          result.warnings.push({
            type: 'unexpected_hidden_file',
            message: `Unexpected hidden file: ${file}`
          });
          result.score -= 3;
        }
      }

    } catch (error) {
      result.warnings.push({
        type: 'content_analysis_failed',
        message: `Could not analyze package content: ${error.message}`
      });
    }
  }

  /**
   * Analyze package dependencies for security issues
   */
  async analyzeDependencies(packageMetadata, result) {
    const dependencies = {
      ...packageMetadata.dependencies,
      ...packageMetadata.devDependencies,
      ...packageMetadata.peerDependencies
    };

    if (!dependencies || Object.keys(dependencies).length === 0) {
      return; // No dependencies to analyze
    }

    let suspiciousDeps = 0;
    let totalDeps = Object.keys(dependencies).length;

    for (const [depName, depVersion] of Object.entries(dependencies)) {
      // Check for malicious dependencies
      if (this.reputationDB.isMalicious(depName)) {
        result.threats.push({
          type: 'malicious_dependency',
          severity: 'critical',
          message: `Depends on known malicious package: ${depName}`
        });
        result.score -= 40;
      }

      // Check for suspicious version ranges
      if (depVersion === '*' || depVersion === 'latest') {
        result.warnings.push({
          type: 'loose_dependency_version',
          message: `Loose version constraint for ${depName}: ${depVersion}`
        });
        result.score -= 2;
        suspiciousDeps++;
      }

      // Check for git URLs in dependencies (can be risky)
      if (typeof depVersion === 'string' && depVersion.includes('git+')) {
        result.warnings.push({
          type: 'git_dependency',
          message: `Git dependency: ${depName} -> ${depVersion}`
        });
        result.score -= 5;
      }
    }

    // Check dependency ratio
    if (suspiciousDeps > totalDeps * 0.5) {
      result.warnings.push({
        type: 'high_suspicious_dependency_ratio',
        message: `High ratio of suspicious dependencies: ${suspiciousDeps}/${totalDeps}`
      });
      result.score -= 10;
    }

    result.details.dependencyCount = totalDeps;
    result.details.suspiciousDependencies = suspiciousDeps;
  }

  /**
   * Validate package license
   */
  async validateLicense(packageMetadata, result) {
    const license = packageMetadata.license;

    if (!license) {
      result.warnings.push({
        type: 'no_license',
        message: 'Package has no specified license'
      });
      result.score -= 5;
      return;
    }

    // Check for suspicious or non-standard licenses
    const standardLicenses = [
      'MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 
      'LGPL-2.1', 'MPL-2.0', 'UNLICENSED'
    ];

    if (typeof license === 'string') {
      if (!standardLicenses.includes(license) && license !== 'UNLICENSED') {
        result.warnings.push({
          type: 'non_standard_license',
          message: `Non-standard license: ${license}`
        });
        result.score -= 3;
      }
    }
  }

  /**
   * Analyze package scripts for suspicious commands
   */
  async analyzeScripts(packageMetadata, result) {
    const scripts = packageMetadata.scripts;
    if (!scripts) return;

    const suspiciousPatterns = [
      /curl.*\|.*sh/i,           // Pipe to shell
      /wget.*\|.*sh/i,           // Pipe to shell
      /rm\s+-rf\s+[\/~]/i,       // Dangerous deletions
      /chmod\s+777/i,            // Overly permissive permissions
      /sudo/i,                   // Privilege escalation
      /eval\(/i,                 // Code evaluation
      /exec\(/i,                 // Code execution
      /spawn\(/i,                // Process spawning
      /child_process/i,          // Process creation
      /\$\(/,                    // Command substitution
      /base64.*decode/i,         // Base64 decoding (potential obfuscation)
      /atob\(/i,                 // Base64 decoding
      /btoa\(/i,                 // Base64 encoding
      /crypto.*decrypt/i,        // Decryption
      /require\(.*http/i,        // HTTP requires
      /require\(.*net/i,         // Network requires
      /process\.env/i,           // Environment access
      /process\.argv/i,          // Argument access
    ];

    for (const [scriptName, scriptContent] of Object.entries(scripts)) {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(scriptContent)) {
          const severity = this.getScriptThreatSeverity(pattern);
          result.threats.push({
            type: 'suspicious_script',
            severity,
            message: `Suspicious script '${scriptName}': ${scriptContent}`,
            pattern: pattern.source
          });
          result.score -= severity === 'critical' ? 50 : severity === 'high' ? 30 : 15;
          break;
        }
      }
    }
  }

  /**
   * Analyze file system structure
   */
  async analyzeFileSystem(packagePath, result) {
    try {
      // Check for files outside normal package structure
      const files = await this.getFileList(packagePath);
      const suspiciousLocations = [
        /^\.\.\//, // Parent directory access
        /^\//, // Absolute paths
        /~\//, // Home directory access
        /system32/i, // Windows system directory
        /usr\/bin/i, // Unix binary directory
        /etc\//i, // Unix config directory
      ];

      for (const file of files) {
        for (const pattern of suspiciousLocations) {
          if (pattern.test(file)) {
            result.threats.push({
              type: 'suspicious_file_location',
              severity: 'high',
              message: `File in suspicious location: ${file}`
            });
            result.score -= 20;
            break;
          }
        }
      }

    } catch (error) {
      result.warnings.push({
        type: 'filesystem_analysis_failed',
        message: `Could not analyze file system: ${error.message}`
      });
    }
  }

  /**
   * Get threat severity for script patterns
   */
  getScriptThreatSeverity(pattern) {
    const criticalPatterns = [
      /curl.*\|.*sh/i,
      /wget.*\|.*sh/i,
      /rm\s+-rf\s+[\/~]/i,
      /sudo/i
    ];

    const highPatterns = [
      /eval\(/i,
      /exec\(/i,
      /spawn\(/i,
      /child_process/i
    ];

    if (criticalPatterns.some(p => p.source === pattern.source)) return 'critical';
    if (highPatterns.some(p => p.source === pattern.source)) return 'high';
    return 'medium';
  }

  /**
   * Check if hidden file is expected
   */
  isExpectedHiddenFile(fileName) {
    const expectedHiddenFiles = [
      '.gitignore', '.npmignore', '.eslintrc', '.babelrc', '.prettierrc',
      '.editorconfig', '.travis.yml', '.github', '.vscode', '.idea'
    ];
    
    return expectedHiddenFiles.some(expected => 
      fileName === expected || fileName.startsWith(expected + '.')
    );
  }

  /**
   * Get list of all files in package
   */
  async getFileList(packagePath, relativePath = '') {
    const files = [];
    
    try {
      const entries = await fs.readdir(path.join(packagePath, relativePath), { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getFileList(packagePath, fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return files;
  }

  /**
   * Calculate final verification score and status
   */
  calculateFinalScore(result) {
    // Ensure score doesn't go below 0
    result.score = Math.max(0, result.score);
    
    // Determine pass/fail based on threats and score
    const criticalThreats = result.threats.filter(t => t.severity === 'critical');
    const highThreats = result.threats.filter(t => t.severity === 'high');
    
    if (criticalThreats.length > 0 || result.score < 30) {
      result.passed = false;
    } else if (highThreats.length > 2 || result.score < 50) {
      result.passed = false;
    }

    // Set confidence level
    if (result.score >= 80) {
      result.confidence = 'high';
    } else if (result.score >= 60) {
      result.confidence = 'medium';
    } else {
      result.confidence = 'low';
    }

    result.details.finalScore = result.score;
    result.details.threatCount = result.threats.length;
    result.details.warningCount = result.warnings.length;
  }
}

module.exports = {
  EnhancedPackageVerifier,
  PackageReputationDB
};