/**
 * Tool Extractor - Extract MCP tools from documentation
 * Parses READMEs, docs, and code to find tool definitions
 */

class ToolExtractor {
  /**
   * Extract tools from various sources
   */
  static extractFromContent(content, source = 'unknown') {
    const tools = [];
    
    // Try multiple extraction strategies
    const extractors = [
      this.extractFromMarkdownTable,
      this.extractFromCodeBlocks,
      this.extractFromToolsList,
      this.extractFromJSONSchema,
      this.extractFromTypeScript,
      this.extractFromHeaders
    ];
    
    for (const extractor of extractors) {
      const extracted = extractor.call(this, content);
      if (extracted.length > 0) {
        tools.push(...extracted);
      }
    }
    
    // Deduplicate and enhance
    return this.deduplicateAndEnhance(tools);
  }
  
  /**
   * Extract from markdown tables
   * | Tool | Description | Parameters |
   * |------|-------------|------------|
   * | read_file | Read a file | path: string |
   */
  static extractFromMarkdownTable(content) {
    const tools = [];
    const tableRegex = /\|[\s\S]*?\|[\s\S]*?\|[\s\S]*?\|/gm;
    const tables = content.match(tableRegex);
    
    if (!tables) return tools;
    
    for (const table of tables) {
      const lines = table.split('\n').filter(line => line.trim());
      
      // Check if it's a tools table
      const header = lines[0]?.toLowerCase();
      if (!header?.includes('tool') && !header?.includes('function') && !header?.includes('method')) {
        continue;
      }
      
      // Parse rows (skip header and separator)
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(c => c);
        if (cells.length >= 2) {
          const tool = {
            name: this.cleanToolName(cells[0]),
            description: cells[1],
            parameters: this.parseParameters(cells[2] || '')
          };
          
          if (tool.name) {
            tools.push(tool);
          }
        }
      }
    }
    
