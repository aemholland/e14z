/**
 * MCP Package Filter
 * Filters out non-MCP packages before processing to avoid wasting resources
 */

class MCPPackageFilter {
  /**
   * Check if a package is likely to be an MCP server
   * @param {Object} packageData - Package information
   * @param {Object} npmDetails - NPM package details
   * @returns {boolean} True if likely MCP server, false otherwise
   */
  static isLikelyMCPServer(packageData, npmDetails) {
    const packageName = packageData.name.toLowerCase();
    const description = (npmDetails.description || '').toLowerCase();
    const keywords = npmDetails.keywords || [];
    const dependencies = Object.keys(npmDetails.dependencies || {});
    
    // EXCLUDE known non-MCP packages
    const excludePatterns = [
      // Client-side libraries
      /stripe-js$/,      // @stripe/stripe-js (browser library)
      /client$/,         // Various client libraries
      /sdk$/,            // General SDKs
      /api$/,            // API clients
      /-ui$/,            // UI components
      /react-/,          // React components
      /vue-/,            // Vue components
      /angular-/,        // Angular components
      
      // Browser/frontend libraries
      /browser/,
      /frontend/,
      /widget/,
      /embed/,
      
      // Testing/dev tools (unless explicitly MCP)
      /^test-/,          // test-* packages
      /-test$/,          // *-test packages  
      /^mock-/,          // mock-* packages
      /-mock$/,          // *-mock packages
      /fixture/,
    ];
    
    // Check exclusion patterns
    for (const pattern of excludePatterns) {
      if (pattern.test(packageName)) {
        console.log(`   ⚠️ Excluding ${packageName}: matches non-MCP pattern ${pattern}`);
        return false;
      }
    }
    
    // INCLUDE patterns for MCP servers
    const mcpPatterns = [
      // Official MCP packages
      /@modelcontextprotocol\/server-/,
      /@anthropic-ai.*server/,
      
      // MCP in name/description
      /mcp.*server/,
      /model.*context.*protocol/,
      
      // Server patterns
      /server.*mcp/,
      /-mcp$/,
      /mcp-/,
    ];
    
    // Check for MCP indicators
    for (const pattern of mcpPatterns) {
      if (pattern.test(packageName) || pattern.test(description)) {
        console.log(`   ✅ Including ${packageName}: matches MCP pattern ${pattern}`);
        return true;
      }
    }
    
    // Check keywords for MCP indicators
    const mcpKeywords = ['mcp', 'model-context-protocol', 'claude', 'anthropic', 'ai-server'];
    if (keywords.some(keyword => mcpKeywords.includes(keyword.toLowerCase()))) {
      console.log(`   ✅ Including ${packageName}: has MCP keywords`);
      return true;
    }
    
    // Check dependencies for MCP SDK
    if (dependencies.includes('@modelcontextprotocol/sdk')) {
      console.log(`   ✅ Including ${packageName}: uses MCP SDK`);
      return true;
    }
    
    // Default: exclude if no clear MCP indicators
    console.log(`   ⚠️ Excluding ${packageName}: no clear MCP indicators found`);
    return false;
  }
  
  /**
   * Filter a list of packages to only include likely MCP servers
   * @param {Array} packages - Array of package objects
   * @returns {Array} Filtered array of likely MCP packages
   */
  static filterMCPPackages(packages, npmDetailsMap = new Map()) {
    console.log(`🔍 Filtering ${packages.length} packages for MCP servers...`);
    
    const mcpPackages = packages.filter(pkg => {
      const npmDetails = npmDetailsMap.get(pkg.name) || {};
      return this.isLikelyMCPServer(pkg, npmDetails);
    });
    
    console.log(`   ✅ ${mcpPackages.length}/${packages.length} packages appear to be MCP servers`);
    
    if (mcpPackages.length < packages.length) {
      const excluded = packages.length - mcpPackages.length;
      console.log(`   ⚠️ Excluded ${excluded} non-MCP packages to save resources`);
    }
    
    return mcpPackages;
  }
}

module.exports = { MCPPackageFilter };