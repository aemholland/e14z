/**
 * Authentication Requirements Extractor
 * Extracts structured auth data that agents can understand
 */

class AuthRequirementsExtractor {
  /**
   * Extract authentication requirements from validation errors and documentation
   */
  static extractAuthRequirements(validationResult, documentation, errorMessage = '') {
    const authData = {
      auth_required: false,
      required_env_vars: [],
      optional_env_vars: [],
      auth_methods: [],
      auth_instructions: null,
      credentials_needed: [],
      setup_complexity: 'simple' // simple, moderate, complex
    };
    
    // Extract from validation error messages
    this.extractFromValidationError(authData, errorMessage);
    
    // Extract from documentation
    this.extractFromDocumentation(authData, documentation);
    
    // Extract from validation results if available
    if (validationResult?.errors) {
      validationResult.errors.forEach(error => {
        this.extractFromValidationError(authData, error);
      });
    }
    
    // Determine auth methods based on requirements
    this.inferAuthMethods(authData);
    
    // Set complexity based on number of requirements
    this.setComplexity(authData);
    
    return authData;
  }
  
  /**
   * Extract auth requirements from validation error messages
   */
  static extractFromValidationError(authData, errorMessage) {
    if (!errorMessage) return;
    
    console.log(`     🔍 Analyzing validation error: "${errorMessage}"`);
    
    // Common patterns for environment variable requirements
    const envVarPatterns = [
      // "Please set SLACK_BOT_TOKEN and SLACK_TEAM_ID environment variables"
      /please\s+set\s+([A-Z][A-Z0-9_,\s]+)\s+environment\s+variables?/i,
      // "Missing required environment variables: API_KEY, SECRET"
      /missing.*(?:required|environment).*variables?[:\s]+([A-Z][A-Z0-9_,\s]+)/i,
      // "Environment variable STRIPE_API_KEY is required"
      /environment\s+variables?\s+([A-Z][A-Z0-9_]+)\s+(?:is\s+)?required/i,
      // "Set the API_KEY environment variable"
      /set\s+(?:the\s+)?([A-Z][A-Z0-9_]+)\s+environment\s+variable/i,
      // "Set PRIVATE_APP_ACCESS_TOKEN in your environment variables"
      /set\s+([A-Z][A-Z0-9_]+)\s+in\s+your\s+environment\s+variables?/i,
      // "HubSpot access token is required. Set PRIVATE_APP_ACCESS_TOKEN"
      /(?:is\s+required.*)?set\s+([A-Z][A-Z0-9_]+)/i
    ];
    
    // Special patterns for command-line arguments that are actually env vars
    const commandLinePatterns = [
      // "Please provide a database URL as a command-line argument" → DATABASE_URL
      /please\s+provide\s+a?\s*(database\s+url|github\s+token|api\s+key|slack\s+token)/i,
      // "Missing database URL" → DATABASE_URL
      /missing\s+(database\s+url|github\s+token|api\s+key)/i,
      // "Requires database URL" → DATABASE_URL
      /requires?\s+(database\s+url|github\s+token|api\s+key)/i
    ];
    
    envVarPatterns.forEach(pattern => {
      const match = errorMessage.match(pattern);
      if (match) {
        authData.auth_required = true;
        
        // Parse the captured group for multiple variables
        const vars = match[1]
          .split(/[,\s]+/)
          .map(v => v.trim())
          .filter(v => v && /^[A-Z][A-Z0-9_]*$/.test(v));
        
        authData.required_env_vars.push(...vars);
        console.log(`     ✅ Found env vars: ${vars.join(', ')}`);
      }
    });
    
    // Process command-line argument patterns
    commandLinePatterns.forEach(pattern => {
      const match = errorMessage.match(pattern);
      if (match) {
        authData.auth_required = true;
        
        // Convert common phrases to environment variable names
        const phrase = match[1].toLowerCase().trim();
        let envVar = null;
        
        switch (phrase) {
          case 'database url':
            envVar = 'DATABASE_URL';
            break;
          case 'github token':
            envVar = 'GITHUB_TOKEN';
            break;
          case 'api key':
            envVar = 'API_KEY';
            break;
          case 'slack token':
            envVar = 'SLACK_TOKEN';
            break;
        }
        
        if (envVar) {
          authData.required_env_vars.push(envVar);
          console.log(`     ✅ Mapped "${phrase}" → ${envVar}`);
        }
      }
    });
    
    // Look for specific service mentions
    if (/api\s*key/i.test(errorMessage)) {
      authData.auth_methods.push('api_key');
    }
    
    if (/token/i.test(errorMessage)) {
      authData.auth_methods.push('bearer_token');
    }
    
    if (/oauth/i.test(errorMessage)) {
      authData.auth_methods.push('oauth2');
    }
  }
  
  /**
   * Extract auth requirements from documentation
   */
  static extractFromDocumentation(authData, documentation) {
    if (!documentation) return;
    
    const docLower = documentation.toLowerCase();
    
    // Check if authentication is mentioned
    if (/authentication|auth|api\s*key|token|credential/i.test(documentation)) {
      authData.auth_required = true;
    }
    
    // Extract environment variables from documentation
    const envVarRegex = /([A-Z][A-Z0-9_]{2,})\s*[=:]/g;
    let match;
    
    while ((match = envVarRegex.exec(documentation)) !== null) {
      const varName = match[1];
      
      // Skip obvious non-auth variables
      if (this.isAuthRelatedVar(varName)) {
        if (this.isRequiredVar(documentation, varName)) {
          authData.required_env_vars.push(varName);
        } else {
          authData.optional_env_vars.push(varName);
        }
      }
    }
    
    // Extract credential types needed
    this.extractCredentialTypes(authData, documentation);
    
    // Extract setup instructions
    this.extractSetupInstructions(authData, documentation);
    
    // Deduplicate arrays
    authData.required_env_vars = [...new Set(authData.required_env_vars)];
    authData.optional_env_vars = [...new Set(authData.optional_env_vars)];
    authData.auth_methods = [...new Set(authData.auth_methods)];
  }
  
