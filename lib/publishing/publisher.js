/**
 * E14Z Publishing System - MCP distribution and verification
 */

const crypto = require('crypto');
const semver = require('semver');

class MCPPublisher {
  constructor(authManager, baseUrl) {
    this.authManager = authManager;
    this.baseUrl = baseUrl || process.env.E14Z_API_URL || 'https://www.e14z.com';
  }

  /**
   * Validate MCP package structure
   */
  validatePackage(packageData) {
    const errors = [];

    // Required fields
    const required = ['name', 'description', 'endpoint', 'category'];
    for (const field of required) {
      if (!packageData[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Name validation
    if (packageData.name) {
      if (!/^[a-zA-Z0-9_-]+$/.test(packageData.name)) {
        errors.push('Name must only contain alphanumeric characters, hyphens, and underscores');
      }
      if (packageData.name.length < 3 || packageData.name.length > 50) {
        errors.push('Name must be between 3 and 50 characters');
      }
    }

    // Endpoint validation
    if (packageData.endpoint) {
      // Allow only supported package manager formats
      const validFormats = [
        /^npx\s+[\w@/-]+/, // npm packages
        /^npm\s+install\s+[\w@/-]+/, // npm install commands
        /^pipx\s+install\s+[\w-]+/, // pipx packages
        /^cargo\s+install\s+[\w-]+/, // cargo packages
        /^go\s+install\s+[\w@/./-]+/, // go packages
        /^e14z\s+run\s+[\w-]+/ // e14z published MCPs
      ];
      
      const isValid = validFormats.some(regex => regex.test(packageData.endpoint));
      if (!isValid) {
        errors.push('Invalid endpoint format. Use npm (npx package-name), pipx (pipx install package-name), cargo (cargo install package-name), go (go install package-name), or e14z (e14z run package-name) format.');
      }
    }

    // Category validation
    const validCategories = [
      'payments', 'databases', 'content-creation', 'ai-tools', 'development-tools',
      'cloud-storage', 'communication', 'infrastructure', 'productivity',
      'project-management', 'security', 'social-media', 'web-apis', 'finance',
      'research', 'iot', 'other'
    ];
    
    if (packageData.category && !validCategories.includes(packageData.category)) {
      errors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }

    // Tools validation
    if (packageData.tools) {
      if (!Array.isArray(packageData.tools)) {
        errors.push('Tools must be an array');
      } else {
        packageData.tools.forEach((tool, index) => {
          if (!tool.name) {
            errors.push(`Tool ${index + 1}: Missing name`);
          }
          if (!tool.description) {
            errors.push(`Tool ${index + 1}: Missing description`);
          }
          if (tool.inputSchema) {
            if (typeof tool.inputSchema !== 'object' || tool.inputSchema.type !== 'object' || !tool.inputSchema.properties) {
                errors.push(`Tool ${index + 1}: invalid inputSchema. It should be an object with 'type': 'object' and a 'properties' object.`);
            }
          }
        });
      }
    }

    // Use cases validation
    if (packageData.use_cases && !Array.isArray(packageData.use_cases)) {
      errors.push('Use cases must be an array');
    }

    // Tags validation
    if (packageData.tags) {
      if (!Array.isArray(packageData.tags)) {
        errors.push('Tags must be an array');
      } else if (packageData.tags.length > 10) {
        errors.push('Maximum 10 tags allowed');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate clean command from endpoint
   */
  generateCleanCommand(endpoint) {
    // Clean and standardize command
    const cleaned = endpoint.trim();
    
    // Common transformations for supported package managers only
    const transformations = [
      // NPM packages
      { pattern: /^npx\s+(@?[\w/-]+)$/, replacement: 'npx $1' },
      { pattern: /^npm\s+install\s+(@?[\w/-]+)$/, replacement: 'npm install $1' },
      
      // Pipx packages (convert old pip to pipx)
      { pattern: /^pipx\s+install\s+([\w-]+)$/, replacement: 'pipx install $1' },
      { pattern: /^pip\s+install\s+([\w-]+)$/, replacement: 'pipx install $1' },
      
      // Cargo packages
      { pattern: /^cargo\s+install\s+([\w-]+)$/, replacement: 'cargo install $1' },
      
      // Go packages
      { pattern: /^go\s+install\s+([\w@/./-]+)$/, replacement: 'go install $1' },
      
      // E14Z managed MCPs
      { pattern: /^e14z\s+run\s+([\w-]+)$/, replacement: 'e14z run $1' }
    ];

    for (const transform of transformations) {
      if (transform.pattern.test(cleaned)) {
        return cleaned.replace(transform.pattern, transform.replacement);
      }
    }

    return cleaned;
  }

  /**
   * Detect authentication method from package
   */
  detectAuthMethod(packageData) {
    // Check tools for auth indicators
    if (packageData.tools) {
      for (const tool of packageData.tools) {
        const desc = (tool.description || '').toLowerCase();
        
        if (desc.includes('oauth') || desc.includes('authorization code')) {
          return 'oauth';
        }
        
        if (desc.includes('api key') || desc.includes('api_key') || desc.includes('token')) {
          return 'api_key';
        }
        
        if (desc.includes('credential') || desc.includes('username') || desc.includes('password')) {
          return 'credentials';
        }
      }
    }

    // Check description
    const desc = (packageData.description || '').toLowerCase();
    if (desc.includes('no auth') || desc.includes('no authentication')) {
      return 'none';
    }

    if (desc.includes('oauth')) return 'oauth';
    if (desc.includes('api key') || desc.includes('token')) return 'api_key';
    if (desc.includes('credential')) return 'credentials';

    // Default to none if unclear
    return 'none';
  }

  /**
   * Publish MCP to registry
   */
  async publishMCP(packageData) {
    // Ensure authenticated
    const isAuth = await this.authManager.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication required. Run "e14z auth login" first.');
    }

    // Validate package
    const validation = this.validatePackage(packageData);
    if (!validation.valid) {
      throw new Error(`Package validation failed:\n  ${validation.errors.join('\n  ')}`);
    }

    try {
      const headers = await this.authManager.getGitHubHeaders();
      const fetch = (await import('node-fetch')).default;

      // Prepare MCP data
      const mcpData = {
        name: packageData.name,
        description: packageData.description,
        endpoint: packageData.endpoint,
        clean_command: this.generateCleanCommand(packageData.endpoint),
        category: packageData.category,
        auth_method: packageData.auth_method || this.detectAuthMethod(packageData),
        connection_type: packageData.connection_type || 'stdio',
        protocol_version: packageData.protocol_version || '2024-11-05',
        
        // Optional fields
        tags: packageData.tags || [],
        use_cases: packageData.use_cases || [],
        tools: packageData.tools ? JSON.stringify(packageData.tools) : null,
        
        // URLs
        github_url: packageData.github_url,
        documentation_url: packageData.documentation_url,
        website_url: packageData.website_url,
        
        // Metadata
        author: packageData.author,
        company: packageData.company,
        license: packageData.license || 'MIT',
        pricing_model: packageData.pricing_model || 'free',
        pricing_details: packageData.pricing_details || {},
        
        // Publishing info
        source_type: 'published',
        verified: false // Will be reviewed
      };

      const response = await fetch(`${this.baseUrl}/api/publish`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mcpData)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(error.error || error.message || `Publication failed: ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      throw new Error(`Failed to publish MCP: ${error.message}`);
    }
  }

  /**
   * Update existing MCP
   */
  async updateMCP(slug, packageData) {
    // Ensure authenticated
    const isAuth = await this.authManager.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication required. Run "e14z auth login" first.');
    }

    // Validate package
    const validation = this.validatePackage(packageData);
    if (!validation.valid) {
      throw new Error(`Package validation failed:\n  ${validation.errors.join('\n  ')}`);
    }

    try {
      const headers = await this.authManager.getGitHubHeaders();
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${this.baseUrl}/api/publish/${slug}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(packageData)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(error.error || error.message || `Update failed: ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      throw new Error(`Failed to update MCP: ${error.message}`);
    }
  }

  /**
   * Get user's published MCPs
   */
  async getMyMCPs() {
    const isAuth = await this.authManager.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication required. Run "e14z auth login" first.');
    }

    try {
      const headers = await this.authManager.getGitHubHeaders();
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${this.baseUrl}/api/my-mcps`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to get MCPs: ${response.status}`);
      }

      const result = await response.json();
      return result.mcps || [];

    } catch (error) {
      throw new Error(`Failed to get published MCPs: ${error.message}`);
    }
  }

  /**
   * Generate package template
   */
  generateTemplate(name) {
    return {
      name: name,
      description: "Description of what this MCP does",
      endpoint: "npx your-package-name",
      category: "other",
      auth_method: "none",
      
      tools: [
        {
          name: "example_tool",
          description: "What this tool does",
          inputSchema: {
            type: "object",
            properties: {
              param1: {
                type: "string",
                description: "Parameter description",
              }
            },
            required: ["param1"]
          }
        }
      ],
      
      use_cases: [
        "Primary use case",
        "Secondary use case"
      ],
      
      tags: ["tag1", "tag2"],
      
      github_url: "https://github.com/username/repo",
      documentation_url: "https://docs.example.com",
      
      author: "Your Name",
      license: "MIT"
    };
  }
}

module.exports = { MCPPublisher };