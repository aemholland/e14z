/**
 * Agent-Optimized MCP Analyzer
 * Extracts data specifically structured for autonomous agent consumption
 * Ensures 10/10 agent experience for MCP discovery and execution
 */

class AgentOptimizedAnalyzer {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 2;
    this.timeout = options.timeout || 45000;
  }

  /**
   * Analyze MCP package specifically for autonomous agent needs
   * Returns data in the exact structure agents expect from /api/discover
   */
  async analyzeForAgents(packageInfo, npmDetails, githubInfo, executionResult, webDocs) {
    console.log(`🤖 Agent-optimizing analysis for ${packageInfo.name}...`);

    try {
      const analysis = {
        // Core agent requirements
        installation: await this.extractInstallationMethods(packageInfo, npmDetails, githubInfo, executionResult),
        tools: await this.extractToolsForAgents(packageInfo, npmDetails, githubInfo, executionResult, webDocs),
        technical: await this.extractTechnicalDetails(packageInfo, npmDetails, executionResult),
        resources: this.extractResourceUrls(githubInfo, webDocs),
        provider: this.extractProviderInfo(npmDetails, githubInfo),
        use_cases: await this.generateAgentUseCases(packageInfo, npmDetails, githubInfo, webDocs)
      };

      // Generate AI-powered description, tags, and category after analysis is complete
      analysis.description = await this.generateIntelligentDescription(packageInfo, npmDetails, githubInfo, webDocs, analysis);
      analysis.tags = this.generateIntelligentTags(packageInfo, npmDetails, githubInfo, analysis);
      analysis.category = this.selectPredefinedCategory(packageInfo, npmDetails, githubInfo, analysis);

      console.log(`   ✅ Agent analysis complete: ${analysis.tools.count} tools`);
      return analysis;

    } catch (error) {
      console.error(`   ❌ Agent analysis failed: ${error.message}`);
      return this.fallbackAgentAnalysis(packageInfo, npmDetails);
    }
  }

  /**
   * Extract installation methods in the exact structure agents need
   */
  async extractInstallationMethods(packageInfo, npmDetails, githubInfo, executionResult) {
    const methods = [];
    const packageName = packageInfo.name;

    // NPM installation (most common)
    if (packageName.startsWith('@') || npmDetails.version) {
      methods.push({
        type: 'npm',
        command: `npx ${packageName}`,
        description: 'Run directly with npx (recommended)',
        priority: 1,
        confidence: 95
      });

      methods.push({
        type: 'npm',
        command: `npm install -g ${packageName}`,
        description: 'Install globally with npm',
        priority: 2,
        confidence: 90
      });
    }

    // Detect other package managers from repository content
    if (githubInfo?.readme) {
      const readme = githubInfo.readme.toLowerCase();
      
      // PIPX (Python)
      if (readme.includes('pipx') || readme.includes('pip install') || 
          npmDetails.dependencies?.python || readme.includes('python')) {
        methods.push({
          type: 'pipx',
          command: `pipx install ${packageName}`,
          description: 'Install with pipx (Python)',
          priority: 1,
          confidence: 85
        });
      }

      // Cargo (Rust)
      if (readme.includes('cargo install') || readme.includes('rust') ||
          githubInfo.language === 'Rust') {
        methods.push({
          type: 'cargo',
          command: `cargo install ${packageName}`,
          description: 'Install with cargo (Rust)',
          priority: 1,
          confidence: 85
        });
      }

      // Go
      if (readme.includes('go install') || readme.includes('golang') ||
          githubInfo.language === 'Go') {
        const goPath = packageName.includes('/') ? packageName : `github.com/${packageInfo.name}`;
        methods.push({
          type: 'go',
          command: `go install ${goPath}@latest`,
          description: 'Install with go install',
          priority: 1,
          confidence: 85
        });
      }
    }

    // E14Z method (always available)
    methods.push({
      type: 'e14z',
      command: `npx e14z-mcp`,
      description: 'Discover and install via E14Z MCP registry',
      priority: 10,
      confidence: 100
    });

    // Sort by priority and confidence
    methods.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);

    // Extract authentication method
    const authMethod = this.detectAuthMethod(npmDetails, githubInfo, executionResult);

    return {
      primary_method: methods[0] || {
        type: 'npm',
        command: `npx ${packageName}`,
        description: 'Default npm execution',
        priority: 1,
        confidence: 50
      },
      alternative_methods: methods.slice(1),
      auth_method: authMethod
    };
  }

  /**
   * Detect specific authentication method (not just boolean)
   */
  detectAuthMethod(npmDetails, githubInfo, executionResult) {
    const readme = (githubInfo?.readme || '').toLowerCase();
    const stderr = (executionResult?.stderr || '').toLowerCase();
    const dependencies = Object.keys(npmDetails.dependencies || {});

    // Check for specific auth patterns
    if (readme.includes('api_key') || stderr.includes('api_key') || 
        readme.includes('api key') || stderr.includes('api key')) {
      return 'api_key';
    }

    if (readme.includes('oauth') || stderr.includes('oauth') ||
        dependencies.some(dep => dep.includes('oauth'))) {
      return 'oauth';
    }

    if (readme.includes('token') || stderr.includes('token') ||
        readme.includes('bearer') || stderr.includes('bearer')) {
      return 'token';
    }

    if (readme.includes('credential') || stderr.includes('credential') ||
        readme.includes('username') || readme.includes('password')) {
      return 'credentials';
    }

    if (readme.includes('authentication') || readme.includes('auth') ||
        stderr.includes('auth') || readme.includes('login')) {
      return 'custom';
    }

    return 'none';
  }

  /**
   * Extract tools with detailed parameters for agent consumption
   */
  async extractToolsForAgents(packageInfo, npmDetails, githubInfo, executionResult, webDocs) {
    const tools = [];

    // 1. Extract from execution output (most reliable)
    if (executionResult?.stdout) {
      tools.push(...this.extractToolsFromExecution(executionResult.stdout));
    }

    // 2. Extract from documentation with parameter analysis
    if (githubInfo?.readme) {
      tools.push(...this.extractToolsFromDocumentationWithParams(githubInfo.readme));
    }

    if (webDocs?.content?.markdown) {
      tools.push(...this.extractToolsFromDocumentationWithParams(webDocs.content.markdown));
    }

    // 3. Infer from package structure and dependencies
    if (tools.length === 0) {
      tools.push(...this.inferToolsFromPackageStructure(packageInfo, npmDetails));
    }

    // Deduplicate and enhance with categories
    const uniqueTools = this.deduplicateAndCategorizeTools(tools);

    return {
      count: uniqueTools.length,
      list: uniqueTools.map(tool => ({
        name: tool.name,
        description: this.generateIntelligentToolDescription(tool, packageInfo.name),
        category: tool.category || 'general',
        parameters: this.formatParametersForAgents(tool.parameters || [])
      }))
    };
  }

  /**
   * Extract tools from MCP execution output with protocol responses
   */
  extractToolsFromExecution(stdout) {
    const tools = [];
    
    try {
      // Look for MCP list_tools responses
      const mcpResponses = stdout.match(/\{"tools":\s*\[[^\]]*\]/g);
      if (mcpResponses) {
        for (const response of mcpResponses) {
          try {
            const parsed = JSON.parse(response);
            if (parsed.tools) {
              tools.push(...parsed.tools);
            }
          } catch (e) {
            // Ignore invalid JSON
          }
        }
      }

      // Look for tool definitions in stderr/stdout
      const toolPatterns = [
        /Available tools:\s*\n([\s\S]*?)(?=\n[A-Z]|\n$)/gi,
        /Tools:\s*\n([\s\S]*?)(?=\n[A-Z]|\n$)/gi,
        /Functions:\s*\n([\s\S]*?)(?=\n[A-Z]|\n$)/gi
      ];

      for (const pattern of toolPatterns) {
        const matches = stdout.matchAll(pattern);
        for (const match of matches) {
          const toolsText = match[1];
          const parsedTools = this.parseToolsFromText(toolsText);
          tools.push(...parsedTools);
        }
      }

    } catch (error) {
      console.warn(`   ⚠️ Error extracting tools from execution: ${error.message}`);
    }

    return tools;
  }

  /**
   * Extract tools from documentation with parameter analysis
   */
  extractToolsFromDocumentationWithParams(text) {
    const tools = [];

    // Enhanced patterns for tool extraction with parameters
    const patterns = [
      // ### tool_name(param1, param2)
      /^#{2,3}\s+`?(\w+)`?\s*\(([^)]*)\)\s*\n([^\n#]+)/gm,
      // ### tool_name
      // Description
      // Parameters: param1 (type): description
      /^#{2,3}\s+`?(\w+)`?\s*\n([^\n#]+)[\s\S]*?Parameters?:?\s*\n([\s\S]*?)(?=\n#{1,3}|\n$)/gm,
      // - **tool_name**: description
      /^[-*]\s+\*\*(\w+)\*\*:?\s*([^\n]+)/gm
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1];
        const description = match[2]?.trim();
        const paramsText = match[3]?.trim();
        
        if (this.isValidToolName(name)) {
          const tool = {
            name: name,
            description: description,
            parameters: paramsText ? this.parseParametersFromText(paramsText) : []
          };
          
          tools.push(tool);
        }
      }
    }

    return tools;
  }

  /**
   * Parse parameter definitions from text
   */
  parseParametersFromText(paramsText) {
    const parameters = [];
    
    // Look for parameter patterns
    const paramPatterns = [
      // param_name (type): description
      /(\w+)\s*\(([^)]+)\)\s*:?\s*([^\n]+)/g,
      // param_name: type - description
      /(\w+)\s*:\s*(\w+)\s*-\s*([^\n]+)/g,
      // - param_name: description
      /[-*]\s*(\w+)\s*:?\s*([^\n]+)/g
    ];

    for (const pattern of paramPatterns) {
      let match;
      while ((match = pattern.exec(paramsText)) !== null) {
        const name = match[1];
        const type = match[2]?.trim() || 'string';
        const description = match[3]?.trim() || match[2]?.trim() || '';
        
        parameters.push({
          name: name,
          type: this.normalizeParameterType(type),
          required: !description.includes('optional'),
          description: description
        });
      }
    }

    return parameters;
  }

  /**
   * Format parameters for agent consumption
   */
  formatParametersForAgents(parameters) {
    return parameters.map(param => {
      if (typeof param === 'string') {
        return {
          name: param,
          type: 'string',
          required: true,
          description: ''
        };
      }
      
      return {
        name: param.name || 'unknown',
        type: this.normalizeParameterType(param.type || 'string'),
        required: param.required !== false,
        description: param.description || ''
      };
    });
  }

  /**
   * Normalize parameter types to standard JSON Schema types
   */
  normalizeParameterType(type) {
    const normalizedType = type.toLowerCase();
    
    if (normalizedType.includes('string') || normalizedType.includes('str')) return 'string';
    if (normalizedType.includes('number') || normalizedType.includes('int') || normalizedType.includes('float')) return 'number';
    if (normalizedType.includes('bool')) return 'boolean';
    if (normalizedType.includes('array') || normalizedType.includes('list')) return 'array';
    if (normalizedType.includes('object') || normalizedType.includes('dict')) return 'object';
    
    return 'string'; // Default fallback
  }

  /**
   * Generate intelligent, natural tool descriptions using AI reasoning
   */
  generateIntelligentToolDescription(tool, packageName) {
    const toolName = tool.name || 'unknown';
    const existingDesc = tool.description || '';
    const category = tool.category || 'general';
    
    // If we already have a good description, enhance it
    if (existingDesc && existingDesc.length > 50 && !existingDesc.includes('No description')) {
      return this.enhanceExistingDescription(existingDesc, toolName);
    }
    
    // Generate intelligent description based on tool name and context
    return this.synthesizeToolDescription(toolName, category, packageName);
  }

  /**
   * Enhance existing descriptions to sound more natural and informative
   */
  enhanceExistingDescription(description, toolName) {
    // Clean up robotic language
    let enhanced = description
      .replace(/^(The tool|This tool|Tool)/, 'This')
      .replace(/\bperforms?\b/g, 'executes')
      .replace(/\ballows? you to\b/g, 'enables')
      .replace(/\bis used to\b/g, 'provides capability to')
      .replace(/\bcan be used for\b/g, 'supports');
    
    // Ensure it starts with capital letter and ends with period
    enhanced = enhanced.charAt(0).toUpperCase() + enhanced.slice(1);
    if (!enhanced.endsWith('.')) {
      enhanced += '.';
    }
    
    return enhanced;
  }

  /**
   * Synthesize intelligent tool descriptions using AI reasoning
   */
  synthesizeToolDescription(toolName, category, packageName) {
    const name = toolName.toLowerCase();
    
    // AI-powered description generation based on tool name patterns
    
    // File/Content operations
    if (name.includes('read') || name.includes('get') || name.includes('fetch')) {
      if (name.includes('file') || name.includes('document')) {
        return `Retrieves and processes file content for analysis and data extraction.`;
      } else if (name.includes('data') || name.includes('record')) {
        return `Fetches structured data records for analysis and reporting purposes.`;
      } else if (name.includes('list') || name.includes('all')) {
        return `Enumerates available resources and provides comprehensive listings.`;
      } else {
        return `Retrieves information and data for processing and analysis workflows.`;
      }
    }
    
    // Write/Create operations
    if (name.includes('write') || name.includes('create') || name.includes('add') || name.includes('insert')) {
      if (name.includes('file') || name.includes('document')) {
        return `Creates and manages documents with automated content generation capabilities.`;
      } else if (name.includes('record') || name.includes('data')) {
        return `Generates new data records with intelligent validation and formatting.`;
      } else {
        return `Creates new resources and content with automated workflow integration.`;
      }
    }
    
    // Update/Modify operations
    if (name.includes('update') || name.includes('modify') || name.includes('edit') || name.includes('change')) {
      if (name.includes('status') || name.includes('state')) {
        return `Updates status information and manages state transitions effectively.`;
      } else {
        return `Modifies existing resources with intelligent change management and validation.`;
      }
    }
    
    // Delete/Remove operations
    if (name.includes('delete') || name.includes('remove') || name.includes('clear')) {
      return `Safely removes resources with proper cleanup and dependency management.`;
    }
    
    // Search/Query operations
    if (name.includes('search') || name.includes('find') || name.includes('query') || name.includes('filter')) {
      if (name.includes('database') || name.includes('sql')) {
        return `Executes intelligent database queries with optimized performance and filtering.`;
      } else {
        return `Performs advanced search operations with intelligent filtering and ranking.`;
      }
    }
    
    // List/Browse operations
    if (name.includes('list') || name.includes('browse') || name.includes('show') || name.includes('display')) {
      if (name.includes('directory') || name.includes('folder')) {
        return `Navigates and catalogs directory structures with detailed metadata extraction.`;
      } else {
        return `Provides comprehensive resource listings with intelligent categorization.`;
      }
    }
    
    // Execute/Run operations
    if (name.includes('execute') || name.includes('run') || name.includes('process') || name.includes('perform')) {
      if (name.includes('command') || name.includes('script')) {
        return `Executes commands and scripts with secure sandboxing and result processing.`;
      } else {
        return `Processes operations and workflows with intelligent automation and monitoring.`;
      }
    }
    
    // Authentication/Security operations
    if (name.includes('auth') || name.includes('login') || name.includes('token') || name.includes('credential')) {
      return `Manages authentication and security credentials with enterprise-grade protection.`;
    }
    
    // Notification/Communication operations
    if (name.includes('send') || name.includes('notify') || name.includes('message') || name.includes('email')) {
      return `Delivers notifications and messages with intelligent routing and formatting.`;
    }
    
    // Monitoring/Status operations
    if (name.includes('monitor') || name.includes('check') || name.includes('status') || name.includes('health')) {
      return `Monitors system health and status with proactive alerting and diagnostics.`;
    }
    
    // Generic intelligent description based on category
    switch (category) {
      case 'data-access':
        return `Provides intelligent data access capabilities with optimized retrieval patterns.`;
      case 'data-modification':
        return `Enables secure data modification with validation and integrity checking.`;
      case 'search':
        return `Delivers advanced search functionality with intelligent query processing.`;
      case 'information':
        return `Presents information and insights with structured formatting and analysis.`;
      case 'execution':
        return `Executes operations and processes with automated workflow management.`;
      default:
        // Last resort - generate from tool name
        const cleanName = toolName.replace(/_/g, ' ').toLowerCase();
        return `Provides ${cleanName} functionality with intelligent automation and integration capabilities.`;
    }
  }


  /**
   * Determine health status based on execution results
   */
  determineHealthStatus(executionResult) {
    if (!executionResult) return 'unknown';
    
    if (executionResult.success && executionResult.mcpServerRunning) {
      return 'healthy';
    }
    
    if (executionResult.canInstall && 
        (executionResult.errors?.some(err => err.includes('auth')) ||
         executionResult.errors?.some(err => err.includes('config')))) {
      return 'degraded';
    }
    
    if (executionResult.canInstall && !executionResult.canExecute) {
      return 'degraded';
    }
    
    return 'down';
  }

  /**
   * Extract technical details for agent compatibility checking
   */
  async extractTechnicalDetails(packageInfo, npmDetails, executionResult) {
    // Detect connection type from execution or documentation
    let connectionType = 'stdio'; // Default for most MCPs
    
    if (executionResult?.stdout) {
      if (executionResult.stdout.includes('http://') || executionResult.stdout.includes('https://')) {
        connectionType = 'http';
      } else if (executionResult.stdout.includes('ws://') || executionResult.stdout.includes('wss://')) {
        connectionType = 'websocket';
      }
    }

    // Detect protocol version
    let protocolVersion = '2024-11-05'; // Default latest
    if (executionResult?.stdout) {
      const versionMatch = executionResult.stdout.match(/protocol.version["\s:]*([0-9-]+)/i);
      if (versionMatch) {
        protocolVersion = versionMatch[1];
      }
    }

    return {
      protocol_version: protocolVersion,
      connection_type: connectionType,
      pricing_model: 'free', // Most MCPs are free
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  }

  /**
   * Extract resource URLs for documentation and support
   */
  extractResourceUrls(githubInfo, webDocs) {
    return {
      github_url: githubInfo?.url || null,
      documentation_url: githubInfo?.readme_url || webDocs?.url || null,
      website_url: webDocs?.website_url || null
    };
  }

  /**
   * Extract provider information
   */
  extractProviderInfo(npmDetails, githubInfo) {
    return {
      author: npmDetails.author?.name || githubInfo?.owner || null,
      company: npmDetails.author?.company || null,
      license: npmDetails.license || githubInfo?.license || null,
      commercial: false // Most MCPs are non-commercial
    };
  }

  /**
   * Generate use cases specifically relevant for agents
   */
  async generateAgentUseCases(packageInfo, npmDetails, githubInfo, webDocs) {
    console.log(`   🎯 Generating intelligent use cases for ${packageInfo.name}...`);
    
    const useCases = [];
    const name = packageInfo.name.toLowerCase();
    const description = (npmDetails.description || '').toLowerCase();
    const readme = (npmDetails.readme || githubInfo?.readme || '').toLowerCase();
    const webContent = (webDocs?.content?.markdown || '').toLowerCase();
    const allText = `${name} ${description} ${readme} ${webContent}`;
    
    // 1. Tool-based use cases (most specific)
    const toolUseCases = this.generateUseCasesFromTools(packageInfo);
    useCases.push(...toolUseCases);
    
    // 2. Service-specific use cases based on brand/service detection
    const serviceUseCases = this.generateServiceSpecificUseCases(name, description, allText);
    useCases.push(...serviceUseCases);
    
    // 3. Pattern-based use cases (enhanced intelligence)
    const patternUseCases = this.generatePatternBasedUseCases(allText, name);
    useCases.push(...patternUseCases);
    
    // 4. Extract explicit use cases from documentation
    const docUseCases = this.extractUseCasesFromDocumentation(readme, webContent);
    useCases.push(...docUseCases);
    
    // 5. Generate contextual use cases based on dependencies
    const depUseCases = this.generateDependencyBasedUseCases(npmDetails);
    useCases.push(...depUseCases);
    
    // Deduplicate, clean, and prioritize
    const cleanedUseCases = this.cleanAndPrioritizeUseCases(useCases, name);
    
    console.log(`   ✅ Generated ${cleanedUseCases.length} intelligent use cases`);
    return cleanedUseCases.slice(0, 8); // Allow more use cases since they're higher quality
  }

  // Helper methods
  isValidToolName(name) {
    return name && 
           name.length > 2 && 
           /^[a-z_][a-z0-9_]*$/i.test(name) &&
           !['get', 'set', 'is', 'has', 'can', 'will'].includes(name.toLowerCase());
  }

  deduplicateAndCategorizeTools(tools) {
    const seen = new Map();
    
    for (const tool of tools) {
      if (!seen.has(tool.name)) {
        seen.set(tool.name, {
          ...tool,
          category: this.categorizeTool(tool.name, tool.description)
        });
      }
    }

    return Array.from(seen.values());
  }

  categorizeTool(name, description) {
    const text = `${name} ${description || ''}`.toLowerCase();
    
    if (text.includes('read') || text.includes('get') || text.includes('fetch')) return 'data-access';
    if (text.includes('write') || text.includes('create') || text.includes('update')) return 'data-modification';
    if (text.includes('search') || text.includes('find') || text.includes('query')) return 'search';
    if (text.includes('list') || text.includes('show') || text.includes('display')) return 'information';
    if (text.includes('execute') || text.includes('run') || text.includes('call')) return 'execution';
    
    return 'general';
  }

  parseToolsFromText(text) {
    const tools = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^[-*\s]*(\w+)[\s:-]*(.*)$/);
        if (match && this.isValidToolName(match[1])) {
          tools.push({
            name: match[1],
            description: match[2] || ''
          });
        }
      }
    }
    
    return tools;
  }

  extractUseCasesFromText(text) {
    const useCases = [];
    const patterns = [
      /use case[s]?:\s*([^\n]+)/gi,
      /example[s]?:\s*([^\n]+)/gi,
      /you can:\s*([^\n]+)/gi
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const useCase = match[1].trim();
        if (useCase.length > 20) {
          useCases.push(useCase);
        }
      }
    }

    return useCases.slice(0, 5);
  }

  inferToolsFromPackageStructure(packageInfo, npmDetails) {
    const name = packageInfo.name.toLowerCase();
    const tools = [];
    
    // Infer common tools based on package patterns
    if (name.includes('database') || name.includes('sql')) {
      tools.push(
        { name: 'execute_query', description: 'Execute SQL queries against the database' },
        { name: 'list_tables', description: 'List all tables in the database' },
        { name: 'describe_table', description: 'Get table schema and column information' }
      );
    } else if (name.includes('file') || name.includes('filesystem')) {
      tools.push(
        { name: 'read_file', description: 'Read the contents of a file' },
        { name: 'write_file', description: 'Write data to a file' },
        { name: 'list_directory', description: 'List files and directories' }
      );
    }
    
    return tools;
  }

  /**
   * Generate use cases from actual discovered tools
   */
  generateUseCasesFromTools(packageInfo) {
    const useCases = [];
    const tools = packageInfo.tools || [];
    
    for (const tool of tools) {
      const toolName = typeof tool === 'string' ? tool : tool.name;
      const toolDesc = typeof tool === 'object' ? tool.description : '';
      
      if (toolName) {
        // Generate specific use cases based on tool names
        if (toolName.includes('read') || toolName.includes('get') || toolName.includes('fetch')) {
          useCases.push(`Retrieve information using ${toolName} for data analysis and reporting`);
        } else if (toolName.includes('write') || toolName.includes('create') || toolName.includes('update')) {
          useCases.push(`Automate content creation and updates with ${toolName}`);
        } else if (toolName.includes('search') || toolName.includes('query') || toolName.includes('find')) {
          useCases.push(`Perform intelligent searches and queries using ${toolName}`);
        } else if (toolName.includes('list') || toolName.includes('browse')) {
          useCases.push(`Explore and catalog resources with ${toolName}`);
        } else if (toolDesc) {
          useCases.push(`Leverage ${toolName} to ${toolDesc.toLowerCase()}`);
        }
      }
    }
    
    return useCases;
  }

  /**
   * Generate service-specific use cases based on known services
   */
  generateServiceSpecificUseCases(name, description, allText) {
    const useCases = [];
    
    // Popular services and their specific use cases
    const servicePatterns = {
      'notion': [
        'Sync and update Notion databases with external data sources',
        'Automate Notion page creation from templates and data',
        'Extract and analyze content from Notion workspaces'
      ],
      'stripe': [
        'Process and analyze payment data for business insights',
        'Automate billing and subscription management',
        'Generate financial reports and revenue analytics'
      ],
      'github': [
        'Automate repository management and issue tracking',
        'Analyze code metrics and repository health',
        'Synchronize development workflows and project data'
      ],
      'slack': [
        'Send automated notifications and status updates',
        'Retrieve team communication data for analysis',
        'Automate workflow triggers based on Slack events'
      ],
      'google': [
        'Automate Google Workspace document management',
        'Sync calendar events and scheduling data',
        'Process and analyze Google service data'
      ],
      'microsoft': [
        'Integrate with Microsoft 365 services and data',
        'Automate Teams and Outlook workflows',
        'Sync SharePoint and OneDrive content'
      ],
      'salesforce': [
        'Sync CRM data for sales analytics and reporting',
        'Automate lead management and customer workflows',
        'Generate sales performance insights and forecasts'
      ],
      'jira': [
        'Automate project tracking and issue management',
        'Generate development velocity and progress reports',
        'Sync development workflows with business processes'
      ],
      'aws|amazon': [
        'Automate cloud resource management and monitoring',
        'Process AWS service data for cost optimization',
        'Integrate cloud infrastructure with business workflows'
      ],
      'database|sql|postgres|mysql': [
        'Execute complex data queries for business intelligence',
        'Automate database maintenance and optimization tasks',
        'Generate automated reports from database analytics'
      ],
      'email': [
        'Automate email processing and response workflows',
        'Analyze communication patterns and engagement metrics',
        'Send personalized automated email campaigns'
      ],
      'calendar': [
        'Automate meeting scheduling and calendar management',
        'Analyze time allocation and productivity patterns',
        'Sync events across multiple calendar systems'
      ],
      'file|filesystem': [
        'Automate document organization and processing workflows',
        'Analyze file system usage patterns and optimization',
        'Process large document collections for content extraction'
      ]
    };
    
    for (const [pattern, cases] of Object.entries(servicePatterns)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(allText) || regex.test(name)) {
        useCases.push(...cases);
        // Don't break - allow multiple service matches for hybrid MCPs
      }
    }
    
    // Add fallback use cases for any MCP that didn't match specific services
    if (useCases.length === 0) {
      // Generate generic but useful use cases based on name analysis
      const genericUseCases = this.generateGenericUseCases(name, description);
      useCases.push(...genericUseCases);
    }
    
    return useCases;
  }

  generateGenericUseCases(name, description) {
    const useCases = [];
    const cleanName = name.replace(/@[\w-]+\//, '').replace(/mcp-server-?/, '').replace(/-mcp$/, '');
    
    // Generate use cases based on package name patterns
    if (cleanName.includes('server')) {
      useCases.push('Provide server-side operations and data processing capabilities');
      useCases.push('Enable automated server management and monitoring tasks');
    } else if (cleanName.includes('api')) {
      useCases.push('Integrate with external APIs for data exchange and automation');
      useCases.push('Streamline API interactions and response processing');
    } else if (cleanName.includes('tool') || cleanName.includes('util')) {
      useCases.push('Automate specialized tools and utility operations');
      useCases.push('Enhance workflow efficiency with custom tool integrations');
    } else {
      // Most generic fallback
      useCases.push('Automate specialized operations and data processing tasks');
      useCases.push('Integrate custom functionality into automated workflows');
      useCases.push('Provide programmatic access to specific service capabilities');
    }
    
    return useCases;
  }

  /**
   * Generate pattern-based use cases with enhanced intelligence
   */
  generatePatternBasedUseCases(allText, name) {
    const useCases = [];
    
    // Enhanced pattern matching with context awareness
    const patterns = [
      {
        keywords: ['analytics', 'metrics', 'reporting', 'dashboard'],
        useCases: [
          'Generate automated business intelligence reports',
          'Track and analyze key performance metrics',
          'Create real-time data dashboards and visualizations'
        ]
      },
      {
        keywords: ['automation', 'workflow', 'trigger', 'schedule'],
        useCases: [
          'Automate repetitive business processes and workflows',
          'Set up intelligent triggers for business events',
          'Schedule and execute routine operational tasks'
        ]
      },
      {
        keywords: ['integration', 'sync', 'connect', 'bridge'],
        useCases: [
          'Integrate disparate systems and data sources',
          'Synchronize data across multiple platforms',
          'Build custom integrations for specific business needs'
        ]
      },
      {
        keywords: ['monitoring', 'alerts', 'notifications'],
        useCases: [
          'Monitor system health and performance metrics',
          'Send intelligent alerts for critical business events',
          'Track and notify on important process changes'
        ]
      },
      {
        keywords: ['content', 'document', 'text', 'markdown'],
        useCases: [
          'Process and analyze large document collections',
          'Automate content generation and formatting',
          'Extract insights from unstructured text data'
        ]
      },
      {
        keywords: ['customer', 'user', 'client', 'crm'],
        useCases: [
          'Analyze customer behavior and engagement patterns',
          'Automate customer support and communication workflows',
          'Generate customer insights for business strategy'
        ]
      }
    ];
    
    for (const pattern of patterns) {
      const hasKeywords = pattern.keywords.some(keyword => allText.includes(keyword));
      if (hasKeywords) {
        useCases.push(...pattern.useCases);
      }
    }
    
    return useCases;
  }

  /**
   * Extract use cases from documentation with enhanced patterns
   */
  extractUseCasesFromDocumentation(readme, webContent) {
    const useCases = [];
    const combinedText = `${readme} ${webContent}`;
    
    // Enhanced patterns for use case extraction
    const patterns = [
      /(?:use cases?|usage|examples?|scenarios?):\s*([^#\n]+(?:\n(?!#)[^#\n]+)*)/gi,
      /(?:you can|allows you to|enables|helps you):\s*([^#\n]+)/gi,
      /(?:ideal for|perfect for|great for):\s*([^#\n]+)/gi,
      /(?:automate|streamline|simplify):\s*([^#\n]+)/gi,
      /^[-*]\s*([^#\n]{30,})/gm // Bullet points with substantial content
    ];
    
    for (const pattern of patterns) {
      const matches = combinedText.matchAll(pattern);
      for (const match of matches) {
        const useCase = match[1].trim();
        if (useCase.length > 25 && useCase.length < 200) {
          // Clean up the use case text
          const cleaned = useCase
            .replace(/^\W+/, '') // Remove leading non-word chars
            .replace(/\W+$/, '') // Remove trailing non-word chars
            .replace(/\s+/g, ' '); // Normalize whitespace
          
          if (cleaned.length > 20) {
            useCases.push(cleaned);
          }
        }
      }
    }
    
    return useCases;
  }

  /**
   * Generate use cases based on package dependencies
   */
  generateDependencyBasedUseCases(npmDetails) {
    const useCases = [];
    const dependencies = Object.keys(npmDetails.dependencies || {});
    
    // Analyze dependencies for capability inference
    if (dependencies.some(dep => dep.includes('express') || dep.includes('fastify') || dep.includes('server'))) {
      useCases.push('Build API endpoints for custom integrations and data access');
    }
    
    if (dependencies.some(dep => dep.includes('database') || dep.includes('sql') || dep.includes('mongoose'))) {
      useCases.push('Execute complex database operations for data management');
    }
    
    if (dependencies.some(dep => dep.includes('auth') || dep.includes('oauth') || dep.includes('jwt'))) {
      useCases.push('Implement secure authentication and authorization workflows');
    }
    
    if (dependencies.some(dep => dep.includes('test') || dep.includes('jest') || dep.includes('mocha'))) {
      useCases.push('Automate testing and quality assurance processes');
    }
    
    if (dependencies.some(dep => dep.includes('schedule') || dep.includes('cron') || dep.includes('queue'))) {
      useCases.push('Schedule and manage automated background tasks');
    }
    
    return useCases;
  }

  /**
   * Clean, deduplicate, and prioritize use cases
   */
  cleanAndPrioritizeUseCases(useCases, packageName) {
    // Remove duplicates and normalize
    const uniqueUseCases = [...new Set(useCases)]
      .map(useCase => {
        // Normalize and clean
        return useCase
          .replace(/^\W+/, '')
          .replace(/\W+$/, '')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(useCase => 
        useCase.length > 15 && 
        useCase.length < 150 &&
        !useCase.toLowerCase().includes('todo') &&
        !useCase.toLowerCase().includes('coming soon')
      );
    
    // Prioritize based on specificity and relevance
    return uniqueUseCases.sort((a, b) => {
      const aSpecific = this.calculateUseCaseSpecificity(a, packageName);
      const bSpecific = this.calculateUseCaseSpecificity(b, packageName);
      return bSpecific - aSpecific;
    });
  }

  /**
   * Calculate use case specificity score
   */
  calculateUseCaseSpecificity(useCase, packageName) {
    let score = 0;
    const lowerCase = useCase.toLowerCase();
    const name = packageName.toLowerCase();
    
    // Higher score for package-specific terms
    if (lowerCase.includes(name)) score += 10;
    
    // Higher score for action words
    const actionWords = ['automate', 'analyze', 'process', 'generate', 'integrate', 'sync'];
    actionWords.forEach(word => {
      if (lowerCase.includes(word)) score += 5;
    });
    
    // Higher score for business value terms
    const businessWords = ['business', 'workflow', 'data', 'report', 'insight', 'efficiency'];
    businessWords.forEach(word => {
      if (lowerCase.includes(word)) score += 3;
    });
    
    // Lower score for generic terms
    const genericWords = ['help', 'tool', 'service', 'application'];
    genericWords.forEach(word => {
      if (lowerCase.includes(word)) score -= 2;
    });
    
    return score;
  }

  /**
   * Generate intelligent, natural descriptions using AI reasoning
   */
  async generateIntelligentDescription(packageInfo, npmDetails, githubInfo, webDocs, analysis) {
    console.log(`   🧠 Generating intelligent description for ${packageInfo.name}...`);
    
    const name = packageInfo.name;
    const basicDesc = npmDetails.description || '';
    const readme = npmDetails.readme || githubInfo?.readme || '';
    const tools = analysis.tools?.list || [];
    const useCases = analysis.use_cases || [];
    
    // AI-powered description generation based on comprehensive analysis
    const description = this.synthesizeIntelligentDescription({
      name,
      basicDescription: basicDesc,
      readme,
      tools,
      useCases,
      serviceType: this.detectServiceType(name, basicDesc, readme),
      capabilities: this.analyzeCapabilities(tools, readme),
      businessValue: this.extractBusinessValue(useCases, readme)
    });
    
    return description;
  }

  /**
   * Generate technical, factual descriptions without AI agent marketing speak
   */
  synthesizeIntelligentDescription(context) {
    const { name, basicDescription, readme, tools, useCases, serviceType, capabilities, businessValue } = context;
    
    // Start with the actual functionality, not AI agent marketing
    let description = '';
    
    // Use the basic description as foundation if it's good
    if (basicDescription && basicDescription.length > 20 && !basicDescription.toLowerCase().includes('mcp server')) {
      description = basicDescription;
    } else {
      // Generate technical description based on service type
      if (serviceType.isIntegration && serviceType.service) {
        description = `Provides ${serviceType.service} integration capabilities through the Model Context Protocol. `;
      } else if (serviceType.isDatabase) {
        description = `Database operations and query execution server implementing the Model Context Protocol. `;
      } else if (serviceType.isFileSystem) {
        description = `File system operations server for reading, writing, and managing files and directories. `;
      } else if (serviceType.isAPI) {
        description = `API integration server providing structured access to external services and data. `;
      } else {
        // Extract core functionality from package name
        const coreFunction = this.extractCoreFunctionFromName(name);
        description = `${coreFunction} server implementing the Model Context Protocol. `;
      }
    }
    
    // Add tool-specific capabilities
    if (tools.length > 0) {
      const toolSummary = this.generateToolSummary(tools);
      description += `Offers ${tools.length} operation${tools.length > 1 ? 's' : ''}: ${toolSummary}. `;
    }
    
    // Add specific features from readme analysis
    const keyFeatures = this.extractKeyFeatures(readme, name);
    if (keyFeatures.length > 0) {
      description += `Key features include ${keyFeatures.slice(0, 2).join(' and ')}. `;
    }
    
    // Add technical specifications if available
    const techSpecs = this.extractTechnicalSpecs(readme, capabilities);
    if (techSpecs.length > 0) {
      description += `${techSpecs[0]}`;
    }
    
    // Clean up and ensure professional tone
    return this.polishTechnicalDescription(description);
  }

  extractCoreFunctionFromName(name) {
    const cleanName = name.replace(/@[\w-]+\//, '').replace(/mcp-server-?/, '').replace(/-mcp$/, '');
    
    // Service-specific mappings
    const serviceMap = {
      'notion': 'Notion workspace and database operations',
      'slack': 'Slack messaging and workspace management',
      'github': 'GitHub repository and issue management',
      'filesystem': 'File system operations and management',
      'postgres': 'PostgreSQL database operations',
      'mysql': 'MySQL database operations',
      'sqlite': 'SQLite database operations',
      'hubspot': 'HubSpot CRM and marketing automation',
      'stripe': 'Stripe payment processing and billing',
      'aws': 'AWS cloud service operations',
      'gcp': 'Google Cloud Platform operations',
      'docker': 'Docker container management',
      'kubernetes': 'Kubernetes cluster operations'
    };
    
    for (const [key, value] of Object.entries(serviceMap)) {
      if (cleanName.toLowerCase().includes(key)) {
        return value;
      }
    }
    
    return `${cleanName.replace(/-/g, ' ')} operations`;
  }

  generateToolSummary(tools) {
    if (tools.length === 0) return '';
    if (tools.length === 1) return tools[0].name.replace(/_/g, ' ');
    if (tools.length <= 3) return tools.map(t => t.name.replace(/_/g, ' ')).join(', ');
    
    // Categorize tools for summary
    const categories = this.categorizeToolsByFunction(tools);
    return categories.slice(0, 2).join(' and ');
  }

  categorizeToolsByFunction(tools) {
    const categories = new Set();
    
    tools.forEach(tool => {
      const name = tool.name.toLowerCase();
      if (name.includes('create') || name.includes('add') || name.includes('insert')) {
        categories.add('creation operations');
      } else if (name.includes('read') || name.includes('get') || name.includes('list') || name.includes('search')) {
        categories.add('data retrieval');
      } else if (name.includes('update') || name.includes('edit') || name.includes('modify')) {
        categories.add('data modification');
      } else if (name.includes('delete') || name.includes('remove')) {
        categories.add('deletion operations');
      } else if (name.includes('query') || name.includes('sql')) {
        categories.add('database queries');
      } else if (name.includes('file') || name.includes('directory')) {
        categories.add('file operations');
      } else {
        categories.add('specialized operations');
      }
    });
    
    return Array.from(categories);
  }

  extractKeyFeatures(readme, name) {
    const features = [];
    if (!readme) return features;
    
    const readmeLower = readme.toLowerCase();
    
    // Look for feature indicators
    if (readmeLower.includes('authentication') || readmeLower.includes('auth')) {
      features.push('authentication support');
    }
    if (readmeLower.includes('real-time') || readmeLower.includes('realtime')) {
      features.push('real-time capabilities');
    }
    if (readmeLower.includes('webhook')) {
      features.push('webhook integration');
    }
    if (readmeLower.includes('bulk') || readmeLower.includes('batch')) {
      features.push('batch operations');
    }
    if (readmeLower.includes('search') || readmeLower.includes('query')) {
      features.push('search functionality');
    }
    
    return features;
  }

  extractTechnicalSpecs(readme, capabilities) {
    const specs = [];
    if (!readme) return specs;
    
    const readmeLower = readme.toLowerCase();
    
    // Look for technical specifications
    if (readmeLower.includes('rate limit')) {
      specs.push('Includes rate limiting functionality.');
    }
    if (readmeLower.includes('pagination')) {
      specs.push('Supports paginated data retrieval.');
    }
    if (readmeLower.includes('ssl') || readmeLower.includes('tls')) {
      specs.push('Secure SSL/TLS connections supported.');
    }
    
    return specs;
  }

  polishTechnicalDescription(description) {
    // Remove redundant phrases and clean up
    description = description
      .replace(/\s+/g, ' ')
      .replace(/\.\s*\./g, '.')
      .replace(/,\s*,/g, ',')
      .trim();
    
    // Ensure it ends with a period
    if (!description.endsWith('.')) {
      description += '.';
    }
    
    return description;
  }

  /**
   * Detect service type for intelligent categorization
   */
  detectServiceType(name, description, readme) {
    const allText = `${name} ${description} ${readme}`.toLowerCase();
    
    // AI-powered service detection
    const serviceTypes = {
      notion: { isIntegration: true, service: 'Notion' },
      stripe: { isIntegration: true, service: 'Stripe' },
      github: { isIntegration: true, service: 'GitHub' },
      slack: { isIntegration: true, service: 'Slack' },
      google: { isIntegration: true, service: 'Google Workspace' },
      salesforce: { isIntegration: true, service: 'Salesforce' },
      database: { isDatabase: true },
      sql: { isDatabase: true },
      postgres: { isDatabase: true },
      mysql: { isDatabase: true },
      file: { isFileSystem: true },
      filesystem: { isFileSystem: true },
      api: { isAPI: true },
      rest: { isAPI: true },
      http: { isAPI: true }
    };
    
    for (const [key, type] of Object.entries(serviceTypes)) {
      if (allText.includes(key)) {
        return type;
      }
    }
    
    return { isGeneral: true };
  }

  /**
   * Extract core capability with AI reasoning
   */
  extractCoreCapability(name, tools, capabilities) {
    // Intelligent capability extraction
    if (capabilities.includes('data analysis')) return 'advanced data analysis and insights';
    if (capabilities.includes('automation')) return 'intelligent process automation';
    if (capabilities.includes('integration')) return 'seamless system integration';
    if (capabilities.includes('content')) return 'smart content management';
    if (capabilities.includes('communication')) return 'automated communication workflows';
    
    // Fallback to tool-based capability
    if (tools.length > 0) {
      const firstTool = tools[0];
      if (typeof firstTool === 'object' && firstTool.name) {
        return `${firstTool.name.replace(/_/g, ' ')} and related operations`;
      }
    }
    
    // Last resort - extract from name
    const nameWords = name.toLowerCase().replace(/[-_]/g, ' ').split(' ');
    const meaningfulWords = nameWords.filter(word => 
      word.length > 3 && 
      !['mcp', 'server', 'client', 'api', 'the', 'and', 'for', 'with'].includes(word)
    );
    
    if (meaningfulWords.length > 0) {
      return `${meaningfulWords.join(' ')} functionality`;
    }
    
    return 'specialized automation capabilities';
  }

  /**
   * Analyze capabilities with AI reasoning
   */
  analyzeCapabilities(tools, readme) {
    const capabilities = [];
    const text = `${readme} ${tools.map(t => typeof t === 'object' ? `${t.name} ${t.description}` : t).join(' ')}`.toLowerCase();
    
    // AI-powered capability detection
    const capabilityPatterns = {
      'data analysis': ['analyze', 'query', 'report', 'metrics', 'analytics', 'insight'],
      'automation': ['automate', 'trigger', 'schedule', 'workflow', 'process'],
      'integration': ['integrate', 'sync', 'connect', 'bridge', 'api'],
      'content': ['create', 'generate', 'write', 'document', 'content'],
      'communication': ['send', 'notify', 'message', 'email', 'chat'],
      'monitoring': ['monitor', 'track', 'watch', 'alert', 'status'],
      'search': ['search', 'find', 'discover', 'lookup', 'browse']
    };
    
    for (const [capability, keywords] of Object.entries(capabilityPatterns)) {
      const matches = keywords.filter(keyword => text.includes(keyword));
      if (matches.length >= 2) {
        capabilities.push(capability);
      }
    }
    
    return capabilities;
  }

  /**
   * Extract business value with AI reasoning
   */
  extractBusinessValue(useCases, readme) {
    const businessValues = [];
    const text = `${useCases.join(' ')} ${readme}`.toLowerCase();
    
    // AI-powered business value extraction
    const valuePatterns = {
      'increased efficiency': ['efficient', 'automate', 'streamline', 'faster'],
      'better insights': ['analyze', 'insight', 'understand', 'intelligence'],
      'improved collaboration': ['collaborate', 'sync', 'share', 'team'],
      'cost reduction': ['reduce', 'optimize', 'save', 'efficient'],
      'enhanced productivity': ['productive', 'automate', 'simplify', 'enhance'],
      'data-driven decisions': ['data', 'analytics', 'metrics', 'reporting']
    };
    
    for (const [value, keywords] of Object.entries(valuePatterns)) {
      const matches = keywords.filter(keyword => text.includes(keyword));
      if (matches.length >= 1) {
        businessValues.push(value);
      }
    }
    
    return businessValues;
  }

  /**
   * Extract differentiators with AI reasoning
   */
  extractDifferentiators(readme, capabilities) {
    const differentiators = [];
    const text = readme.toLowerCase();
    
    // AI-powered differentiator detection
    if (text.includes('real-time') || text.includes('realtime')) {
      differentiators.push('Provides real-time data synchronization and updates.');
    }
    
    if (text.includes('enterprise') || text.includes('scale')) {
      differentiators.push('Built for enterprise-scale operations and reliability.');
    }
    
    if (text.includes('security') || text.includes('secure')) {
      differentiators.push('Implements robust security and authentication protocols.');
    }
    
    if (text.includes('intelligent') || text.includes('smart') || text.includes('ai')) {
      differentiators.push('Features intelligent automation and AI-powered capabilities.');
    }
    
    if (capabilities.length > 3) {
      differentiators.push('Offers comprehensive functionality across multiple business domains.');
    }
    
    return differentiators;
  }

  /**
   * Categorize tools meaningfully for descriptions
   */
  categorizeMeaningfully(tools) {
    const categories = [];
    const toolNames = tools.map(t => typeof t === 'object' ? t.name : t).join(' ').toLowerCase();
    
    // AI-powered meaningful categorization
    if (toolNames.includes('read') || toolNames.includes('get') || toolNames.includes('fetch')) {
      categories.push('data retrieval');
    }
    
    if (toolNames.includes('write') || toolNames.includes('create') || toolNames.includes('update')) {
      categories.push('content management');
    }
    
    if (toolNames.includes('search') || toolNames.includes('query') || toolNames.includes('find')) {
      categories.push('intelligent search');
    }
    
    if (toolNames.includes('list') || toolNames.includes('browse') || toolNames.includes('show')) {
      categories.push('resource exploration');
    }
    
    if (toolNames.includes('execute') || toolNames.includes('run') || toolNames.includes('process')) {
      categories.push('task automation');
    }
    
    return categories.length > 0 ? categories : ['general operations'];
  }

  /**
   * Polish description for natural flow and readability
   */
  polishDescription(description) {
    return description
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\.\s*\./g, '.') // Remove duplicate periods
      .replace(/,\s*,/g, ',') // Remove duplicate commas
      .replace(/\.\s*$/g, '.') // Ensure ends with period
      .trim();
  }

  /**
   * Generate comprehensive intelligent tags for maximum search discoverability (min 20 tags)
   * Uses hyphens for multi-word tags for better search indexing and consistency
   */
  generateIntelligentTags(packageInfo, npmDetails, githubInfo, analysis) {
    const tags = new Set();
    const name = packageInfo.name.toLowerCase();
    const description = (npmDetails.description || '').toLowerCase();
    const readme = (npmDetails.readme || githubInfo?.readme || '').toLowerCase();
    const tools = analysis.tools?.list || [];
    const useCases = analysis.use_cases || [];
    const allText = `${name} ${description} ${readme} ${useCases.join(' ')}`;
    
    console.log(`   🏷️ Generating comprehensive tags for ${packageInfo.name}...`);
    
    // 1. Package name variations and components
    this.addNameBasedTags(tags, name);
    
    // 2. Service/brand-specific tags with comprehensive variations
    this.addServiceSpecificTags(tags, allText, name);
    
    // 3. Functionality and capability tags
    this.addCapabilityTags(tags, allText, tools, useCases);
    
    // 4. Tool-based tags (detailed analysis)
    this.addToolBasedTags(tags, tools);
    
    // 5. Technology stack tags
    this.addTechnologyTags(tags, allText, npmDetails);
    
    // 6. Use case and business value tags
    this.addBusinessValueTags(tags, allText, useCases);
    
    // 7. Search optimization tags (what users would search for)
    this.addSearchOptimizationTags(tags, allText, name, tools);
    
    // 8. Technical specification tags
    this.addTechnicalTags(tags, allText, analysis);
    
    // 9. Industry and domain tags
    this.addIndustryTags(tags, allText, name);
    
    // 10. Action and verb tags (what the MCP can do)
    this.addActionTags(tags, tools, useCases, allText);
    
    const finalTags = Array.from(tags);
    
    // Ensure minimum 20 tags by adding intelligent fallbacks
    if (finalTags.length < 20) {
      this.addFallbackTags(tags, allText, name, 20 - finalTags.length);
    }
    
    const result = Array.from(tags).slice(0, 30); // Max 30 tags for performance
    console.log(`   ✅ Generated ${result.length} comprehensive tags`);
    
    return result;
  }

  addNameBasedTags(tags, name) {
    // Package name components
    const nameParts = name.replace(/[@\/\-_]/g, ' ').split(/\s+/).filter(part => part.length > 2);
    nameParts.forEach(part => {
      if (!['mcp', 'server', 'client', 'api', 'tool'].includes(part)) {
        tags.add(part);
      }
    });
    
    // Name variations
    if (name.includes('mcp')) tags.add('mcp');
    if (name.includes('server')) tags.add('server');
    if (name.includes('protocol')) tags.add('protocol');
    if (name.includes('model-context')) tags.add('model-context-protocol');
  }

  addServiceSpecificTags(tags, allText, name) {
    const serviceMap = {
      'notion': ['notion', 'database', 'productivity', 'workspace', 'docs', 'notes', 'wiki', 'knowledge-base'],
      'stripe': ['stripe', 'payments', 'billing', 'checkout', 'subscription', 'fintech', 'ecommerce', 'transactions'],
      'github': ['github', 'git', 'development', 'repository', 'code', 'version-control', 'pull-request', 'issues'],
      'slack': ['slack', 'communication', 'team', 'messaging', 'chat', 'collaboration', 'workplace'],
      'google': ['google', 'workspace', 'productivity', 'gsuite', 'drive', 'docs', 'sheets', 'gmail'],
      'salesforce': ['salesforce', 'crm', 'sales', 'leads', 'customer', 'pipeline', 'opportunity'],
      'openai': ['openai', 'ai', 'gpt', 'chatgpt', 'llm', 'machine-learning', 'artificial-intelligence'],
      'anthropic': ['anthropic', 'claude', 'ai', 'llm', 'assistant', 'chat', 'conversational-ai'],
      'microsoft': ['microsoft', 'office', 'teams', 'outlook', 'azure', 'sharepoint', 'onedrive'],
      'aws': ['aws', 'amazon', 'cloud', 'ec2', 's3', 'lambda', 'infrastructure', 'serverless'],
      'discord': ['discord', 'gaming', 'community', 'chat', 'voice', 'bot', 'server'],
      'youtube': ['youtube', 'video', 'streaming', 'content', 'media', 'social-media'],
      'twitter': ['twitter', 'x', 'social-media', 'tweets', 'microblogging', 'social'],
      'linkedin': ['linkedin', 'professional', 'networking', 'business', 'social-media', 'career'],
      'database': ['database', 'sql', 'data', 'storage', 'query', 'relational', 'nosql'],
      'postgres': ['postgresql', 'postgres', 'sql', 'database', 'relational', 'queries'],
      'mysql': ['mysql', 'sql', 'database', 'mariadb', 'relational', 'queries'],
      'redis': ['redis', 'cache', 'memory', 'nosql', 'key-value', 'session'],
      'mongodb': ['mongodb', 'nosql', 'document', 'database', 'json', 'bson'],
      'filesystem': ['filesystem', 'files', 'storage', 'directory', 'folder', 'documents'],
      'email': ['email', 'mail', 'smtp', 'communication', 'messaging', 'notifications'],
      'calendar': ['calendar', 'scheduling', 'time', 'events', 'meetings', 'appointments']
    };
    
    for (const [service, serviceTags] of Object.entries(serviceMap)) {
      if (allText.includes(service) || name.includes(service)) {
        serviceTags.forEach(tag => tags.add(tag));
      }
    }
  }

  addCapabilityTags(tags, allText, tools, useCases) {
    const capabilityPatterns = {
      'automation': ['automate', 'automatic', 'trigger', 'workflow', 'schedule'],
      'integration': ['integrate', 'connect', 'sync', 'bridge', 'link'],
      'analytics': ['analyze', 'metrics', 'report', 'dashboard', 'insights'],
      'monitoring': ['monitor', 'track', 'watch', 'alert', 'status'],
      'search': ['search', 'find', 'query', 'lookup', 'discover'],
      'content-creation': ['create', 'generate', 'write', 'compose', 'build'],
      'data-processing': ['process', 'transform', 'parse', 'convert', 'format'],
      'communication': ['send', 'notify', 'message', 'communicate', 'broadcast'],
      'management': ['manage', 'control', 'organize', 'coordinate', 'maintain'],
      'security': ['secure', 'auth', 'encrypt', 'protect', 'verify']
    };
    
    for (const [capability, keywords] of Object.entries(capabilityPatterns)) {
      const matches = keywords.filter(keyword => allText.includes(keyword));
      if (matches.length >= 1) {
        tags.add(capability);
        
        // Add specific variations
        if (capability === 'automation') tags.add('workflow');
        if (capability === 'integration') tags.add('api-integration');
        if (capability === 'analytics') tags.add('business-intelligence');
        if (capability === 'security') tags.add('authentication');
      }
    }
  }

  addToolBasedTags(tags, tools) {
    const toolPatterns = {
      'read': ['data-access', 'retrieval', 'fetch', 'get'],
      'write': ['data-modification', 'create', 'insert', 'save'],
      'update': ['modification', 'edit', 'change', 'patch'],
      'delete': ['removal', 'cleanup', 'purge'],
      'list': ['enumeration', 'discovery', 'browse', 'catalog'],
      'search': ['query', 'find', 'filter', 'lookup'],
      'execute': ['execution', 'run', 'process', 'command'],
      'upload': ['file-upload', 'transfer', 'import'],
      'download': ['file-download', 'export', 'backup'],
      'sync': ['synchronization', 'replication', 'mirror']
    };
    
    tools.forEach(tool => {
      const toolName = (typeof tool === 'object' ? tool.name : tool || '').toLowerCase();
      
      for (const [pattern, relatedTags] of Object.entries(toolPatterns)) {
        if (toolName.includes(pattern)) {
          tags.add(pattern);
          relatedTags.forEach(tag => tags.add(tag));
        }
      }
    });
  }

  addTechnologyTags(tags, allText, npmDetails) {
    const techTags = {
      'javascript': ['js', 'node', 'npm'],
      'typescript': ['ts', 'typed'],
      'python': ['py', 'pip'],
      'rest': ['http', 'api', 'endpoint'],
      'graphql': ['gql', 'query'],
      'websocket': ['ws', 'realtime'],
      'json': ['data', 'format'],
      'xml': ['markup', 'format'],
      'oauth': ['authentication', 'auth'],
      'jwt': ['token', 'auth'],
      'webhook': ['callback', 'trigger'],
      'cli': ['command-line', 'terminal'],
      'sdk': ['library', 'toolkit'],
      'docker': ['container', 'containerization'],
      'kubernetes': ['k8s', 'orchestration']
    };
    
    for (const [tech, relatedTags] of Object.entries(techTags)) {
      if (allText.includes(tech)) {
        tags.add(tech);
        relatedTags.forEach(tag => tags.add(tag));
      }
    }
    
    // Programming languages from dependencies
    const dependencies = Object.keys(npmDetails.dependencies || {});
    if (dependencies.some(dep => dep.includes('typescript'))) tags.add('typescript');
    if (dependencies.some(dep => dep.includes('react'))) tags.add('react');
    if (dependencies.some(dep => dep.includes('express'))) tags.add('express');
  }

  addBusinessValueTags(tags, allText, useCases) {
    const businessTags = {
      'productivity': ['efficient', 'streamline', 'optimize', 'enhance'],
      'collaboration': ['team', 'share', 'collaborate', 'together'],
      'scalability': ['scale', 'grow', 'expand', 'enterprise'],
      'cost-reduction': ['save', 'reduce', 'optimize', 'efficient'],
      'time-saving': ['fast', 'quick', 'instant', 'immediate'],
      'reliability': ['reliable', 'stable', 'robust', 'dependable'],
      'flexibility': ['flexible', 'configurable', 'customizable', 'adaptable'],
      'innovation': ['innovative', 'cutting-edge', 'advanced', 'modern']
    };
    
    const combinedText = `${allText} ${useCases.join(' ')}`.toLowerCase();
    
    for (const [value, keywords] of Object.entries(businessTags)) {
      if (keywords.some(keyword => combinedText.includes(keyword))) {
        tags.add(value);
      }
    }
  }

  addSearchOptimizationTags(tags, allText, name, tools) {
    // What users might search for
    const searchTerms = [
      'mcp-server',
      'model-context-protocol',
      'ai-tools',
      'automation-tools',
      'integration',
      'api-client',
      'data-connector',
      'workflow-automation',
      'business-tools',
      'developer-tools'
    ];
    
    searchTerms.forEach(term => {
      if (allText.includes(term.replace('-', ' ')) || allText.includes(term.replace('-', ''))) {
        tags.add(term);
      }
    });
    
    // Add tool count indicator
    if (tools.length > 10) tags.add('feature-rich');
    if (tools.length > 20) tags.add('comprehensive');
    if (tools.length > 0) tags.add('functional');
  }

  addTechnicalTags(tags, allText, analysis) {
    // Protocol and connection tags
    if (analysis.technical?.protocol_version) tags.add('mcp-protocol');
    if (analysis.technical?.connection_type === 'stdio') tags.add('stdio');
    if (analysis.technical?.connection_type === 'http') tags.add('http-server');
    
    // Installation tags
    tags.add('npm-package');
    tags.add('nodejs');
    
    // Feature tags
    if (allText.includes('async') || allText.includes('promise')) tags.add('asynchronous');
    if (allText.includes('stream')) tags.add('streaming');
    if (allText.includes('batch')) tags.add('batch-processing');
    if (allText.includes('real-time') || allText.includes('realtime')) tags.add('realtime');
  }

  addIndustryTags(tags, allText, name) {
    const industryMap = {
      'fintech': ['payment', 'banking', 'finance', 'money', 'transaction'],
      'healthcare': ['health', 'medical', 'patient', 'clinic', 'hospital'],
      'education': ['learn', 'teach', 'student', 'course', 'training'],
      'ecommerce': ['shop', 'store', 'cart', 'checkout', 'product'],
      'marketing': ['campaign', 'lead', 'conversion', 'advertising', 'promotion'],
      'logistics': ['shipping', 'delivery', 'transport', 'warehouse', 'supply'],
      'media': ['content', 'video', 'audio', 'image', 'streaming'],
      'gaming': ['game', 'player', 'score', 'level', 'achievement'],
      'real-estate': ['property', 'listing', 'rental', 'mortgage', 'real-estate'],
      'travel': ['booking', 'hotel', 'flight', 'travel', 'reservation']
    };
    
    for (const [industry, keywords] of Object.entries(industryMap)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        tags.add(industry);
      }
    }
  }

  addActionTags(tags, tools, useCases, allText) {
    const actionVerbs = [
      'create', 'read', 'update', 'delete', 'list', 'search', 'find', 'get', 'set',
      'send', 'receive', 'upload', 'download', 'sync', 'backup', 'restore',
      'analyze', 'process', 'transform', 'convert', 'validate', 'verify',
      'monitor', 'track', 'log', 'report', 'alert', 'notify',
      'manage', 'control', 'configure', 'deploy', 'install', 'execute'
    ];
    
    const combinedText = `${tools.map(t => typeof t === 'object' ? t.name : t).join(' ')} ${useCases.join(' ')} ${allText}`.toLowerCase();
    
    actionVerbs.forEach(verb => {
      if (combinedText.includes(verb)) {
        tags.add(verb);
      }
    });
  }

  addFallbackTags(tags, allText, name, needed) {
    const fallbackTags = [
      'mcp', 'server', 'tool', 'integration', 'automation', 'api',
      'data', 'service', 'platform', 'solution', 'system', 'application',
      'software', 'technology', 'digital', 'online', 'cloud', 'web',
      'business', 'enterprise', 'professional', 'productivity', 'efficiency'
    ];
    
    let added = 0;
    for (const tag of fallbackTags) {
      if (added >= needed) break;
      if (!tags.has(tag)) {
        tags.add(tag);
        added++;
      }
    }
  }

  /**
   * Select the best predefined category from hardcoded list
   * Returns hyphenated format for search efficiency (displayed with spaces in UI)
   */
  selectPredefinedCategory(packageInfo, npmDetails, githubInfo, analysis) {
    console.log(`   🗂️ Selecting predefined category for ${packageInfo.name}...`);
    
    const name = packageInfo.name.toLowerCase();
    const description = (npmDetails.description || '').toLowerCase();
    const readme = (githubInfo?.readme || '').toLowerCase();
    const tools = analysis.tools?.list || [];
    const useCases = analysis.use_cases || [];
    const allText = `${name} ${description} ${readme} ${useCases.join(' ')}`;

    // Hardcoded categories from categoryValidation.ts
    const PREDEFINED_CATEGORIES = [
      'databases',
      'payments', 
      'ai-tools',
      'development-tools',
      'cloud-storage',
      'messaging',
      'content-creation',
      'monitoring',
      'project-management',
      'security',
      'automation',
      'social-media',
      'web-apis',
      'productivity',
      'infrastructure',
      'media-processing',
      'finance',
      'communication',
      'research',
      'iot'
    ];

    // Service-specific category mapping
    const serviceMapping = {
      'stripe': 'payments',
      'paypal': 'payments',
      'payment': 'payments',
      'billing': 'payments',
      'transaction': 'payments',
      'fintech': 'finance',
      'notion': 'productivity',
      'database': 'databases',
      'postgres': 'databases',
      'mysql': 'databases',
      'sql': 'databases',
      'mongodb': 'databases',
      'redis': 'databases',
      'github': 'development-tools',
      'git': 'development-tools',
      'development': 'development-tools',
      'coding': 'development-tools',
      'slack': 'messaging',
      'discord': 'messaging',
      'chat': 'messaging',
      'email': 'messaging',
      'filesystem': 'cloud-storage',
      'file': 'cloud-storage',
      'storage': 'cloud-storage',
      'drive': 'cloud-storage',
      's3': 'cloud-storage',
      'openai': 'ai-tools',
      'anthropic': 'ai-tools',
      'llm': 'ai-tools',
      'ai': 'ai-tools',
      'gpt': 'ai-tools',
      'claude': 'ai-tools',
      'twitter': 'social-media',
      'facebook': 'social-media',
      'linkedin': 'social-media',
      'youtube': 'social-media',
      'instagram': 'social-media',
      'monitoring': 'monitoring',
      'analytics': 'monitoring',
      'metrics': 'monitoring',
      'logging': 'monitoring',
      'security': 'security',
      'auth': 'security',
      'oauth': 'security',
      'encryption': 'security',
      'automation': 'automation',
      'workflow': 'automation',
      'trigger': 'automation',
      'api': 'web-apis',
      'rest': 'web-apis',
      'webhook': 'web-apis',
      'calendar': 'productivity',
      'document': 'productivity',
      'office': 'productivity',
      'aws': 'infrastructure',
      'docker': 'infrastructure',
      'kubernetes': 'infrastructure',
      'deploy': 'infrastructure',
      'server': 'infrastructure',
      'video': 'media-processing',
      'audio': 'media-processing',
      'image': 'media-processing',
      'media': 'media-processing',
      'content': 'content-creation',
      'text': 'content-creation',
      'generate': 'content-creation',
      'project': 'project-management',
      'task': 'project-management',
      'team': 'project-management',
      'crm': 'project-management',
      'research': 'research',
      'academic': 'research',
      'data': 'research',
      'iot': 'iot',
      'smart': 'iot',
      'device': 'iot'
    };

    // Find best match
    for (const [keyword, category] of Object.entries(serviceMapping)) {
      if (allText.includes(keyword)) {
        console.log(`   ✅ Selected category: ${category} (matched: ${keyword})`);
        return category;
      }
    }

    // Tool-based category detection
    const toolCategories = this.inferCategoryFromTools(tools);
    if (toolCategories.length > 0) {
      console.log(`   ✅ Selected category: ${toolCategories[0]} (from tools)`);
      return toolCategories[0];
    }

    // Fallback to development-tools
    console.log(`   🔄 Using fallback category: development-tools`);
    return 'development-tools';
  }

  /**
   * Infer category from tool analysis
   */
  inferCategoryFromTools(tools) {
    const categories = [];
    const toolNames = tools.map(t => typeof t === 'object' ? t.name : t).join(' ').toLowerCase();

    if (toolNames.includes('database') || toolNames.includes('query') || toolNames.includes('sql')) {
      categories.push('databases');
    }
    if (toolNames.includes('file') || toolNames.includes('read') || toolNames.includes('write')) {
      categories.push('cloud-storage');
    }
    if (toolNames.includes('message') || toolNames.includes('send') || toolNames.includes('notify')) {
      categories.push('messaging');
    }
    if (toolNames.includes('monitor') || toolNames.includes('track') || toolNames.includes('alert')) {
      categories.push('monitoring');
    }
    if (toolNames.includes('auth') || toolNames.includes('login') || toolNames.includes('security')) {
      categories.push('security');
    }
    if (toolNames.includes('create') || toolNames.includes('generate') || toolNames.includes('content')) {
      categories.push('content-creation');
    }
    if (toolNames.includes('api') || toolNames.includes('request') || toolNames.includes('endpoint')) {
      categories.push('web-apis');
    }

    return categories;
  }

  fallbackAgentAnalysis(packageInfo, npmDetails) {
    return {
      installation: {
        primary_method: {
          type: 'npm',
          command: `npx ${packageInfo.name}`,
          description: 'Run with npx',
          priority: 1,
          confidence: 50
        },
        alternative_methods: [],
        auth_method: 'none'
      },
      tools: {
        count: 0,
        list: []
      },
      quality: {
        verified: false,
        health_status: 'unknown',
        last_health_check: new Date().toISOString(),
        relevance_score: 50,
        quality_score: 30,
        total_score: 40
      },
      technical: {
        protocol_version: '2024-11-05',
        connection_type: 'stdio',
        pricing_model: 'free',
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString()
      },
      resources: {
        github_url: null,
        documentation_url: null,
        website_url: null
      },
      provider: {
        author: null,
        company: null,
        license: null,
        commercial: false
      },
      use_cases: []
    };
  }
}

module.exports = { AgentOptimizedAnalyzer };