    return tools;
  }
  
  /**
   * Extract from code blocks
   * ```javascript
   * tools: [{
   *   name: "read_file",
   *   description: "Read file contents",
   *   inputSchema: { ... }
   * }]
   * ```
   */
  static extractFromCodeBlocks(content) {
    const tools = [];
    
    // Look for tools array in code blocks
    const codeBlockRegex = /```[\s\S]*?```/gm;
    const codeBlocks = content.match(codeBlockRegex);
    
    if (!codeBlocks) return tools;
    
    for (const block of codeBlocks) {
      // Look for tools definitions
      const toolsMatch = block.match(/tools['":\s]+\[([^\]]+)\]/);
      if (toolsMatch) {
        try {
          // Clean up and parse
          const toolsStr = toolsMatch[1]
            .replace(/'/g, '"')
            .replace(/(\w+):/g, '"$1":')
            .replace(/,\s*}/g, '}');
          
          const parsed = JSON.parse(`[${toolsStr}]`);
          tools.push(...parsed);
        } catch (e) {
          // Try regex extraction
          const toolRegex = /name['":\s]+["']([^"']+)["'][,\s]*description['":\s]+["']([^"']+)["']/g;
          let match;
          while ((match = toolRegex.exec(block)) !== null) {
            tools.push({
              name: match[1],
              description: match[2]
            });
          }
        }
      }
    }
    
    return tools;
  }
  
  /**
   * Extract from bullet lists
   * ## Available Tools
   * - `read_file(path)` - Read file contents
   * - `write_file(path, content)` - Write to file
   */
  static extractFromToolsList(content) {
    const tools = [];
    
    // Find tools section
    const toolsSectionRegex = /#{1,3}\s*(Available\s+)?Tools?[\s\S]*?(?=#{1,3}|$)/gi;
    const sections = content.match(toolsSectionRegex);
    
    if (!sections) return tools;
    
    for (const section of sections) {
      // Extract bullet points
      const bulletRegex = /[-*]\s*`?(\w+)`?\s*\(([^)]*)\)?\s*[-:]?\s*(.+?)(?=\n|$)/g;
      let match;
      
      while ((match = bulletRegex.exec(section)) !== null) {
        const tool = {
          name: this.cleanToolName(match[1]),
          description: match[3].trim(),
          parameters: this.parseParameters(match[2] || '')
        };
        
        if (tool.name) {
          tools.push(tool);
        }
      }
    }
    
    return tools;
  }
  
  /**
   * Extract from JSON Schema definitions
   */
  static extractFromJSONSchema(content) {
    const tools = [];
    
    // Look for inputSchema or similar
    const schemaRegex = /inputSchema['":\s]+({[\s\S]*?})\s*[,}]/g;
    let match;
    
    while ((match = schemaRegex.exec(content)) !== null) {
      try {
        const schema = JSON.parse(match[1]);
        if (schema.properties) {
          // This is likely a tool schema
          const toolName = this.findNearbyToolName(content, match.index);
          if (toolName) {
            tools.push({
              name: toolName,
              description: schema.description || '',
              parameters: Object.entries(schema.properties).map(([name, def]) => ({
                name,
                type: def.type,
                description: def.description,
                required: schema.required?.includes(name)
              }))
            });
          }
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }
    
    return tools;
  }
  
  /**
   * Extract from TypeScript interfaces
   */
  static extractFromTypeScript(content) {
    const tools = [];
    
    // Look for tool type definitions
    const interfaceRegex = /interface\s+(\w*Tool\w*)\s*{[\s\S]*?}/g;
    let match;
    
    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const interfaceBody = match[0];
      
      // Extract properties
      const propRegex = /(\w+)\s*[?:]?\s*([^;\n]+)/g;
      let propMatch;
      const properties = [];
      
      while ((propMatch = propRegex.exec(interfaceBody)) !== null) {
        if (propMatch[1] !== 'interface') {
          properties.push({
            name: propMatch[1],
            type: propMatch[2].trim()
          });
        }
      }
      
      if (properties.some(p => p.name === 'name' || p.name === 'description')) {
        // This looks like a tool definition
        const name = properties.find(p => p.name === 'name')?.type?.replace(/['"]/g, '');
        if (name) {
          tools.push({
            name: this.cleanToolName(name),
            description: properties.find(p => p.name === 'description')?.type?.replace(/['"]/g, '') || '',
            parameters: properties.filter(p => !['name', 'description'].includes(p.name))
          });
        }
      }
    }
    
    return tools;
  }
  
  /**
   * Extract from headers/sections
   * ### read_file
   * Reads the contents of a file
   * Parameters: path (string)
   */
  static extractFromHeaders(content) {
    const tools = [];
    
    // Look for tool-like headers
    const headerRegex = /#{3,4}\s*`?(\w+)`?\s*\n([\s\S]*?)(?=#{1,4}|$)/g;
    let match;
    
    while ((match = headerRegex.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      
      // Check if this looks like a tool
      if (this.looksLikeTool(name, body)) {
        const tool = {
          name: this.cleanToolName(name),
          description: this.extractDescription(body),
          parameters: this.extractParametersFromText(body)
        };
        
        if (tool.name) {
          tools.push(tool);
        }
      }
    }
    
    return tools;
  }
  
  /**
   * Helper methods
   */
  static cleanToolName(name) {
    return name
      .replace(/[`'"]/g, '')
      .replace(/\(\)$/, '')
      .trim();
  }
  
  static parseParameters(paramStr) {
    if (!paramStr) return [];
    
    const params = [];
    const parts = paramStr.split(',').map(p => p.trim());
    
    for (const part of parts) {
      // Handle various formats: "path: string", "path (string)", "string path"
      const match = part.match(/(\w+)\s*[:\s]\s*(\w+)|(\w+)\s+(\w+)|(\w+)/);
      if (match) {
        const name = match[1] || match[4] || match[5];
        const type = match[2] || match[3] || 'string';
        params.push({ name, type });
      }
    }
    
    return params;
  }
  
  static extractParametersFromText(text) {
    const params = [];
    
    // Look for parameter descriptions
    const paramRegex = /(?:Parameters?|Arguments?|Inputs?)[\s:]*\n?([\s\S]*?)(?=\n\n|Returns?|Output|Example|$)/i;
    const match = text.match(paramRegex);
    
    if (match) {
      const paramText = match[1];
      
      // Extract individual parameters
      const lines = paramText.split('\n');
      for (const line of lines) {
        const paramMatch = line.match(/[-*]?\s*`?(\w+)`?\s*\(([^)]+)\)?\s*[-:]?\s*(.+)/);
        if (paramMatch) {
          params.push({
            name: paramMatch[1],
            type: paramMatch[2] || 'string',
            description: paramMatch[3].trim()
          });
        }
      }
    }
    
    return params;
  }
  
  static looksLikeTool(name, body) {
    // Check if name looks like a tool
    const toolPatterns = [
      'read', 'write', 'get', 'set', 'list', 'create', 'update', 'delete',
      'search', 'query', 'fetch', 'send', 'execute', 'run', 'call'
    ];
    
    const nameLower = name.toLowerCase();
    const hasToolPattern = toolPatterns.some(p => nameLower.includes(p));
    
    // Check if body contains tool-like descriptions
    const bodyLower = body.toLowerCase();
    const hasToolWords = bodyLower.includes('parameter') || 
                        bodyLower.includes('argument') ||
                        bodyLower.includes('returns') ||
                        bodyLower.includes('function');
    
    return hasToolPattern || hasToolWords;
  }
  
  static extractDescription(text) {
    // Get first sentence or line
    const lines = text.trim().split('\n');
    const firstLine = lines[0]?.trim();
    
    if (firstLine && !firstLine.includes('Parameter') && !firstLine.includes('Argument')) {
      return firstLine.replace(/\.$/, '');
    }
    
    // Look for description pattern
    const descMatch = text.match(/Description:\s*(.+?)(?=\n|$)/i);
    if (descMatch) {
      return descMatch[1].trim();
    }
    
    return '';
  }
  
  static findNearbyToolName(content, position) {
    // Look backwards for tool name
    const before = content.substring(Math.max(0, position - 200), position);
    const nameMatch = before.match(/name['":\s]+["'](\w+)["']/);
    return nameMatch ? nameMatch[1] : null;
  }
  
  static deduplicateAndEnhance(tools) {
    const seen = new Map();
    
    for (const tool of tools) {
      const key = tool.name.toLowerCase();
      
      if (!seen.has(key)) {
        seen.set(key, tool);
      } else {
        // Merge information
        const existing = seen.get(key);
        if (!existing.description && tool.description) {
          existing.description = tool.description;
        }
        if (!existing.parameters?.length && tool.parameters?.length) {
          existing.parameters = tool.parameters;
        }
      }
    }
    
    return Array.from(seen.values()).map(tool => ({
      name: tool.name,
      description: tool.description || `${tool.name} operation`,
      category: this.categorizeToolByName(tool.name),
      parameters: tool.parameters || []
    }));
  }
  
  static categorizeToolByName(name) {
    const categories = {
      file: ['read', 'write', 'file', 'directory', 'path'],
      database: ['query', 'insert', 'update', 'delete', 'sql', 'db'],
      api: ['fetch', 'request', 'post', 'get', 'api'],
      search: ['search', 'find', 'query', 'lookup'],
      communication: ['send', 'email', 'message', 'notify']
    };
    
    const nameLower = name.toLowerCase();
    
    for (const [category, patterns] of Object.entries(categories)) {
      if (patterns.some(p => nameLower.includes(p))) {
        return category;
      }
    }
    
    return 'general';
  }
}

module.exports = { ToolExtractor };