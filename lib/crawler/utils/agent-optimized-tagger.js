/**
 * Agent-Optimized Tagger
 * Creates semantic tags that help AI agents discover and understand tools
 */

class AgentOptimizedTagger {
  /**
   * Generate tags optimized for agent discovery
   */
  static generateTags(packageData, tools, documentation) {
    const tags = new Set();
    
    // 1. CAPABILITY TAGS - What can this tool do?
    this.addCapabilityTags(tags, tools, documentation);
    
    // 2. USE CASE TAGS - When should an agent use this?
    this.addUseCaseTags(tags, packageData, documentation);
    
    // 3. DOMAIN TAGS - What domain/industry is this for?
    this.addDomainTags(tags, packageData, documentation);
    
    // 4. ACTION TAGS - What actions can be performed?
    this.addActionTags(tags, tools);
    
    // 5. DATA TYPE TAGS - What data does it work with?
    this.addDataTypeTags(tags, tools, documentation);
    
    // 6. INTEGRATION TAGS - What does it connect to?
    this.addIntegrationTags(tags, packageData, documentation);
    
    // 7. PROBLEM SOLVING TAGS - What problems does it solve?
    this.addProblemTags(tags, documentation);
    
    const finalTags = Array.from(tags)
      .filter(tag => tag && tag.length > 2)
      .map(tag => tag.replace(/-/g, ' ')); // Remove hyphens for better search
    
    // MINIMUM 25 TAGS REQUIRED for discoverability
    if (finalTags.length < 25) {
      console.log(`   ⚠️ Only ${finalTags.length} tags generated, adding more for discoverability...`);
      const additionalTags = this.generateAdditionalTags(packageData, tools, documentation);
      finalTags.push(...additionalTags);
    }
    
    return finalTags.slice(0, 50); // Cap at 50 tags max
  }
  
  /**
   * Add capability-based tags
   */
  static addCapabilityTags(tags, tools, documentation) {
    // Analyze tools to understand capabilities
    const capabilities = {
      // File operations
      'file-reading': /read.*file|file.*read|get.*content/i,
      'file-writing': /write.*file|save.*file|create.*file/i,
      'file-management': /manage.*file|organize.*file|file.*system/i,
      
      // Data operations
      'data-retrieval': /fetch|retrieve|get.*data|query/i,
      'data-analysis': /analyze|process.*data|calculate|compute/i,
      'data-transformation': /transform|convert|parse|format/i,
      'data-storage': /store|save|persist|database/i,
      
      // Communication
      'messaging': /send.*message|notification|alert|email/i,
      'real-time-communication': /chat|stream|websocket|live/i,
      'api-integration': /api|endpoint|rest|graphql/i,
      
      // Automation
      'task-automation': /automate|schedule|cron|workflow/i,
      'process-automation': /pipeline|chain|sequence|orchestrate/i,
      'testing-automation': /test|validate|verify|check/i,
      
      // Content
      'content-generation': /generate|create.*content|write.*text/i,
      'content-search': /search|find|lookup|discover/i,
      'content-management': /manage.*content|cms|publish/i,
      
      // Development
      'code-generation': /generate.*code|scaffold|boilerplate/i,
      'code-analysis': /analyze.*code|lint|review|inspect/i,
      'version-control': /git|commit|branch|merge/i,
      
      // AI/ML
      'ai-integration': /ai|ml|model|predict|classify/i,
      'natural-language': /nlp|text.*analysis|sentiment|language/i,
      'image-processing': /image|photo|vision|ocr/i
    };
    
    // Check tools
    tools.forEach(tool => {
      const toolStr = `${tool.name} ${tool.description}`.toLowerCase();
      
      Object.entries(capabilities).forEach(([tag, pattern]) => {
        if (pattern.test(toolStr)) {
          tags.add(tag);
        }
      });
    });
    
    // Check documentation
    const docLower = documentation.toLowerCase();
    Object.entries(capabilities).forEach(([tag, pattern]) => {
      if (pattern.test(docLower)) {
        tags.add(tag);
      }
    });
  }
  
