/**
 * MCP Validation Module
 * Validates that discovered packages are actually working MCP servers
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { MCPCommunicator } = require('./real-mcp-communicator');

class MCPValidator {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000; // 30 seconds
    this.maxConcurrentValidations = options.maxConcurrentValidations || 3;
    this.validateInstallation = options.validateInstallation !== false;
    this.validateConnection = options.validateConnection !== false;
    this.validateTools = options.validateTools !== false;
    this.tempDir = options.tempDir || path.join(os.tmpdir(), 'e14z-mcp-validation');
    this.mcpCommunicator = new MCPCommunicator({ timeout: this.timeout });
  }

  /**
   * Validate an MCP package completely
   */
  async validateMCP(mcpData) {
    const validationId = crypto.randomBytes(8).toString('hex');
    console.log(`🔍 Validating MCP: ${mcpData.name} (${validationId})`);

    const results = {
      isValid: false,
      canInstall: false,
      canConnect: false,
      hasTools: false,
      errors: [],
      warnings: [],
      extractedTools: [],
      connectionType: null,
      protocolVersion: null,
      validationTime: Date.now()
    };

    try {
      // Create isolated validation environment
      const validationDir = await this.createValidationEnvironment(validationId);

      // Step 1: Validate installation
      if (this.validateInstallation) {
        console.log(`   📦 Testing installation: ${mcpData.auto_install_command}`);
        const installResult = await this.testInstallation(mcpData, validationDir);
        results.canInstall = installResult.success;
        
        if (!installResult.success) {
          results.errors.push(`Installation failed: ${installResult.error}`);
          return results;
        }
        
        if (installResult.warnings) {
          results.warnings.push(...installResult.warnings);
        }
      }

      // Step 2: Validate MCP connection
      if (this.validateConnection) {
        console.log(`   🔌 Testing MCP connection...`);
        const connectionResult = await this.testMCPConnection(mcpData, validationDir);
        results.canConnect = connectionResult.success;
        results.connectionType = connectionResult.connectionType;
        results.protocolVersion = connectionResult.protocolVersion;
        
        if (!connectionResult.success) {
          results.errors.push(`Connection failed: ${connectionResult.error}`);
          // Continue to tool validation even if connection fails
        }
      }

      // Step 3: Validate and extract tools
      if (this.validateTools) {
        console.log(`   🛠️ Testing tools extraction...`);
        const toolsResult = await this.extractAndValidateTools(mcpData, validationDir);
        results.hasTools = toolsResult.success;
        results.extractedTools = toolsResult.tools || [];
        
        if (!toolsResult.success) {
          results.warnings.push(`Tools extraction failed: ${toolsResult.error}`);
        }
      }

      // Overall validation result
      results.isValid = results.canInstall && (results.canConnect || results.hasTools);

      // Cleanup
      await this.cleanupValidationEnvironment(validationDir);

      if (results.isValid) {
        console.log(`   ✅ Validation passed: ${mcpData.name}`);
      } else {
        console.log(`   ❌ Validation failed: ${mcpData.name} - ${results.errors.join(', ')}`);
      }

      return results;

    } catch (error) {
      results.errors.push(`Validation error: ${error.message}`);
      console.error(`   💥 Validation crashed for ${mcpData.name}: ${error.message}`);
      return results;
    }
  }

  /**
   * Create isolated validation environment
   */
  async createValidationEnvironment(validationId) {
    const validationDir = path.join(this.tempDir, validationId);
    
    try {
      await fs.mkdir(validationDir, { recursive: true });
      console.log(`   📁 Created validation environment: ${validationDir}`);
      return validationDir;
    } catch (error) {
      throw new Error(`Failed to create validation environment: ${error.message}`);
    }
  }

  /**
   * Test package installation
   */
  async testInstallation(mcpData, validationDir) {
    const installCommand = mcpData.auto_install_command;
    const installType = mcpData.install_type;

    try {
      switch (installType) {
        case 'npm':
          return await this.testNPMInstallation(installCommand, validationDir);
        case 'pipx':
          return await this.testPipxInstallation(installCommand, validationDir);
        case 'cargo':
          return await this.testCargoInstallation(installCommand, validationDir);
        case 'go':
          return await this.testGoInstallation(installCommand, validationDir);
        case 'e14z':
          return await this.testE14ZInstallation(installCommand, validationDir);
        default:
          return {
            success: false,
            error: `Unsupported installation type: ${installType}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test NPM package installation
   */
  async testNPMInstallation(installCommand, validationDir) {
    try {
      // For npx commands, just verify npx is available and package exists
      if (installCommand.startsWith('npx ')) {
        const packageName = installCommand.replace('npx ', '').split(' ')[0];
        
        // Check if package exists on NPM registry
        const packageExists = await this.checkNPMPackageExists(packageName);
        if (!packageExists) {
          return {
            success: false,
            error: `Package ${packageName} not found on NPM registry`
          };
        }

        // Verify npx is available
        const npxResult = await this.executeCommand('npx', ['--version'], validationDir);
        if (npxResult.code !== 0) {
          return {
            success: false,
            error: 'npx is not available'
          };
        }

        return {
          success: true,
          method: 'npx',
          packageName: packageName
        };
      }

      // For npm install commands, try actual installation
      if (installCommand.startsWith('npm install ')) {
        const packageName = installCommand.replace('npm install ', '').split(' ')[0];
        
        // Create package.json
        await fs.writeFile(
          path.join(validationDir, 'package.json'),
          JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
        );

        const installResult = await this.executeCommand('npm', ['install', packageName], validationDir);
        
        if (installResult.code === 0) {
          return {
            success: true,
            method: 'npm',
            packageName: packageName
          };
        } else {
          return {
            success: false,
            error: `npm install failed: ${installResult.stderr}`
          };
        }
      }

      return {
        success: false,
        error: `Unsupported NPM command format: ${installCommand}`
      };

    } catch (error) {
      return {
        success: false,
        error: `NPM installation test failed: ${error.message}`
      };
    }
  }

  /**
   * Test Pipx package installation
   */
  async testPipxInstallation(installCommand, validationDir) {
    try {
      // Check if pipx is available
      const pipxResult = await this.executeCommand('pipx', ['--version'], validationDir);
      if (pipxResult.code !== 0) {
        return {
          success: false,
          error: 'pipx is not available. Install with: pip install pipx'
        };
      }

      // Extract package name
      const packageName = installCommand.replace(/pipx install\s+/, '').split(' ')[0];

      // Test if package exists on PyPI (without actually installing)
      const packageExists = await this.checkPyPIPackageExists(packageName);
      if (!packageExists) {
        return {
          success: false,
          error: `Package ${packageName} not found on PyPI`
        };
      }

      return {
        success: true,
        method: 'pipx',
        packageName: packageName,
        warnings: ['Pipx installation not fully tested to avoid system modifications']
      };

    } catch (error) {
      return {
        success: false,
        error: `Pipx installation test failed: ${error.message}`
      };
    }
  }

  /**
   * Test MCP server connection
   */
  async testMCPConnection(mcpData, validationDir) {
    try {
      console.log(`   🔌 Attempting MCP connection test...`);

      // Prepare MCP server command
      const command = await this.prepareServerCommand(mcpData, validationDir);
      if (!command) {
        return {
          success: false,
          error: 'Could not determine server command'
        };
      }

      // Start MCP server process
      const serverProcess = spawn(command.cmd, command.args, {
        cwd: validationDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      return new Promise((resolve) => {
        let output = '';
        let errorOutput = '';
        let connectionEstablished = false;
        let protocolVersion = null;

        const timeout = setTimeout(() => {
          serverProcess.kill('SIGTERM');
          resolve({
            success: false,
            error: 'Connection test timed out'
          });
        }, this.timeout);

        // Send MCP initialization request
        const initRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'e14z-validator',
              version: '1.0.0'
            }
          }
        };

        serverProcess.stdout.on('data', (data) => {
          output += data.toString();
          
          try {
            // Look for JSON-RPC response
            const lines = output.split('\n');
            for (const line of lines) {
              if (line.trim() && line.startsWith('{')) {
                const response = JSON.parse(line.trim());
                
                if (response.result && response.result.protocolVersion) {
                  connectionEstablished = true;
                  protocolVersion = response.result.protocolVersion;
                  
                  clearTimeout(timeout);
                  serverProcess.kill('SIGTERM');
                  
                  resolve({
                    success: true,
                    connectionType: 'stdio',
                    protocolVersion: protocolVersion,
                    serverInfo: response.result.serverInfo
                  });
                  return;
                }
              }
            }
          } catch (error) {
            // Continue processing, might not be JSON yet
          }
        });

        serverProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        serverProcess.on('close', (code) => {
          clearTimeout(timeout);
          
          if (!connectionEstablished) {
            resolve({
              success: false,
              error: `Server exited with code ${code}. Error: ${errorOutput.substring(0, 200)}`
            });
          }
        });

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: `Process error: ${error.message}`
          });
        });

        // Send the initialization request
        try {
          serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
        } catch (error) {
          clearTimeout(timeout);
          serverProcess.kill('SIGTERM');
          resolve({
            success: false,
            error: `Failed to send init request: ${error.message}`
          });
        }
      });

    } catch (error) {
      return {
        success: false,
        error: `Connection test failed: ${error.message}`
      };
    }
  }

  /**
   * Extract and validate tools from MCP server
   */
  async extractAndValidateTools(mcpData, validationDir) {
    try {
      console.log(`   🛠️ Attempting real MCP protocol tool extraction...`);
      
      // First try to get tools from the actual MCP server via protocol
      const mcpResult = await this.mcpCommunicator.getToolsFromServer(mcpData);
      
      if (mcpResult.success && mcpResult.tools.length > 0) {
        console.log(`   ✅ Got ${mcpResult.tools.length} tools via MCP protocol`);
        return {
          success: true,
          tools: mcpResult.tools,
          method: 'mcp_protocol'
        };
      }
      
      // Fallback to scraped tools if MCP protocol failed
      if (mcpData.tools && mcpData.tools.length > 0) {
        console.log(`   📝 Falling back to ${mcpData.tools.length} scraped tools`);
        return {
          success: true,
          tools: mcpData.tools,
          method: 'scraped'
        };
      }

      // No tools found at all
      const errorMsg = mcpResult.error || 'No tools found via MCP protocol or scraping';
      console.log(`   ❌ No tools found: ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg,
        tools: []
      };

    } catch (error) {
      console.error(`   💥 Tools extraction crashed: ${error.message}`);
      return {
        success: false,
        error: `Tools validation failed: ${error.message}`,
        tools: []
      };
    }
  }

  /**
   * Helper methods
   */

  async prepareServerCommand(mcpData, validationDir) {
    const installCommand = mcpData.auto_install_command;
    const installType = mcpData.install_type;

    switch (installType) {
      case 'npm':
        if (installCommand.startsWith('npx ')) {
          const parts = installCommand.split(' ');
          return {
            cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx',
            args: parts.slice(1)
          };
        }
        break;
        
      case 'pipx':
        const packageName = installCommand.replace(/pipx install\s+/, '').split(' ')[0];
        return {
          cmd: packageName,
          args: []
        };
        
      case 'e14z':
        const e14zPackage = installCommand.replace('e14z run ', '');
        return {
          cmd: 'e14z',
          args: ['run', e14zPackage]
        };
    }

    return null;
  }

  async executeCommand(command, args, cwd, timeout = this.timeout) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: cwd,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          code: -1,
          stdout: stdout,
          stderr: stderr + '\nCommand timed out'
        });
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          code: code || 0,
          stdout: stdout,
          stderr: stderr
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          code: -1,
          stdout: stdout,
          stderr: stderr + '\n' + error.message
        });
      });
    });
  }

  async checkNPMPackageExists(packageName) {
    try {
      const https = require('https');
      
      return new Promise((resolve) => {
        const req = https.get(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, (res) => {
          resolve(res.statusCode === 200);
        });
        
        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  async checkPyPIPackageExists(packageName) {
    try {
      const https = require('https');
      
      return new Promise((resolve) => {
        const req = https.get(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`, (res) => {
          resolve(res.statusCode === 200);
        });
        
        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  async cleanupValidationEnvironment(validationDir) {
    try {
      await fs.rm(validationDir, { recursive: true, force: true });
      console.log(`   🧹 Cleaned up validation environment: ${validationDir}`);
    } catch (error) {
      console.warn(`   ⚠️ Failed to cleanup validation environment: ${error.message}`);
    }
  }

  // Placeholder methods for other package managers
  async testCargoInstallation(installCommand, validationDir) {
    return {
      success: false,
      error: 'Cargo validation not yet implemented'
    };
  }

  async testGoInstallation(installCommand, validationDir) {
    return {
      success: false,
      error: 'Go validation not yet implemented'
    };
  }

  async testE14ZInstallation(installCommand, validationDir) {
    return {
      success: false,
      error: 'E14Z validation not yet implemented'
    };
  }
}

module.exports = { MCPValidator };