/**
 * E14Z Claiming System - Allow developers to claim wrapped MCPs
 */

class ClaimingManager {
  constructor(authManager, baseUrl) {
    this.authManager = authManager;
    this.baseUrl = baseUrl || process.env.E14Z_API_URL || 'https://www.e14z.com';
  }

  /**
   * Verify ownership of an MCP through GitHub
   */
  async verifyGitHubOwnership(mcpSlug, githubUrl) {
    try {
      const headers = await this.authManager.getGitHubHeaders();
      
      // Extract repo info from GitHub URL
      const repoMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) {
        throw new Error('Invalid GitHub URL format');
      }
      
      const [, owner, repo] = repoMatch;
      
      // Check if authenticated user has access to this repo
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Repository not found or no access');
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const repoData = await response.json();
      
      // Check if user has push access (owner, collaborator, or organization member)
      const permissionsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/collaborators`, {
        headers
      });
      
      const user = await this.authManager.getCurrentUser();
      
      // User is owner
      if (repoData.owner.login === user.login) {
        return {
          verified: true,
          method: 'owner',
          repo: repoData
        };
      }
      
      // Check if user is a collaborator
      if (permissionsResponse.ok) {
        const collaborators = await permissionsResponse.json();
        const isCollaborator = collaborators.some(collab => collab.login === user.login);
        
        if (isCollaborator) {
          return {
            verified: true,
            method: 'collaborator',
            repo: repoData
          };
        }
      }
      
      // Check organization membership
      if (repoData.owner.type === 'Organization') {
        const orgResponse = await fetch(`https://api.github.com/orgs/${owner}/members/${user.login}`, {
          headers
        });
        
        if (orgResponse.status === 204) {
          return {
            verified: true,
            method: 'organization_member',
            repo: repoData
          };
        }
      }
      
      return {
        verified: false,
        reason: 'No ownership or collaboration access found'
      };
      
    } catch (error) {
      throw new Error(`Ownership verification failed: ${error.message}`);
    }
  }

  /**
   * Alternative verification through package.json
   */
  async verifyPackageOwnership(mcpSlug, packageName) {
    try {
      const headers = await this.authManager.getGitHubHeaders();
      const fetch = (await import('node-fetch')).default;
      
      // Get npm package info
      const npmResponse = await fetch(`https://registry.npmjs.org/${packageName}`);
      if (!npmResponse.ok) {
        throw new Error(`Package ${packageName} not found on npm`);
      }
      
      const packageData = await npmResponse.json();
      const user = await this.authManager.getCurrentUser();
      
      // Check if user is a maintainer
      const maintainers = packageData.maintainers || [];
      const isMaintainer = maintainers.some(maintainer => 
        maintainer.email === user.email || maintainer.name === user.login
      );
      
      if (isMaintainer) {
        return {
          verified: true,
          method: 'npm_maintainer',
          package: packageData
        };
      }
      
      // Check GitHub repository if available
      if (packageData.repository?.url) {
        const repoUrl = packageData.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
        if (repoUrl.includes('github.com')) {
          return await this.verifyGitHubOwnership(mcpSlug, repoUrl);
        }
      }
      
      return {
        verified: false,
        reason: 'Not listed as package maintainer'
      };
      
    } catch (error) {
      throw new Error(`Package verification failed: ${error.message}`);
    }
  }

  /**
   * Submit claim for an MCP
   */
  async claimMCP(mcpSlug, claimData) {
    const isAuth = await this.authManager.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication required. Run "e14z auth login" first.');
    }

    try {
      const headers = await this.authManager.getGitHubHeaders();
      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${this.baseUrl}/api/claim`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mcp_slug: mcpSlug,
          ...claimData
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(error.error || error.message || `Claim failed: ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      throw new Error(`Failed to claim MCP: ${error.message}`);
    }
  }

  /**
   * Get claimable MCPs (wrapped MCPs without owners)
   */
  async getClaimableMCPs() {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(`${this.baseUrl}/api/claimable`, {
        timeout: 10000,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Failed to get claimable MCPs: ${response.status}`);
      }

      const data = await response.json();
      return data.mcps || [];

    } catch (error) {
      throw new Error(`Failed to get claimable MCPs: ${error.message}`);
    }
  }

  /**
   * Check if MCP is claimable
   */
  async isClaimable(mcpSlug) {
    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(`${this.baseUrl}/api/mcp/${mcpSlug}`, {
        timeout: 10000,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`MCP not found: ${response.status}`);
      }

      const data = await response.json();
      const mcp = data.mcp;

      return {
        claimable: mcp.source_type === 'wrapped' && !mcp.claimed_by,
        mcp: mcp,
        reason: mcp.claimed_by ? 'Already claimed' : 
                mcp.source_type === 'published' ? 'Originally published' : 
                'Available for claiming'
      };

    } catch (error) {
      throw new Error(`Failed to check claimability: ${error.message}`);
    }
  }

  /**
   * Start interactive claiming process
   */
  async interactiveClaim(mcpSlug) {
    const inquirer = require('inquirer');
    
    // Check if claimable
    const claimStatus = await this.isClaimable(mcpSlug);
    if (!claimStatus.claimable) {
      throw new Error(`MCP ${mcpSlug} is not claimable: ${claimStatus.reason}`);
    }

    const mcp = claimStatus.mcp;
    
    console.log(`\n📦 Claiming MCP: ${mcp.name}`);
    console.log(`Description: ${mcp.description}`);
    console.log(`Current endpoint: ${mcp.endpoint}\n`);

    // Choose verification method
    const methodAnswer = await inquirer.prompt([{
      type: 'list',
      name: 'method',
      message: 'How would you like to verify ownership?',
      choices: [
        { name: 'GitHub Repository', value: 'github' },
        { name: 'npm Package', value: 'npm' },
        { name: 'Manual Review', value: 'manual' }
      ]
    }]);

    let verification = null;
    
    switch (methodAnswer.method) {
      case 'github':
        const githubAnswer = await inquirer.prompt([{
          type: 'input',
          name: 'url',
          message: 'GitHub repository URL:',
          validate: input => input.includes('github.com') || 'Please enter a valid GitHub URL'
        }]);
        
        console.log('🔍 Verifying GitHub ownership...');
        verification = await this.verifyGitHubOwnership(mcpSlug, githubAnswer.url);
        break;
        
      case 'npm':
        const npmAnswer = await inquirer.prompt([{
          type: 'input',
          name: 'package',
          message: 'npm package name:',
          validate: input => input.length > 0 || 'Package name is required'
        }]);
        
        console.log('🔍 Verifying npm package ownership...');
        verification = await this.verifyPackageOwnership(mcpSlug, npmAnswer.package);
        break;
        
      case 'manual':
        const manualAnswer = await inquirer.prompt([{
          type: 'input',
          name: 'evidence',
          message: 'Provide evidence of ownership (description):',
          validate: input => input.length >= 20 || 'Please provide detailed evidence'
        }]);
        
        verification = {
          verified: false,
          method: 'manual',
          evidence: manualAnswer.evidence
        };
        break;
    }

    // Additional claim information
    const claimInfo = await inquirer.prompt([
      {
        type: 'input',
        name: 'contact_email',
        message: 'Contact email (optional):'
      },
      {
        type: 'input',
        name: 'additional_info',
        message: 'Additional information (optional):'
      }
    ]);

    const claimData = {
      verification_method: methodAnswer.method,
      verification_data: verification,
      contact_email: claimInfo.contact_email,
      additional_info: claimInfo.additional_info
    };

    return await this.claimMCP(mcpSlug, claimData);
  }
}

module.exports = { ClaimingManager };