  /**
   * Add use case tags
   */
  static addUseCaseTags(tags, packageData, documentation) {
    const useCases = {
      // Development workflows
      'debugging': /debug|troubleshoot|diagnose|error/i,
      'monitoring': /monitor|track|observe|metric/i,
      'deployment': /deploy|release|publish|ship/i,
      'documentation': /document|docs|readme|wiki/i,
      
      // Business workflows
      'customer-support': /support|ticket|help.*desk|customer/i,
      'sales-automation': /sales|crm|lead|deal/i,
      'marketing-automation': /marketing|campaign|email.*blast/i,
      'financial-operations': /payment|invoice|billing|accounting/i,
      
      // Data workflows
      'data-pipeline': /etl|pipeline|ingestion|processing/i,
      'reporting': /report|dashboard|analytics|insight/i,
      'backup-recovery': /backup|restore|archive|snapshot/i,
      
      // Collaboration
      'team-collaboration': /team|collaborate|share|workspace/i,
      'project-management': /project|task|milestone|sprint/i,
      'knowledge-management': /knowledge|wiki|documentation|notes/i
    };
    
    const content = `${packageData.description} ${documentation}`.toLowerCase();
    
    Object.entries(useCases).forEach(([tag, pattern]) => {
      if (pattern.test(content)) {
        tags.add(tag);
      }
    });
  }
  
  /**
   * Add domain-specific tags
   */
  static addDomainTags(tags, packageData, documentation) {
    const domains = {
      // Industries
      'e-commerce': /ecommerce|shopping|cart|product.*catalog/i,
      'healthcare': /health|medical|patient|clinical/i,
      'finance': /finance|banking|trading|investment/i,
      'education': /education|learning|course|student/i,
      'logistics': /shipping|delivery|tracking|warehouse/i,
      'real-estate': /property|listing|rental|mortgage/i,
      
      // Technical domains
      'web-development': /web|frontend|backend|fullstack/i,
      'mobile-development': /mobile|ios|android|app/i,
      'devops': /devops|ci.*cd|infrastructure|kubernetes/i,
      'data-science': /data.*science|machine.*learning|analytics/i,
      'cybersecurity': /security|encryption|authentication|pentest/i,
      'blockchain': /blockchain|crypto|smart.*contract|web3/i
    };
    
    const content = `${packageData.name} ${packageData.description} ${documentation}`.toLowerCase();
    
    Object.entries(domains).forEach(([tag, pattern]) => {
      if (pattern.test(content)) {
        tags.add(tag);
      }
    });
  }
  
  /**
   * Add action-based tags from tools
   */
  static addActionTags(tags, tools) {
    const actionVerbs = new Set();
    
    tools.forEach(tool => {
      // Extract verb from tool name
      const words = tool.name.split(/[_-]/);
      const firstWord = words[0].toLowerCase();
      
      // Common action verbs
      const actions = [
        'create', 'read', 'update', 'delete', 'list',
        'get', 'set', 'fetch', 'send', 'receive',
        'process', 'analyze', 'generate', 'transform',
        'validate', 'verify', 'authenticate', 'authorize',
        'search', 'filter', 'sort', 'aggregate',
        'import', 'export', 'sync', 'migrate'
      ];
      
      if (actions.includes(firstWord)) {
        actionVerbs.add(firstWord);
      }
      
      // Also check tool description
      const descWords = tool.description.toLowerCase().split(' ');
      actions.forEach(action => {
        if (descWords.includes(action) || descWords.includes(action + 's')) {
          actionVerbs.add(action);
        }
      });
    });
    
    // Convert actions to meaningful tags
    actionVerbs.forEach(verb => {
      switch(verb) {
        case 'create':
        case 'generate':
          tags.add('content-creation');
          break;
        case 'read':
        case 'get':
        case 'fetch':
          tags.add('data-access');
          break;
        case 'update':
        case 'set':
          tags.add('data-modification');
          break;
        case 'delete':
          tags.add('data-deletion');
          break;
        case 'search':
        case 'filter':
          tags.add('data-discovery');
          break;
        case 'analyze':
        case 'process':
          tags.add('data-processing');
          break;
      }
    });
  }
  