  /**
   * Check if environment variable is auth-related
   */
  static isAuthRelatedVar(varName) {
    const authPatterns = [
      'API_KEY', 'SECRET', 'TOKEN', 'AUTH', 'CLIENT_ID', 'CLIENT_SECRET',
      'ACCESS_TOKEN', 'REFRESH_TOKEN', 'BEARER_TOKEN', 'JWT_SECRET',
      'WEBHOOK_SECRET', 'SIGNING_SECRET', 'PRIVATE_KEY', 'PUBLIC_KEY',
      'CREDENTIALS', 'PASSWORD', 'PASSPHRASE'
    ];
    
    return authPatterns.some(pattern => varName.includes(pattern));
  }
  
  /**
   * Check if variable is marked as required in documentation
   */
  static isRequiredVar(documentation, varName) {
    // Look for context around the variable
    const varContext = this.getVariableContext(documentation, varName);
    
    return /required|must|need|necessary/i.test(varContext) ||
           !/(optional|can|may|if.*want)/i.test(varContext);
  }
  
  /**
   * Get context around a variable mention
   */
  static getVariableContext(documentation, varName) {
    const lines = documentation.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(varName)) {
        // Get surrounding lines for context
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        return lines.slice(start, end).join(' ');
      }
    }
    
    return '';
  }
  
  /**
   * Extract what types of credentials are needed
   */
  static extractCredentialTypes(authData, documentation) {
    const credentialTypes = {
      'api_key': /api\s*key/i,
      'bearer_token': /bearer\s*token|access\s*token/i,
      'oauth2': /oauth|authorization\s*code/i,
      'webhook_secret': /webhook\s*secret/i,
      'client_credentials': /client\s*id.*client\s*secret/i,
      'database_connection': /database\s*url|connection\s*string/i,
      'service_account': /service\s*account|json\s*key/i
    };
    
    Object.entries(credentialTypes).forEach(([type, pattern]) => {
      if (pattern.test(documentation)) {
        authData.credentials_needed.push(type);
        if (!authData.auth_methods.includes(type)) {
          authData.auth_methods.push(type);
        }
      }
    });
  }
  
  /**
   * Extract setup instructions
   */
  static extractSetupInstructions(authData, documentation) {
    // Look for setup/configuration sections
    const setupSections = [
      /##?\s*(?:setup|configuration|authentication|getting\s*started)[\s\S]*?(?=##|$)/i,
      /authentication[\s\S]*?(?=##|\n\n|$)/i
    ];
    
    for (const pattern of setupSections) {
      const match = documentation.match(pattern);
      if (match) {
        authData.auth_instructions = this.cleanupInstructions(match[0]);
        break;
      }
    }
  }
  
  /**
   * Clean up extracted instructions
   */
  static cleanupInstructions(instructions) {
    return instructions
      .replace(/##?\s*[^\n]+\n?/g, '') // Remove headers
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
      .trim()
      .substring(0, 500); // Limit length
  }
  
  /**
   * Infer authentication methods from requirements
   */
  static inferAuthMethods(authData) {
    authData.required_env_vars.forEach(varName => {
      if (varName.includes('API_KEY')) {
        authData.auth_methods.push('api_key');
      } else if (varName.includes('TOKEN')) {
        authData.auth_methods.push('bearer_token');
      } else if (varName.includes('CLIENT_ID') || varName.includes('CLIENT_SECRET')) {
        authData.auth_methods.push('oauth2');
      } else if (varName.includes('WEBHOOK')) {
        authData.auth_methods.push('webhook_secret');
      }
    });
    
    // Deduplicate
    authData.auth_methods = [...new Set(authData.auth_methods)];
    
    // If no specific method detected but auth is required, default to api_key
    if (authData.auth_required && authData.auth_methods.length === 0) {
      authData.auth_methods.push('api_key');
    }
  }
  
  /**
   * Set complexity based on requirements
   */
  static setComplexity(authData) {
    const envVarCount = authData.required_env_vars.length;
    const methodCount = authData.auth_methods.length;
    
    if (envVarCount === 0) {
      authData.setup_complexity = 'simple';
    } else if (envVarCount <= 2 && methodCount <= 1) {
      authData.setup_complexity = 'simple';
    } else if (envVarCount <= 4 && methodCount <= 2) {
      authData.setup_complexity = 'moderate';
    } else {
      authData.setup_complexity = 'complex';
    }
  }
  
  /**
   * Generate human-readable auth summary for agents
   */
  static generateAuthSummary(authData) {
    if (!authData.auth_required) {
      return "No authentication required - ready to use immediately";
    }
    
    const parts = [];
    
    if (authData.required_env_vars.length > 0) {
      parts.push(`Requires ${authData.required_env_vars.length} environment variable${authData.required_env_vars.length > 1 ? 's' : ''}: ${authData.required_env_vars.join(', ')}`);
    }
    
    if (authData.credentials_needed.length > 0) {
      const credTypes = authData.credentials_needed.join(', ').replace(/_/g, ' ');
      parts.push(`Setup requires: ${credTypes}`);
    }
    
    parts.push(`Complexity: ${authData.setup_complexity}`);
    
    return parts.join('. ');
  }
}

module.exports = { AuthRequirementsExtractor };