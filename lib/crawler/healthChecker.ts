/**
 * MCP Health Checker
 * 
 * Tests MCP servers to verify they're live and working before adding to database
 * Can detect if MCP is responding even when authentication is required
 */

import { spawn } from 'child_process'
import { promisify } from 'util'

interface HealthCheckResult {
  isLive: boolean
  status: 'healthy' | 'requires_auth' | 'error' | 'unreachable'
  responseTime?: number
  protocolVersion?: string
  requiresAuth: boolean
  authType?: string
  capabilities?: {
    tools: boolean
    resources: boolean
    prompts: boolean
  }
  error?: string
  endpoint?: string
}

/**
 * MCP Health Checker Class
 */
export class MCPHealthChecker {
  private timeout: number

  constructor(timeout = 10000) {
    this.timeout = timeout
  }

  /**
   * Check if an MCP server is live and responding
   */
  async checkMCPHealth(mcpInfo: {
    name: string
    endpoint: string
    github_url?: string
    connection_type?: string
  }): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    console.log(`🔍 Health checking MCP: ${mcpInfo.name}`)

    try {
      // Try different health check methods based on endpoint type
      if (mcpInfo.endpoint.includes('docker')) {
        return await this.checkDockerMCP(mcpInfo, startTime)
      } else if (mcpInfo.endpoint.includes('npx')) {
        return await this.checkNPXMCP(mcpInfo, startTime)
      } else if (mcpInfo.endpoint.startsWith('http')) {
        return await this.checkHTTPMCP(mcpInfo, startTime)
      } else if (mcpInfo.endpoint.includes('uvx')) {
        return await this.checkUVXMCP(mcpInfo, startTime)
      } else {
        return await this.checkGenericMCP(mcpInfo, startTime)
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      console.log(`❌ Health check failed for ${mcpInfo.name}: ${error}`)
      
      return {
        isLive: false,
        status: 'error',
        responseTime,
        requiresAuth: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check Docker-based MCP
   */
  private async checkDockerMCP(mcpInfo: any, startTime: number): Promise<HealthCheckResult> {
    try {
      // Test if Docker image exists and can start
      const result = await this.runCommand('docker', ['pull', '--quiet', this.extractDockerImage(mcpInfo.endpoint)])
      
      if (result.success) {
        // Try to run with --help to see if it responds
        const helpResult = await this.runCommand('docker', [
          'run', '--rm', this.extractDockerImage(mcpInfo.endpoint), '--help'
        ], 5000)

        const responseTime = Date.now() - startTime
        
        if (helpResult.success || helpResult.output.includes('mcp') || helpResult.output.includes('protocol')) {
          return {
            isLive: true,
            status: 'healthy',
            responseTime,
            requiresAuth: this.detectAuthRequired(helpResult.output),
            authType: this.detectAuthType(helpResult.output),
            endpoint: mcpInfo.endpoint
          }
        }
      }

      const responseTime = Date.now() - startTime
      return {
        isLive: false,
        status: 'unreachable',
        responseTime,
        requiresAuth: false,
        error: 'Docker image not accessible'
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      return {
        isLive: false,
        status: 'error',
        responseTime,
        requiresAuth: false,
        error: error instanceof Error ? error.message : 'Docker check failed'
      }
    }
  }

  /**
   * Check NPX-based MCP
   */
  private async checkNPXMCP(mcpInfo: any, startTime: number): Promise<HealthCheckResult> {
    try {
      const packageName = this.extractNPXPackage(mcpInfo.endpoint)
      
      // Check if package exists on npm
      const response = await fetch(`https://registry.npmjs.org/${packageName}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })

      const responseTime = Date.now() - startTime

      if (response.ok) {
        const packageInfo = await response.json()
        
        // Check if it's actually an MCP server
        const isMCP = this.isMCPPackage(packageInfo)
        
        if (isMCP) {
          return {
            isLive: true,
            status: 'healthy',
            responseTime,
            requiresAuth: this.detectAuthFromPackage(packageInfo),
            authType: this.detectAuthTypeFromPackage(packageInfo),
            endpoint: mcpInfo.endpoint
          }
        } else {
          return {
            isLive: false,
            status: 'error',
            responseTime,
            requiresAuth: false,
            error: 'Package exists but does not appear to be an MCP server'
          }
        }
      } else {
        return {
          isLive: false,
          status: 'unreachable',
          responseTime,
          requiresAuth: false,
          error: `NPM package not found: ${packageName}`
        }
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      return {
        isLive: false,
        status: 'error',
        responseTime,
        requiresAuth: false,
        error: error instanceof Error ? error.message : 'NPX check failed'
      }
    }
  }

  /**
   * Check HTTP-based MCP (remote servers)
   */
  private async checkHTTPMCP(mcpInfo: any, startTime: number): Promise<HealthCheckResult> {
    try {
      const response = await fetch(mcpInfo.endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'E14Z-MCP-Checker/1.0'
        },
        signal: AbortSignal.timeout(this.timeout)
      })

      const responseTime = Date.now() - startTime

      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        
        if (contentType.includes('application/json') || contentType.includes('text/plain')) {
          return {
            isLive: true,
            status: 'healthy',
            responseTime,
            requiresAuth: false,
            endpoint: mcpInfo.endpoint
          }
        }
      } else if (response.status === 401 || response.status === 403) {
        return {
          isLive: true,
          status: 'requires_auth',
          responseTime,
          requiresAuth: true,
          authType: 'api_key',
          endpoint: mcpInfo.endpoint
        }
      }

      return {
        isLive: false,
        status: 'unreachable',
        responseTime,
        requiresAuth: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      return {
        isLive: false,
        status: 'error',
        responseTime,
        requiresAuth: false,
        error: error instanceof Error ? error.message : 'HTTP check failed'
      }
    }
  }

  /**
   * Check UVX-based MCP (Python UV)
   */
  private async checkUVXMCP(mcpInfo: any, startTime: number): Promise<HealthCheckResult> {
    try {
      const packageName = this.extractUVXPackage(mcpInfo.endpoint)
      
      // Check if UV is available
      const uvCheck = await this.runCommand('uvx', ['--help'], 2000)
      
      if (!uvCheck.success) {
        return {
          isLive: false,
          status: 'error',
          responseTime: Date.now() - startTime,
          requiresAuth: false,
          error: 'UV/UVX not available on system'
        }
      }

      // Try to get help for the package
      const helpResult = await this.runCommand('uvx', [packageName, '--help'], 5000)
      const responseTime = Date.now() - startTime

      if (helpResult.success || helpResult.output.includes('mcp') || helpResult.output.includes('protocol')) {
        return {
          isLive: true,
          status: 'healthy',
          responseTime,
          requiresAuth: this.detectAuthRequired(helpResult.output),
          authType: this.detectAuthType(helpResult.output),
          endpoint: mcpInfo.endpoint
        }
      }

      return {
        isLive: false,
        status: 'unreachable',
        responseTime,
        requiresAuth: false,
        error: 'UVX package not accessible or not MCP server'
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      return {
        isLive: false,
        status: 'error',
        responseTime,
        requiresAuth: false,
        error: error instanceof Error ? error.message : 'UVX check failed'
      }
    }
  }

  /**
   * Generic MCP check for unknown endpoint types
   */
  private async checkGenericMCP(mcpInfo: any, startTime: number): Promise<HealthCheckResult> {
    // If we have a GitHub URL, check if the repo is accessible and has MCP indicators
    if (mcpInfo.github_url) {
      try {
        const response = await fetch(mcpInfo.github_url, {
          method: 'GET',
          headers: { 'User-Agent': 'E14Z-MCP-Checker/1.0' },
          signal: AbortSignal.timeout(this.timeout)
        })

        const responseTime = Date.now() - startTime

        if (response.ok) {
          return {
            isLive: true,
            status: 'healthy',
            responseTime,
            requiresAuth: false, // Unknown, assume repo exists = potentially live
            endpoint: mcpInfo.endpoint
          }
        }
      } catch (error) {
        // Fall through to failure case
      }
    }

    const responseTime = Date.now() - startTime
    return {
      isLive: false,
      status: 'unreachable',
      responseTime,
      requiresAuth: false,
      error: 'Unable to verify MCP server status'
    }
  }

  /**
   * Run a command with timeout
   */
  private runCommand(command: string, args: string[], timeout = this.timeout): Promise<{
    success: boolean
    output: string
    error?: string
  }> {
    return new Promise((resolve) => {
      const process = spawn(command, args, { timeout })
      let output = ''
      let error = ''

      process.stdout?.on('data', (data) => {
        output += data.toString()
      })

      process.stderr?.on('data', (data) => {
        error += data.toString()
      })

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output + error,
          error: code !== 0 ? error : undefined
        })
      })

      process.on('error', (err) => {
        resolve({
          success: false,
          output: '',
          error: err.message
        })
      })

      // Timeout handler
      setTimeout(() => {
        process.kill('SIGTERM')
        resolve({
          success: false,
          output: '',
          error: 'Command timeout'
        })
      }, timeout)
    })
  }

  /**
   * Extract Docker image name from endpoint
   */
  private extractDockerImage(endpoint: string): string {
    const match = endpoint.match(/docker\s+run.*?([^\s]+\/[^\s]+)/)
    return match?.[1] || endpoint.split(' ').pop() || ''
  }

  /**
   * Extract NPX package name from endpoint
   */
  private extractNPXPackage(endpoint: string): string {
    const parts = endpoint.split(' ')
    const npxIndex = parts.findIndex(part => part === 'npx')
    return parts[npxIndex + 1]?.replace(/^-y\s+/, '') || ''
  }

  /**
   * Extract UVX package name from endpoint
   */
  private extractUVXPackage(endpoint: string): string {
    const parts = endpoint.split(' ')
    const uvxIndex = parts.findIndex(part => part === 'uvx')
    return parts[uvxIndex + 1] || ''
  }

  /**
   * Check if npm package is an MCP server
   */
  private isMCPPackage(packageInfo: any): boolean {
    const description = packageInfo.description?.toLowerCase() || ''
    const keywords = packageInfo.keywords || []
    const readme = packageInfo.readme?.toLowerCase() || ''

    return (
      description.includes('mcp') ||
      description.includes('model context protocol') ||
      keywords.includes('mcp') ||
      keywords.includes('model-context-protocol') ||
      readme.includes('mcp') ||
      readme.includes('model context protocol')
    )
  }

  /**
   * Detect if authentication is required from output
   */
  private detectAuthRequired(output: string): boolean {
    const indicators = [
      'api key', 'api_key', 'token', 'auth', 'credential',
      'password', 'secret', 'bearer', 'authorization'
    ]
    
    const lowerOutput = output.toLowerCase()
    return indicators.some(indicator => lowerOutput.includes(indicator))
  }

  /**
   * Detect authentication type from output
   */
  private detectAuthType(output: string): string | undefined {
    const lowerOutput = output.toLowerCase()
    
    if (lowerOutput.includes('api key') || lowerOutput.includes('api_key')) return 'api_key'
    if (lowerOutput.includes('token')) return 'token'
    if (lowerOutput.includes('bearer')) return 'bearer'
    if (lowerOutput.includes('oauth')) return 'oauth'
    if (lowerOutput.includes('secret')) return 'secret'
    
    return undefined
  }

  /**
   * Detect auth requirements from npm package info
   */
  private detectAuthFromPackage(packageInfo: any): boolean {
    const readme = packageInfo.readme?.toLowerCase() || ''
    const description = packageInfo.description?.toLowerCase() || ''
    
    return this.detectAuthRequired(readme + ' ' + description)
  }

  /**
   * Detect auth type from npm package info
   */
  private detectAuthTypeFromPackage(packageInfo: any): string | undefined {
    const readme = packageInfo.readme?.toLowerCase() || ''
    const description = packageInfo.description?.toLowerCase() || ''
    
    return this.detectAuthType(readme + ' ' + description)
  }
}

/**
 * Singleton health checker instance
 */
export const mcpHealthChecker = new MCPHealthChecker()

/**
 * Quick health check function
 */
export async function checkMCPHealth(mcpInfo: {
  name: string
  endpoint: string
  github_url?: string
  connection_type?: string
}): Promise<HealthCheckResult> {
  return mcpHealthChecker.checkMCPHealth(mcpInfo)
}