  /**
   * Add data type tags
   */
  static addDataTypeTags(tags, tools, documentation) {
    const dataTypes = {
      'json-data': /json|object|dictionary/i,
      'text-data': /text|string|document|markdown/i,
      'tabular-data': /table|csv|spreadsheet|dataframe/i,
      'image-data': /image|photo|picture|jpeg|png/i,
      'video-data': /video|mp4|stream|media/i,
      'audio-data': /audio|sound|music|mp3|wav/i,
      'binary-data': /binary|blob|file|attachment/i,
      'structured-data': /database|sql|schema|model/i,
      'time-series-data': /time.*series|temporal|historical/i,
      'geospatial-data': /location|coordinate|map|gps/i
    };
    
    const content = tools.map(t => `${t.name} ${t.description}`).join(' ') + documentation;
    
    Object.entries(dataTypes).forEach(([tag, pattern]) => {
      if (pattern.test(content)) {
        tags.add(tag);
      }
    });
  }
  
  /**
   * Add integration tags
   */
  static addIntegrationTags(tags, packageData, documentation) {
    // Major platforms/services
    const integrations = [
      // Cloud providers
      'aws', 'azure', 'google-cloud', 'digitalocean',
      // Databases
      'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      // Communication
      'slack', 'discord', 'telegram', 'twilio',
      // Development
      'github', 'gitlab', 'bitbucket', 'jira',
      // Business tools
      'stripe', 'paypal', 'shopify', 'salesforce',
      // AI services
      'openai', 'anthropic', 'huggingface', 'langchain',
      // Social media
      'twitter', 'facebook', 'instagram', 'linkedin'
    ];
    
    const content = `${packageData.name} ${packageData.description} ${documentation}`.toLowerCase();
    
    integrations.forEach(service => {
      if (content.includes(service)) {
        tags.add(`${service}-integration`);
      }
    });
  }
  
  /**
   * Add problem-solving tags
   */
  static addProblemTags(tags, documentation) {
    const problems = {
      // Performance
      'performance-optimization': /performance|speed|fast|optimize|cache/i,
      'scalability': /scale|distributed|cluster|load.*balanc/i,
      
      // Reliability
      'error-handling': /error|exception|fault|resilient/i,
      'data-validation': /validate|verify|check|ensure/i,
      
      // Security
      'authentication': /auth|login|signin|credential/i,
      'authorization': /permission|role|access.*control|rbac/i,
      'data-encryption': /encrypt|decrypt|secure|privacy/i,
      
      // Integration
      'api-connectivity': /api|endpoint|integration|connect/i,
      'data-synchronization': /sync|replicate|mirror|consistency/i,
      
      // Workflow
      'workflow-automation': /automate|workflow|pipeline|orchestrate/i,
      'batch-processing': /batch|bulk|mass|queue/i,
      
      // User experience
      'user-management': /user|account|profile|member/i,
      'notification-system': /notify|alert|message|email/i
    };
    
    Object.entries(problems).forEach(([tag, pattern]) => {
      if (pattern.test(documentation)) {
        tags.add(tag);
      }
    });
  }
  
  /**
   * Generate semantic use cases for agents
   */
  static generateUseCases(tools, documentation) {
    const useCases = [];
    
    // Analyze tools to generate specific use cases
    tools.forEach(tool => {
      const useCase = this.toolToUseCase(tool);
      if (useCase) useCases.push(useCase);
    });
    
    // Extract use cases from documentation
    const docUseCases = this.extractDocumentedUseCases(documentation);
    useCases.push(...docUseCases);
    
    // Generate inferred use cases
    const inferredUseCases = this.inferUseCases(tools, documentation);
    useCases.push(...inferredUseCases);
    
    // Deduplicate and return top use cases
    return [...new Set(useCases)].slice(0, 5);
  }
  
  static toolToUseCase(tool) {
    const { name, description } = tool;
    
    // Map tool patterns to use cases
    if (/create.*issue|report.*bug/i.test(name + description)) {
      return "Report bugs and create issues in project repositories";
    }
    if (/send.*email|notification/i.test(name + description)) {
      return "Send automated notifications and alerts to team members";
    }
    if (/query.*database|fetch.*data/i.test(name + description)) {
      return "Query and retrieve data from databases";
    }
    if (/generate.*report|create.*dashboard/i.test(name + description)) {
      return "Generate reports and analytics dashboards";
    }
    
    return null;
  }
  
