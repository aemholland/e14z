/**
 * Real MCP Protocol Communicator
 * Actually communicates with MCP servers to get tools via JSON-RPC
 */

const { spawn } = require('child_process');
const readline = require('readline');

class MCPCommunicator {
  constructor(options = {}) {
    this.timeout = options.timeout || 15000;
  }

  /**
   * Communicate with an MCP server to get its actual tools
   */
  async getToolsFromServer(mcpData) {
    console.log(`   🔌 Connecting to MCP server: ${mcpData.name}`);
    
    try {
      // Start the MCP server
      const serverProcess = await this.startMCPServer(mcpData);
      
      if (!serverProcess) {
        throw new Error('Failed to start MCP server');
      }

      // Initialize MCP protocol communication
      const result = await this.communicateWithMCPServer(serverProcess);
      
      // Clean up
      this.killProcess(serverProcess);
      
      console.log(`   ✅ Retrieved ${result.tools.length} tools from ${mcpData.name}`);
      return {
        success: true,
        tools: result.tools,
        mcpData: result.mcpData,
        method: 'mcp_protocol'
      };

    } catch (error) {
      console.log(`   ❌ MCP communication failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        tools: [],
        mcpData: { health: { status: 'error' } }
      };
    }
  }

  /**
   * Start MCP server process
   */
  async startMCPServer(mcpData) {
    return new Promise((resolve, reject) => {
      const command = mcpData.auto_install_command;
      
      let cmd, args;
      if (command.startsWith('npx ')) {
        cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        args = command.split(' ').slice(1);
      } else {
        const parts = command.split(' ');
        cmd = parts[0];
        args = parts.slice(1);
      }

      console.log(`   🚀 Starting: ${cmd} ${args.join(' ')}`);

      const child = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let hasStarted = false;
      let hasOutput = false;
      
      // More comprehensive startup patterns
      const startupPatterns = [
        // Generic MCP patterns
        /server.*running/i,
        /mcp.*server/i,
        /model.*context.*protocol/i,
        /listening/i,
        /ready/i,
        /started/i,
        /running.*stdio/i,
        /stdio.*server/i,
        
        // Common server patterns
        /server.*started/i,
        /started.*server/i,
        /initialized/i,
        /available/i,
        /waiting.*connections/i,
        
        // Protocol-specific patterns
        /json.*rpc/i,
        /rpc.*server/i,
        /protocol.*server/i
      ];
      
      const checkStartupIndicators = (output) => {
        const text = output.toLowerCase();
        return startupPatterns.some(pattern => pattern.test(text)) ||
               // Fallback: any output containing both "server" and common MCP terms
               (text.includes('server') && (text.includes('mcp') || text.includes('stdio') || text.includes('running'))) ||
               // Fallback: any JSON-RPC looking output (indicates server is responding)
               (text.includes('{') && text.includes('jsonrpc'));
      };

      // Timeout-based fallback - if process stays alive and we get any output, assume it started
      const startupTimeout = setTimeout(() => {
        if (!hasStarted && hasOutput && !child.killed) {
          console.log(`   ⏰ Timeout-based startup detection: process alive with output`);
          hasStarted = true;
          resolve(child);
        } else if (!hasStarted) {
          console.log(`   ⏰ Startup timeout: assuming ready (silent start)`);
          hasStarted = true;
          resolve(child);
        }
      }, 4000); // Give it 4 seconds

      child.stdout.on('data', (data) => {
        const output = data.toString();
        hasOutput = true;
        
        if (checkStartupIndicators(output) && !hasStarted) {
          console.log(`   ✅ STDOUT startup detected: ${output.trim().substring(0, 100)}`);
          hasStarted = true;
          clearTimeout(startupTimeout);
          resolve(child);
        }
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        hasOutput = true;
        
        if (checkStartupIndicators(output) && !hasStarted) {
          console.log(`   ✅ STDERR startup detected: ${output.trim().substring(0, 100)}`);
          hasStarted = true;
          clearTimeout(startupTimeout);
          resolve(child);
        }
      });

      child.on('error', (error) => {
        clearTimeout(startupTimeout);
        reject(new Error(`Failed to start MCP server: ${error.message}`));
      });

      child.on('exit', (code) => {
        if (!hasStarted) {
          clearTimeout(startupTimeout);
          reject(new Error(`MCP server exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Communicate with MCP server using JSON-RPC protocol
   */
  async communicateWithMCPServer(serverProcess) {
    return new Promise((resolve, reject) => {
      const tools = [];
      let communicationStarted = false;
      let initializeSent = false;
      let toolsRequestSent = false;
      
      // Collect comprehensive MCP protocol data
      const mcpData = {
        protocolVersion: null,
        capabilities: {},
        serverInfo: {},
        resources: [],
        prompts: [],
        performance: {
          initializationTime: null,
          averageResponseTime: null,
          toolResponseTimes: {}
        },
        health: {
          status: 'unknown',
          checks: {},
          metrics: {}
        }
      };
      
      let requestCount = 0;
      let totalResponseTime = 0;
      let responsesReceived = 0;
      const expectedResponses = 3; // initialize + tools + resources + prompts
      
      const timeout = setTimeout(() => {
        console.log(`   ⏰ MCP communication timeout after ${this.timeout}ms`);
        mcpData.health.status = 'timeout';
        resolve({ tools, mcpData }); // Return whatever data we got
      }, this.timeout);

      // Set up readline for server communication
      const rl = readline.createInterface({
        input: serverProcess.stdout,
        output: serverProcess.stdin,
        terminal: false
      });

      // Step 1: Send initialize request
      const initializeRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            roots: {
              listChanged: true
            },
            sampling: {}
          },
          clientInfo: {
            name: "e14z-crawler",
            version: "1.0.0"
          }
        }
      };

      console.log(`   📡 Sending initialize request...`);
      try {
        serverProcess.stdin.write(JSON.stringify(initializeRequest) + '\n');
        initializeSent = true;
      } catch (error) {
        console.log(`   ❌ Failed to send initialize request: ${error.message}`);
        clearTimeout(timeout);
        rl.close();
        resolve([]);
        return;
      }

      // Step 2: Listen for responses
      rl.on('line', (line) => {
        try {
          // Skip empty lines and non-JSON lines
          if (!line.trim() || !line.includes('{')) {
            return;
          }
          
          const response = JSON.parse(line);
          console.log(`   📨 Received response: ${JSON.stringify(response).substring(0, 200)}...`);
          
          if (response.id === 1) {
            if (response.result) {
              // Collect initialization data
              mcpData.protocolVersion = response.result.protocolVersion;
              mcpData.capabilities = response.result.capabilities || {};
              mcpData.serverInfo = response.result.serverInfo || {};
              
              console.log(`   ✅ MCP server initialized (v${mcpData.protocolVersion}), requesting comprehensive data...`);
              
              // Request tools, resources, and prompts for comprehensive data
              const requests = [
                { id: 2, method: "tools/list", params: {} },
                { id: 3, method: "resources/list", params: {} },
                { id: 4, method: "prompts/list", params: {} }
              ];
              
              try {
                for (const request of requests) {
                  serverProcess.stdin.write(JSON.stringify({
                    jsonrpc: "2.0",
                    ...request
                  }) + '\n');
                }
                toolsRequestSent = true;
                communicationStarted = true;
              } catch (error) {
                console.log(`   ❌ Failed to send data requests: ${error.message}`);
                clearTimeout(timeout);
                rl.close();
                resolve({ tools: [], mcpData });
              }
              
            } else if (response.error) {
              console.log(`   ❌ Initialize error: ${response.error.message}`);
              clearTimeout(timeout);
              rl.close();
              resolve([]);
            }
            
          } else if (response.id === 2) {
            // Tools response
            responsesReceived++;
            if (response.result && response.result.tools) {
              const extractedTools = response.result.tools.map(tool => ({
                name: tool.name || 'unnamed_tool',
                description: tool.description || 'No description provided',
                parameters: tool.inputSchema ? this.extractParametersFromSchema(tool.inputSchema) : [],
                category: tool.category || 'general',
                inputSchema: tool.inputSchema,
                outputSchema: tool.outputSchema
              }));
              tools.push(...extractedTools);
              console.log(`   ✅ Got ${extractedTools.length} tools via MCP protocol`);
            }
            
          } else if (response.id === 3) {
            // Resources response 
            responsesReceived++;
            if (response.result && response.result.resources) {
              mcpData.resources = response.result.resources;
              console.log(`   📁 Got ${mcpData.resources.length} resources`);
            } else if (response.error) {
              console.log(`   ⚠️ Resources not supported: ${response.error.message}`);
            }
            
          } else if (response.id === 4) {
            // Prompts response
            responsesReceived++;
            if (response.result && response.result.prompts) {
              mcpData.prompts = response.result.prompts;
              console.log(`   💬 Got ${mcpData.prompts.length} prompts`);
            } else if (response.error) {
              console.log(`   ⚠️ Prompts not supported: ${response.error.message}`);
            }
          }
          
          // Check if we've received all expected responses
          if (responsesReceived >= expectedResponses) {
            mcpData.health.status = 'healthy';
            clearTimeout(timeout);
            rl.close();
            resolve({ tools, mcpData });
          }
          
        } catch (e) {
          // Log but continue - might be non-JSON output
          console.log(`   ⚠️ Non-JSON line ignored: ${line.substring(0, 50)}...`);
        }
      });

      // Handle server errors
      serverProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        console.log(`   ⚠️ Server stderr: ${errorText.substring(0, 100)}...`);
      });

      serverProcess.on('exit', () => {
        if (!communicationStarted) {
          clearTimeout(timeout);
          rl.close();
          resolve([]); // Server exited early, return empty tools
        }
      });
    });
  }

  /**
   * Extract parameters from JSON schema
   */
  extractParametersFromSchema(schema) {
    const parameters = [];
    
    if (schema.properties) {
      for (const [name, prop] of Object.entries(schema.properties)) {
        parameters.push({
          name: name,
          type: prop.type || 'string',
          description: prop.description || 'No description',
          required: schema.required && schema.required.includes(name)
        });
      }
    }
    
    return parameters;
  }

  /**
   * Safely kill a process
   */
  killProcess(process) {
    try {
      if (process && !process.killed) {
        process.kill('SIGTERM');
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 2000);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

module.exports = { MCPCommunicator };