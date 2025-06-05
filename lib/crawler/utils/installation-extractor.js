/**
 * Installation Method Extractor
 * Extracts all possible installation methods for a package
 */

class InstallationExtractor {
  /**
   * Extract ONLY supported installation methods (npm, pipx, cargo, go, e14z)
   */
  static extractSupportedMethods(packageData, documentation) {
    const methods = [];
    const packageName = packageData.name;
    
    // ONLY check our supported package managers
    const hasNPM = this.checkNPMAvailability(packageData);
    const hasPipx = this.checkPipxAvailability(packageData, documentation);
    const hasCargo = this.checkCargoAvailability(packageData, documentation);
    const hasGo = this.checkGoAvailability(packageData, documentation);
    const hasE14z = this.checkE14zAvailability(packageData, documentation);
    
    // NPM methods - our primary supported package manager
    if (hasNPM) {
      // NPX (most common for MCP servers)
      methods.push({
        type: 'npx',
        command: `npx ${packageName}`,
        global: false,
        description: 'Run directly with npx (recommended)',
        preferred: true
      });
      
      // Standard npm install
      methods.push({
        type: 'npm',
        command: `npm install -g ${packageName}`,
        global: true,
        description: 'Install globally with npm'
      });
    }
    
    // Pipx methods - our supported Python package manager
    if (hasPipx) {
      const pipName = this.extractPipPackageName(packageData, documentation);
      
      // Pipx (preferred for CLI tools)
      methods.push({
        type: 'pipx',
        command: `pipx install ${pipName}`,
        global: true,
        description: 'Install with pipx (recommended for Python)',
        preferred: true
      });
    }
    
    // Cargo methods - our supported Rust package manager
    if (hasCargo) {
      const crateName = this.extractCrateName(packageData, documentation);
      
      methods.push({
        type: 'cargo',
        command: `cargo install ${crateName}`,
        global: true,
        description: 'Install with cargo',
        preferred: true
      });
    }
    
    // Go methods - our supported Go package manager
    if (hasGo) {
      const goModule = this.extractGoModule(packageData, documentation);
      
      methods.push({
        type: 'go',
        command: `go install ${goModule}@latest`,
        global: true,
        description: 'Install with go install',
        preferred: true
      });
    }
    
    // E14z methods - our own package manager
    if (hasE14z) {
      methods.push({
        type: 'e14z',
        command: `e14z run ${packageName}`,
        global: false,
        description: 'Run with e14z (auto-installs)',
        preferred: true
      });
    }
    
    // Determine the primary/recommended method
    this.setPrimaryMethod(methods, documentation);
    
    return methods;
  }
  
  /**
   * Check availability methods
   */
  static checkNPMAvailability(packageData) {
    // If it's from NPM discovery, it's available
    if (packageData.discoveryMethod?.includes('npm')) return true;
    
    // Check if package.json exists
    return !!packageData.name?.match(/^(@[^/]+\/)?[a-z0-9-]+$/);
  }
  
  static checkPipxAvailability(packageData, documentation) {
    if (packageData.discoveryMethod?.includes('pip')) return true;
    
    // Look for pip/pipx mentions in docs
    return /pip\s+install|pipx\s+install|pypi\.org/i.test(documentation);
  }
  
  static checkE14zAvailability(packageData, documentation) {
    // Check if it's in our registry or mentions e14z
    return /e14z\s+run|e14z\.com/i.test(documentation) || 
           packageData.discoveryMethod?.includes('e14z');
  }
  
  static checkCargoAvailability(packageData, documentation) {
    if (packageData.discoveryMethod?.includes('cargo')) return true;
    
    return /cargo\s+install|crates\.io/i.test(documentation);
  }
  
  static checkGoAvailability(packageData, documentation) {
    if (packageData.discoveryMethod?.includes('go')) return true;
    
    return /go\s+install|go\s+get|pkg\.go\.dev/i.test(documentation);
  }
  
  // Removed unsupported installation methods
  
  /**
   * Extract package names for different ecosystems
   */
  static extractPipPackageName(packageData, documentation) {
    // Try to find pip package name in docs
    const pipMatch = documentation.match(/pip\s+install\s+([a-z0-9-_]+)/i);
    if (pipMatch) return pipMatch[1];
    
    // Convert npm-style name to pip-style
    return packageData.name
      .replace(/^@[^/]+\//, '')  // Remove npm scope
      .replace(/-/g, '_');        // Replace hyphens with underscores
  }
  
  static extractCrateName(packageData, documentation) {
    const cargoMatch = documentation.match(/cargo\s+install\s+([a-z0-9-_]+)/i);
    if (cargoMatch) return cargoMatch[1];
    
    return packageData.name.replace(/^@[^/]+\//, '');
  }
  
  static extractGoModule(packageData, documentation) {
    const goMatch = documentation.match(/go\s+(?:install|get)\s+([^\s@]+)/i);
    if (goMatch) return goMatch[1];
    
    // Check for GitHub repo
    if (packageData.repository?.includes('github.com')) {
      return packageData.repository
        .replace(/^https?:\/\//, '')
        .replace(/\.git$/, '');
    }
    
    return `github.com/unknown/${packageData.name}`;
  }
  
  static extractDockerImage(packageData, documentation) {
    const dockerMatch = documentation.match(/docker\s+run\s+[^\s]*\s*([^\s]+)/i);
    if (dockerMatch) return dockerMatch[1];
    
    // Guess based on package name
    const name = packageData.name.replace(/^@/, '').replace('/', '-');
    return `${name}:latest`;
  }
  
  // Removed unsupported methods
  
  /**
   * Helper methods for supported package managers only
   */
  
  static setPrimaryMethod(methods, documentation) {
    // Look for explicit recommendations
    const recommendMatch = documentation.match(/recommended.*?[`']([^`']+)[`']/i);
    if (recommendMatch) {
      const recommended = recommendMatch[1];
      methods.forEach(m => {
        if (m.command.includes(recommended)) {
          m.preferred = true;
        }
      });
    }
    
    // If no explicit recommendation, use heuristics
    if (!methods.some(m => m.preferred)) {
      // Prefer npx for MCP servers
      const npxMethod = methods.find(m => m.type === 'npx');
      if (npxMethod) {
        npxMethod.preferred = true;
      } else {
        // Otherwise prefer the first method
        if (methods.length > 0) {
          methods[0].preferred = true;
        }
      }
    }
  }
}

module.exports = { InstallationExtractor };