  static extractDocumentedUseCases(documentation) {
    const useCases = [];
    
    // Look for "Use Cases" or "Examples" sections
    const useCaseSection = documentation.match(/(?:use\s*cases?|examples?|scenarios?)[\s:]*\n([\s\S]*?)(?=\n#|$)/i);
    
    if (useCaseSection) {
      // Extract bullet points
      const bullets = useCaseSection[1].match(/[-*]\s+(.+)/g);
      if (bullets) {
        bullets.forEach(bullet => {
          const useCase = bullet.replace(/[-*]\s+/, '').trim();
          if (useCase.length > 10 && useCase.length < 100) {
            useCases.push(useCase);
          }
        });
      }
    }
    
    return useCases;
  }
  
  static inferUseCases(tools, documentation) {
    const useCases = [];
    
    // Infer based on tool combinations
    const hasCreate = tools.some(t => t.name.includes('create'));
    const hasRead = tools.some(t => t.name.includes('read') || t.name.includes('get'));
    const hasUpdate = tools.some(t => t.name.includes('update'));
    const hasDelete = tools.some(t => t.name.includes('delete'));
    
    if (hasCreate && hasRead && hasUpdate && hasDelete) {
      useCases.push("Manage and maintain data with full CRUD operations");
    }
    
    // Service-specific use cases
    if (/github/i.test(documentation)) {
      useCases.push("Automate GitHub workflows and repository management");
    }
    if (/slack/i.test(documentation)) {
      useCases.push("Build Slack bots and automate team communications");
    }
    if (/stripe/i.test(documentation)) {
      useCases.push("Process payments and manage customer billing");
    }
    
    return useCases;
  }
  
  /**
   * Generate additional tags to reach minimum of 25
   */
  static generateAdditionalTags(packageData, tools, documentation) {
    const additionalTags = new Set();
    
    // Add comprehensive technology tags
    const techTags = [
      'ai tools', 'automation', 'integration', 'api access', 'data processing',
      'workflow automation', 'task automation', 'intelligent automation',
      'claude integration', 'ai assistant', 'model context protocol',
      'server side', 'backend service', 'microservice', 'service integration',
      'productivity tool', 'developer tool', 'business automation',
      'enterprise integration', 'saas integration', 'cloud service',
      'real time', 'batch processing', 'data pipeline', 'event driven',
      'secure access', 'authenticated service', 'scalable solution'
    ];
    
    // Add based on package name analysis
    const packageName = packageData.name.toLowerCase();
    if (packageName.includes('server')) {
      additionalTags.add('server application');
      additionalTags.add('backend server');
      additionalTags.add('service provider');
    }
    
    if (packageName.includes('mcp') || packageName.includes('modelcontextprotocol')) {
      additionalTags.add('mcp protocol');
      additionalTags.add('context protocol');
      additionalTags.add('ai context');
      additionalTags.add('protocol server');
    }
    
    // Add service-specific comprehensive tags
    if (packageName.includes('github')) {
      const githubTags = [
        'version control', 'source code', 'repository management', 'git integration',
        'code collaboration', 'issue tracking', 'pull requests', 'project management',
        'developer workflow', 'continuous integration', 'code review', 'open source'
      ];
      githubTags.forEach(tag => additionalTags.add(tag));
    }
    
    if (packageName.includes('slack')) {
      const slackTags = [
        'team communication', 'instant messaging', 'workplace chat', 'team collaboration',
        'channel management', 'bot integration', 'notification system', 'team productivity'
      ];
      slackTags.forEach(tag => additionalTags.add(tag));
    }
    
    if (packageName.includes('filesystem') || packageName.includes('file')) {
      const fileTags = [
        'file system', 'file operations', 'directory management', 'file storage',
        'local files', 'file processing', 'document management', 'file access'
      ];
      fileTags.forEach(tag => additionalTags.add(tag));
    }
    
    // Add remaining generic tags to reach minimum
    techTags.forEach(tag => {
      if (additionalTags.size < 25) {
        additionalTags.add(tag);
      }
    });
    
    return Array.from(additionalTags);
  }
}

module.exports = { AgentOptimizedTagger };