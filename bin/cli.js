#!/usr/bin/env node

/**
 * E14Z CLI - The npm for AI agents
 * Discover, install, and run Model Context Protocol (MCP) servers
 */

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');

// Import our modules
const { EnhancedExecutionEngine } = require('../lib/execution/enhanced-engine');
const { AuthManager } = require('../lib/auth/manager');
const { MCPPublisher } = require('../lib/publishing/publisher');
const { ClaimingManager } = require('../lib/claiming/manager');

const program = new Command();
const authManager = new AuthManager();
const executionEngine = new EnhancedExecutionEngine();
const mcpPublisher = new MCPPublisher(authManager);
const claimingManager = new ClaimingManager(authManager);

// Package info
const packageJson = require('../package.json');

/**
 * Bootstrap mechanism - auto-install globally if running via npx
 */
async function bootstrapGlobalInstallation() {
  // Better NPX detection
  const execPath = process.argv[1] || '';
  
  
  const isNpx = (
    // NPX environment variables
    process.env.npm_execpath && process.env.npm_execpath.includes('npx') ||
    process.env.npm_config_user_config && process.env.npm_config_user_config.includes('_npx') ||
    // NPX in process path
    execPath.includes('_npx') ||
    execPath.includes('npx') ||
    // Running from local node_modules (not global)
    execPath.includes('node_modules') && !execPath.includes('/usr/') && !execPath.includes('/opt/') ||
    // Check npm prefix to see if we're in a temp directory
    process.env.npm_config_prefix && process.env.npm_config_prefix.includes('tmp')
  );
  
  if (!isNpx) {
    return; // Likely globally installed or direct execution
  }
  
  // Check if e14z is already globally available (quick check)
  try {
    execSync('e14z --version', { stdio: 'pipe', timeout: 2000 });
    return; // Already globally installed and working
  } catch (error) {
    // Not globally installed or not working
  }
  
  // Only auto-install after successful operation (not for help/version commands)
  const args = process.argv.slice(2);
  const isOperationalCommand = args.length > 0 && 
    ['run', 'discover', 'publish', 'claim', 'cache', 'auth'].includes(args[0]);
  
  if (!isOperationalCommand) {
    return; // Don't auto-install for help/version commands
  }
  
  // Store flag to trigger post-execution installation
  global._shouldBootstrap = true;
  
  console.log(chalk.gray('💡 Running via npx - will set up direct access after successful operation'));
}

/**
 * Perform the actual global installation after successful operation
 */
async function performGlobalInstallation() {
  if (!global._shouldBootstrap) {
    return;
  }
  
  console.log(chalk.cyan('\n🚀 Setting up e14z for direct access...'));
  
  try {
    // Install globally
    const installProcess = spawn('npm', ['install', '-g', `e14z@${packageJson.version}`], {
      stdio: 'pipe'
    });
    
    let output = '';
    installProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    installProcess.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    await new Promise((resolve, reject) => {
      installProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Installation failed: ${output}`));
        }
      });
    });
    
    console.log(chalk.green('✅ e14z installed globally!'));
    console.log(chalk.gray('You can now use "e14z run <mcp>" directly in any terminal or automation tool.'));
    console.log(chalk.gray('No more npx needed! 🎉\n'));
    
  } catch (error) {
    console.log(chalk.yellow('\n⚠️ Could not install e14z globally (this is okay)'));
    console.log(chalk.gray('You can still use: npx e14z@latest <command>'));
    console.log(chalk.gray(`Or install manually: npm install -g e14z@${packageJson.version}\n`));
  }
}

program
  .name('e14z')
  .description('The npm for AI agents - Discover, install, and run MCP servers')
  .version(packageJson.version);

/**
 * Discovery and Search Commands
 */
program
  .command('discover [query]')
  .alias('search')
  .description('Discover MCP servers by capabilities or keywords')
  .option('-v, --verified', 'Only show verified MCPs')
  .option('-l, --limit <number>', 'Maximum number of results', '10')
  .option('-c, --category <category>', 'Filter by category')
  .option('--executable', 'Only show MCPs that can be executed directly')
  .action(async (query, options) => {
    const spinner = ora('Searching MCP registry...').start();
    
    try {
      const fetch = (await import('node-fetch')).default;
      const baseUrl = process.env.E14Z_API_URL || 'https://www.e14z.com';
      
      const url = new URL('/api/discover', baseUrl);
      if (query) url.searchParams.set('q', query);
      if (options.verified) url.searchParams.set('verified', 'true');
      if (options.limit) url.searchParams.set('limit', options.limit);
      if (options.category) url.searchParams.set('category', options.category);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      spinner.stop();
      
      if (data.error) {
        console.error(chalk.red('Error:'), data.error);
        process.exit(1);
      }
      
      let results = data.results || [];
      
      // Filter executable if requested
      if (options.executable) {
        results = results.filter(mcp => mcp.clean_command);
      }
      
      if (results.length === 0) {
        console.log(chalk.yellow('No MCPs found matching your criteria.'));
        return;
      }
      
      console.log(chalk.bold(`\n🔍 Found ${results.length} MCP${results.length === 1 ? '' : 's'}:\n`));
      
      results.forEach((mcp, index) => {
        const executable = mcp.clean_command ? chalk.green('✓ Executable') : chalk.gray('○ Discovery only');
        const verified = mcp.verified ? chalk.blue('✓ Verified') : chalk.gray('○ Community');
        const authStatus = mcp.auth_method === 'none' ? 
          chalk.green('No auth') : 
          chalk.yellow(`Auth: ${mcp.auth_method || 'unknown'}`);
        
        console.log(`${chalk.bold(index + 1)}. ${chalk.cyan(mcp.name)} ${chalk.gray(`(${mcp.slug})`)}`);
        console.log(`   ${mcp.description}`);
        console.log(`   ${executable} | ${verified} | ${authStatus}`);
        console.log(`   Category: ${mcp.category} | Tools: ${mcp.tools?.count || 0}`);
        
        if (mcp.clean_command) {
          console.log(`   ${chalk.green('▶')} Run: ${chalk.bold(`e14z run ${mcp.slug}`)}`);
        } else {
          console.log(`   ${chalk.gray('📖')} Setup: ${chalk.bold(`e14z info ${mcp.slug}`)}`);
        }
        console.log();
      });
      
      console.log(chalk.gray(`💡 Use ${chalk.bold('e14z info <slug>')} for detailed information`));
      console.log(chalk.gray(`💡 Use ${chalk.bold('e14z run <slug>')} to execute directly`));
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Discovery failed:'), error.message);
      process.exit(1);
    }
  });

/**
 * Info Command
 */
program
  .command('info <slug>')
  .description('Get detailed information about an MCP server')
  .action(async (slug) => {
    const spinner = ora('Fetching MCP details...').start();
    
    try {
      const mcp = await executionEngine.getMCPDetails(slug);
      spinner.stop();
      
      console.log(chalk.bold.cyan(`\n📦 ${mcp.name}\n`));
      console.log(`${mcp.description}\n`);
      
      // Status badges
      const badges = [];
      if (mcp.verified) badges.push(chalk.blue('✓ Verified'));
      if (mcp.clean_command) badges.push(chalk.green('✓ Executable'));
      if (mcp.auth_method === 'none') badges.push(chalk.green('✓ No auth required'));
      
      if (badges.length > 0) {
        console.log(`Status: ${badges.join(' | ')}\n`);
      }
      
      // Basic info
      console.log(chalk.bold('Details:'));
      console.log(`  Category: ${mcp.category}`);
      console.log(`  Tools: ${mcp.tools?.length || 0} available`);
      console.log(`  Health: ${mcp.health_status || 'Unknown'}\n`);
      
      // Authentication
      const authReqs = executionEngine.detectAuthRequirements(mcp);
      console.log(chalk.bold('Authentication:'));
      if (authReqs.required) {
        console.log(chalk.yellow(`  Required: ${authReqs.type}`));
        authReqs.instructions.forEach(instruction => {
          console.log(`  • ${instruction}`);
        });
      } else {
        console.log(chalk.green('  None required'));
      }
      console.log();
      
      // Installation/Execution
      console.log(chalk.bold('Usage:'));
      if (mcp.clean_command) {
        console.log(chalk.green(`  e14z run ${mcp.slug}`));
        console.log(`  Direct command: ${mcp.clean_command}`);
      } else {
        console.log(`  Manual setup: ${mcp.endpoint}`);
        console.log(chalk.gray('  This MCP requires manual configuration for Claude Desktop'));
      }
      console.log();
      
      // Tools
      if (mcp.tools && mcp.tools.length > 0) {
        console.log(chalk.bold('Available Tools:'));
        mcp.tools.slice(0, 5).forEach(tool => {
          console.log(`  • ${chalk.cyan(tool.name)}: ${tool.description || 'No description'}`);
        });
        if (mcp.tools.length > 5) {
          console.log(`  ... and ${mcp.tools.length - 5} more`);
        }
        console.log();
      }
      
      // Use cases
      if (mcp.use_cases && mcp.use_cases.length > 0) {
        console.log(chalk.bold('Use Cases:'));
        mcp.use_cases.slice(0, 3).forEach(useCase => {
          console.log(`  • ${useCase}`);
        });
        console.log();
      }
      
      // Links
      const links = [];
      if (mcp.github_url) links.push(`GitHub: ${mcp.github_url}`);
      if (mcp.documentation_url) links.push(`Docs: ${mcp.documentation_url}`);
      if (mcp.website_url) links.push(`Website: ${mcp.website_url}`);
      
      if (links.length > 0) {
        console.log(chalk.bold('Resources:'));
        links.forEach(link => {
          console.log(`  ${link}`);
        });
      }
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Failed to get MCP info:'), error.message);
      process.exit(1);
    }
  });

/**
 * Run Command - Execute MCP directly with auto-installation
 */
program
  .command('run <slug>')
  .description('Execute an MCP server directly (with auto-installation)')
  .option('--skip-auth-check', 'Skip authentication requirement check')
  .option('--stdio', 'Use stdio mode (default for MCP protocol)')
  .option('--no-auto-install', 'Disable auto-installation')
  .action(async (slug, options) => {
    try {
      // Configure auto-installation
      if (options.noAutoInstall) {
        executionEngine.enableAutoInstall = false;
      }
      
      const result = await executionEngine.executeMCP(slug, {
        skipAuthCheck: options.skipAuthCheck,
        stdio: options.stdio ? 'inherit' : 'pipe'
      });
      
      if (!result.success) {
        if (result.authRequired) {
          console.log(chalk.yellow(`\n🔐 Authentication Required\n`));
          console.log(`MCP "${slug}" requires ${result.authType} authentication:\n`);
          
          result.instructions.forEach(instruction => {
            console.log(`  • ${instruction}`);
          });
          
          console.log(`\n${chalk.gray('Set up the required authentication and try again.')}`);
          console.log(`${chalk.gray('Or use --skip-auth-check to run anyway.')}\n`);
          
          const answer = await inquirer.prompt([{
            type: 'confirm',
            name: 'continue',
            message: 'Do you want to run without authentication check?',
            default: false
          }]);
          
          if (answer.continue) {
            return program.parseAsync(['run', slug, '--skip-auth-check'], { from: 'user' });
          }
          
          process.exit(1);
        } else {
          console.error(chalk.red('Execution failed:'), result.error);
          
          // Show auto-installation hint if not already attempted
          if (!result.error.includes('auto-install') && !options.noAutoInstall) {
            console.log(chalk.gray('💡 Tip: E14Z can auto-install MCPs that aren\'t locally available'));
          }
          
          process.exit(1);
        }
      }
      
      if (result.autoInstalled) {
        console.log(chalk.green(`\n🤖 Auto-installed and executed ${slug}`));
        console.log(chalk.gray(`Cache location: ${result.cachePath || 'N/A'}`));
      }
      
      if (options.stdio) {
        // In stdio mode, the process runs directly
        console.log(chalk.green(`\n✓ MCP ${slug} started in stdio mode`));
      } else {
        // Show execution results
        console.log(chalk.green(`\n✓ MCP ${slug} executed successfully`));
        console.log(chalk.gray(`Command: ${result.command}\n`));
        
        if (result.output) {
          console.log('Output:');
          console.log(result.output);
        }
        
        if (result.error) {
          console.log(chalk.yellow('Errors:'));
          console.log(result.error);
        }
      }
      
    } catch (error) {
      console.error(chalk.red('Execution failed:'), error.message);
      process.exit(1);
    }
  });

/**
 * Cache Management Commands
 */
const cacheCommand = program
  .command('cache')
  .description('Auto-installation cache management');

cacheCommand
  .command('list')
  .alias('ls')
  .description('List cached MCPs')
  .action(async () => {
    try {
      const spinner = ora('Loading cached MCPs...').start();
      const result = await executionEngine.listCached();
      spinner.stop();
      
      if (!result.success) {
        console.error(chalk.red('Failed to list cache:'), result.error);
        process.exit(1);
      }
      
      if (result.cached.length === 0) {
        console.log(chalk.yellow('No cached MCPs found.'));
        console.log(chalk.gray('Use `e14z run <slug>` to auto-install and cache MCPs.'));
        return;
      }
      
      console.log(chalk.bold(`\n🗄️ Cached MCPs (${result.cached.length}):\n`));
      
      result.cached.forEach((item, index) => {
        const installedAt = item.installed_at !== 'unknown' ? 
          new Date(item.installed_at).toLocaleString() : 
          'Unknown';
        
        console.log(`${chalk.bold(index + 1)}. ${chalk.cyan(item.slug)}`);
        console.log(`   Path: ${chalk.gray(item.path)}`);
        console.log(`   Installed: ${installedAt}`);
        console.log(`   ${chalk.green('▶')} Run: ${chalk.bold(`e14z run ${item.slug}`)}`);
        console.log(`   ${chalk.red('🗑️')} Clear: ${chalk.bold(`e14z cache clear ${item.slug}`)}`);
        console.log();
      });
      
      console.log(chalk.gray(`💡 Use ${chalk.bold('e14z cache clear <slug>')} to remove specific MCPs`));
      console.log(chalk.gray(`💡 Use ${chalk.bold('e14z cache clear --all')} to clear all cached MCPs`));
      
    } catch (error) {
      console.error(chalk.red('Cache list failed:'), error.message);
      process.exit(1);
    }
  });

cacheCommand
  .command('clear [slug]')
  .description('Clear cached MCP installations')
  .option('--all', 'Clear all cached MCPs')
  .action(async (slug, options) => {
    try {
      if (options.all) {
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Clear all cached MCPs?',
          default: false
        }]);
        
        if (!answer.confirm) {
          console.log(chalk.yellow('Cache clear cancelled.'));
          return;
        }
        
        const spinner = ora('Clearing all cached MCPs...').start();
        
        // Get all cached items and clear them individually
        const listResult = await executionEngine.listCached();
        if (listResult.success) {
          for (const item of listResult.cached) {
            await executionEngine.clearCache(item.slug);
          }
        }
        
        spinner.stop();
        console.log(chalk.green('✅ All cached MCPs cleared.'));
        
      } else if (slug) {
        const spinner = ora(`Clearing cache for ${slug}...`).start();
        const result = await executionEngine.clearCache(slug);
        spinner.stop();
        
        if (result.success) {
          console.log(chalk.green(`✅ Cache cleared for ${slug}`));
        } else {
          console.error(chalk.red('Cache clear failed:'), result.error);
          process.exit(1);
        }
        
      } else {
        console.log(chalk.yellow('Please specify a slug or use --all'));
        console.log(chalk.gray('Usage: e14z cache clear <slug> | e14z cache clear --all'));
      }
      
    } catch (error) {
      console.error(chalk.red('Cache clear failed:'), error.message);
      process.exit(1);
    }
  });

cacheCommand
  .command('info [slug]')
  .description('Show cache information and auto-install capabilities')
  .action(async (slug) => {
    try {
      if (slug) {
        // Check auto-install capability for specific slug
        const spinner = ora('Checking auto-install capability...').start();
        const capability = await executionEngine.canAutoInstall(slug);
        spinner.stop();
        
        console.log(chalk.bold(`\n🤖 Auto-install capability for ${slug}:\n`));
        
        if (capability.available) {
          console.log(chalk.green('✅ Auto-installation available'));
          console.log(`Method: ${capability.method}`);
          console.log(`Command: ${capability.command}`);
        } else {
          console.log(chalk.red('❌ Auto-installation not available'));
          console.log(`Reason: ${capability.error}`);
        }
        
      } else {
        // Show general cache info
        const spinner = ora('Loading cache information...').start();
        const listResult = await executionEngine.listCached();
        spinner.stop();
        
        if (!listResult.success) {
          console.error(chalk.red('Failed to load cache info:'), listResult.error);
          process.exit(1);
        }
        
        console.log(chalk.bold('\n🗄️ Cache Information:\n'));
        console.log(`Cached MCPs: ${listResult.cached.length}`);
        
        if (listResult.cached.length > 0) {
          const totalSize = listResult.cached.reduce((size, item) => {
            // Estimate size (this would be more accurate with actual directory size calculation)
            return size + 10; // 10MB estimate per package
          }, 0);
          
          console.log(`Estimated size: ${totalSize}MB`);
          console.log(`Cache location: ~/.e14z/cache/`);
        }
        
        console.log('\nAuto-installation features:');
        console.log('  ✓ NPM packages (npx commands)');
        console.log('  ✓ Python packages (pip install)');
        console.log('  ✓ Git repositories (git clone)');
        console.log('  ✓ Security scanning and verification');
        console.log('  ✓ Automatic dependency resolution');
        console.log('  ✓ Transaction rollback on failures');
      }
      
    } catch (error) {
      console.error(chalk.red('Cache info failed:'), error.message);
      process.exit(1);
    }
  });

/**
 * List Command
 */
program
  .command('list')
  .alias('ls')
  .description('List all available MCPs with execution status')
  .option('--executable-only', 'Only show executable MCPs')
  .option('--auth-required', 'Only show MCPs that require authentication')
  .option('--no-auth', 'Only show MCPs that require no authentication')
  .action(async (options) => {
    const spinner = ora('Loading MCP registry...').start();
    
    try {
      let mcps = await executionEngine.listExecutableMCPs();
      
      // Apply filters
      if (options.executableOnly) {
        mcps = mcps.filter(mcp => mcp.executable);
      }
      
      if (options.authRequired) {
        mcps = mcps.filter(mcp => mcp.auth_required);
      }
      
      if (options.noAuth) {
        mcps = mcps.filter(mcp => !mcp.auth_required);
      }
      
      spinner.stop();
      
      if (mcps.length === 0) {
        console.log(chalk.yellow('No MCPs found matching your criteria.'));
        return;
      }
      
      console.log(chalk.bold(`\n📋 Available MCPs (${mcps.length}):\n`));
      
      mcps.forEach((mcp, index) => {
        const status = mcp.executable ? chalk.green('✓') : chalk.gray('○');
        const auth = mcp.auth_required ? chalk.yellow(`🔐 ${mcp.auth_type}`) : chalk.green('🔓 None');
        const verified = mcp.verified ? chalk.blue('✓') : chalk.gray('○');
        
        console.log(`${status} ${chalk.cyan(mcp.slug.padEnd(20))} ${auth.padEnd(15)} ${verified} ${mcp.category}`);
      });
      
      console.log();
      console.log(chalk.gray('Legend:'));
      console.log(chalk.gray('  ✓ = Executable | ○ = Discovery only | 🔐 = Auth required | 🔓 = No auth | ✓ = Verified'));
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Failed to list MCPs:'), error.message);
      process.exit(1);
    }
  });

/**
 * Authentication Commands
 */
const authCommand = program
  .command('auth')
  .description('Authentication management');

authCommand
  .command('login')
  .description('Authenticate with GitHub for publishing and claiming')
  .action(async () => {
    try {
      const isAuth = await authManager.isAuthenticated();
      if (isAuth) {
        const user = await authManager.getCurrentUser();
        console.log(chalk.green(`Already authenticated as ${user.login} (${user.name})`));
        return;
      }
      
      console.log(chalk.bold('🔐 E14Z GitHub Authentication\n'));
      console.log('This will authenticate you for:');
      console.log('  • Publishing MCPs to the registry');
      console.log('  • Claiming wrapped MCPs');
      console.log('  • Enhanced CLI features\n');
      
      const spinner = ora('Starting GitHub authentication...').start();
      
      const deviceFlow = await authManager.startGitHubAuth();
      
      spinner.stop();
      
      console.log(chalk.bold('Please authenticate with GitHub:'));
      console.log(`\n  1. Open: ${chalk.cyan(deviceFlow.verification_uri)}`);
      console.log(`  2. Enter code: ${chalk.bold.yellow(deviceFlow.user_code)}\n`);
      
      const pollSpinner = ora('Waiting for authentication...').start();
      
      const credentials = await authManager.pollGitHubAuth(
        deviceFlow.device_code, 
        deviceFlow.interval
      );
      
      pollSpinner.stop();
      
      console.log(chalk.green(`\n✅ Successfully authenticated as ${credentials.user.login}!`));
      console.log(`Welcome, ${credentials.user.name || credentials.user.login}!\n`);
      
    } catch (error) {
      console.error(chalk.red('Authentication failed:'), error.message);
      process.exit(1);
    }
  });

authCommand
  .command('status')
  .description('Check authentication status')
  .action(async () => {
    try {
      const isAuth = await authManager.isAuthenticated();
      
      if (isAuth) {
        const user = await authManager.getCurrentUser();
        console.log(chalk.green('✅ Authenticated'));
        console.log(`User: ${user.login} (${user.name})`);
        console.log(`Email: ${user.email || 'Not public'}`);
        console.log(`Authenticated: ${new Date(user.authenticated_at || Date.now()).toLocaleString()}`);
      } else {
        console.log(chalk.yellow('❌ Not authenticated'));
        console.log(`Run ${chalk.bold('e14z auth login')} to authenticate`);
      }
    } catch (error) {
      console.error(chalk.red('Failed to check auth status:'), error.message);
      process.exit(1);
    }
  });

authCommand
  .command('logout')
  .description('Sign out and remove credentials')
  .action(async () => {
    try {
      await authManager.signOut();
      console.log(chalk.green('✅ Signed out successfully'));
    } catch (error) {
      console.error(chalk.red('Failed to sign out:'), error.message);
      process.exit(1);
    }
  });

/**
 * Publishing Commands
 */
const publishCommand = program
  .command('publish')
  .description('Publish and manage MCPs');

publishCommand
  .command('new [name]')
  .description('Publish a new MCP to the registry')
  .option('-f, --file <file>', 'Use package file instead of interactive mode')
  .action(async (name, options) => {
    try {
      const isAuth = await authManager.isAuthenticated();
      if (!isAuth) {
        console.log(chalk.yellow('Authentication required for publishing.'));
        console.log(`Run ${chalk.bold('e14z auth login')} first.`);
        process.exit(1);
      }

      let packageData;

      if (options.file) {
        // Load from file
        try {
          const fileContent = await fs.readFile(options.file, 'utf8');
          packageData = JSON.parse(fileContent);
        } catch (error) {
          console.error(chalk.red('Failed to read package file:'), error.message);
          process.exit(1);
        }
      } else {
        // Interactive mode
        if (!name) {
          const nameAnswer = await inquirer.prompt([{
            type: 'input',
            name: 'name',
            message: 'MCP name:',
            validate: input => input.length >= 3 || 'Name must be at least 3 characters'
          }]);
          name = nameAnswer.name;
        }

        console.log(chalk.bold(`\n📦 Creating MCP: ${name}\n`));

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Description:',
            validate: input => input.length >= 10 || 'Description must be at least 10 characters'
          },
          {
            type: 'input',
            name: 'endpoint',
            message: 'Command/endpoint (e.g., "npx my-package"):',
            validate: input => input.length >= 3 || 'Endpoint is required'
          },
          {
            type: 'list',
            name: 'category',
            message: 'Category:',
            choices: [
              'payments', 'databases', 'content-creation', 'ai-tools', 
              'development-tools', 'cloud-storage', 'communication', 
              'infrastructure', 'productivity', 'project-management',
              'security', 'social-media', 'web-apis', 'finance', 
              'research', 'iot', 'other'
            ]
          },
          {
            type: 'list',
            name: 'auth_method',
            message: 'Authentication required:',
            choices: [
              { name: 'None', value: 'none' },
              { name: 'API Key', value: 'api_key' },
              { name: 'OAuth', value: 'oauth' },
              { name: 'Credentials', value: 'credentials' }
            ]
          },
          {
            type: 'input',
            name: 'github_url',
            message: 'GitHub URL (optional):'
          },
          {
            type: 'input',
            name: 'documentation_url',
            message: 'Documentation URL (optional):'
          }
        ]);

        packageData = {
          name,
          ...answers,
          tools: [],
          use_cases: [],
          tags: []
        };

        // Ask about tools
        const addTools = await inquirer.prompt([{
          type: 'confirm',
          name: 'addTools',
          message: 'Add tool information?',
          default: true
        }]);

        if (addTools.addTools) {
          while (true) {
            const toolAnswers = await inquirer.prompt([
              {
                type: 'input',
                name: 'name',
                message: 'Tool name (leave empty to finish adding tools):'
              },
              {
                type: 'input',
                name: 'description',
                message: 'Tool description:',
                when: (answers) => answers.name,
              }
            ]);

            if (!toolAnswers.name) break;
            
            const tool = {
                name: toolAnswers.name,
                description: toolAnswers.description,
                inputSchema: {
                    type: "object",
                    properties: {},
                    required: []
                }
            };

            // Ask for parameters
            const addParams = await inquirer.prompt([{
                type: 'confirm',
                name: 'continue',
                message: 'Add parameters to this tool?',
                default: true
            }]);

            if (addParams.continue) {
                while (true) {
                    const paramAnswers = await inquirer.prompt([
                        { type: 'input', name: 'name', message: 'Parameter name (leave empty to finish):' },
                        { type: 'list', name: 'type', message: 'Parameter type:', choices: ['string', 'number', 'boolean', 'object', 'array'], when: (answers) => answers.name },
                        { type: 'input', name: 'description', message: 'Parameter description:', when: (answers) => answers.name },
                        { type: 'confirm', name: 'required', message: 'Is this parameter required?', default: true, when: (answers) => answers.name },
                    ]);

                    if (!paramAnswers.name) break;

                    tool.inputSchema.properties[paramAnswers.name] = {
                        type: paramAnswers.type,
                        description: paramAnswers.description
                    };

                    if (paramAnswers.required) {
                        tool.inputSchema.required.push(paramAnswers.name);
                    }
                }
            }

            packageData.tools.push(tool);

            const addMore = await inquirer.prompt([{
              type: 'confirm',
              name: 'continue',
              message: 'Add another tool?',
              default: false
            }]);

            if (!addMore.continue) break;
          }
        }
      }

      console.log(chalk.bold('\n📡 Publishing MCP...'));
      const spinner = ora('Validating and publishing...').start();

      const result = await mcpPublisher.publishMCP(packageData);

      spinner.stop();

      console.log(chalk.green('\n✅ MCP published successfully!'));
      console.log(`Name: ${result.mcp.name}`);
      console.log(`Slug: ${result.mcp.slug}`);
      console.log(`Status: Pending verification`);
      console.log();
      console.log(chalk.gray('Your MCP will be reviewed for verification.'));
      console.log(chalk.gray(`Use ${chalk.bold(`e14z run ${result.mcp.slug}`)} to test execution.`));

    } catch (error) {
      console.error(chalk.red('Publishing failed:'), error.message);
      process.exit(1);
    }
  });

publishCommand
  .command('update <slug>')
  .description('Update an existing MCP')
  .option('-f, --file <file>', 'Use package file for updates')
  .action(async (slug, options) => {
    try {
      const isAuth = await authManager.isAuthenticated();
      if (!isAuth) {
        console.log(chalk.yellow('Authentication required.'));
        process.exit(1);
      }

      let updateData;

      if (options.file) {
        const fileContent = await fs.readFile(options.file, 'utf8');
        updateData = JSON.parse(fileContent);
      } else {
        // Interactive update
        console.log(chalk.bold(`📝 Updating MCP: ${slug}\n`));

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'New description (leave empty to skip):'
          },
          {
            type: 'input',
            name: 'endpoint',
            message: 'New endpoint (leave empty to skip):'
          },
          {
            type: 'input',
            name: 'documentation_url',
            message: 'Documentation URL (leave empty to skip):'
          }
        ]);

        // Filter out empty values
        updateData = Object.fromEntries(
          Object.entries(answers).filter(([_, value]) => value !== '')
        );

        if (Object.keys(updateData).length === 0) {
          console.log(chalk.yellow('No changes specified.'));
          return;
        }
      }

      const spinner = ora('Updating MCP...').start();
      const result = await mcpPublisher.updateMCP(slug, updateData);
      spinner.stop();

      console.log(chalk.green('\n✅ MCP updated successfully!'));
      console.log(`Updated: ${Object.keys(updateData).join(', ')}`);

    } catch (error) {
      console.error(chalk.red('Update failed:'), error.message);
      process.exit(1);
    }
  });

publishCommand
  .command('list')
  .alias('my')
  .description('List your published MCPs')
  .action(async () => {
    try {
      const isAuth = await authManager.isAuthenticated();
      if (!isAuth) {
        console.log(chalk.yellow('Authentication required.'));
        console.log(`Run ${chalk.bold('e14z auth login')} to see your MCPs.`);
        process.exit(1);
      }

      const spinner = ora('Loading your MCPs...').start();
      const mcps = await mcpPublisher.getMyMCPs();
      spinner.stop();

      if (mcps.length === 0) {
        console.log(chalk.yellow('You haven\'t published any MCPs yet.'));
        console.log(`Use ${chalk.bold('e14z publish new')} to publish your first MCP.`);
        return;
      }

      console.log(chalk.bold(`\n📦 Your Published MCPs (${mcps.length}):\n`));

      mcps.forEach((mcp, index) => {
        const status = mcp.verified ? chalk.green('✓ Verified') : chalk.yellow('○ Pending');
        const executable = mcp.clean_command ? chalk.green('✓ Executable') : chalk.gray('○ Setup only');
        const reviews = mcp.reviews?.total || 0;
        const rating = mcp.reviews?.average_rating ? 
          chalk.cyan(`⭐ ${mcp.reviews.average_rating.toFixed(1)}`) : 
          chalk.gray('No ratings');

        console.log(`${index + 1}. ${chalk.cyan(mcp.name)} ${chalk.gray(`(${mcp.slug})`)}`);
        console.log(`   ${mcp.description}`);
        console.log(`   ${status} | ${executable} | ${rating} | ${reviews} reviews`);
        console.log(`   Category: ${mcp.category} | Created: ${new Date(mcp.created_at).toLocaleDateString()}`);
        
        if (mcp.clean_command) {
          console.log(`   ${chalk.green('▶')} Run: ${chalk.bold(`e14z run ${mcp.slug}`)}`);
        }
        console.log();
      });

      console.log(chalk.gray(`💡 Use ${chalk.bold('e14z publish update <slug>')} to update your MCPs`));

    } catch (error) {
      console.error(chalk.red('Failed to list MCPs:'), error.message);
      process.exit(1);
    }
  });

publishCommand
  .command('template <name>')
  .description('Generate a package template file')
  .option('-o, --output <file>', 'Output file name', 'e14z-package.json')
  .action(async (name, options) => {
    try {
      const template = mcpPublisher.generateTemplate(name);
      
      await fs.writeFile(options.output, JSON.stringify(template, null, 2));
      
      console.log(chalk.green(`✅ Template created: ${options.output}`));
      console.log(`Edit the file and publish with: ${chalk.bold(`e14z publish new -f ${options.output}`)}`);
      
    } catch (error) {
      console.error(chalk.red('Failed to create template:'), error.message);
      process.exit(1);
    }
  });

/**
 * Claiming Commands
 */
const claimCommand = program
  .command('claim')
  .description('Claim ownership of wrapped MCPs');

claimCommand
  .command('list')
  .description('List MCPs available for claiming')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --limit <number>', 'Maximum number of results', '20')
  .action(async (options) => {
    try {
      const spinner = ora('Loading claimable MCPs...').start();
      const mcps = await claimingManager.getClaimableMCPs();
      spinner.stop();

      let filteredMCPs = mcps;
      
      if (options.category) {
        filteredMCPs = mcps.filter(mcp => mcp.category === options.category);
      }
      
      if (options.limit) {
        filteredMCPs = filteredMCPs.slice(0, parseInt(options.limit));
      }

      if (filteredMCPs.length === 0) {
        console.log(chalk.yellow('No claimable MCPs found.'));
        if (options.category) {
          console.log(`Try removing the category filter or use ${chalk.bold('e14z claim list')} to see all.`);
        }
        return;
      }

      console.log(chalk.bold(`\n🏷️  Claimable MCPs (${filteredMCPs.length}):\n`));

      filteredMCPs.forEach((mcp, index) => {
        const authStatus = mcp.auth_method === 'none' ? 
          chalk.green('No auth') : 
          chalk.yellow(`Auth: ${mcp.auth_method || 'unknown'}`);
        
        const claimStatus = mcp.claims?.pending > 0 ? 
          chalk.yellow(`${mcp.claims.pending} pending`) : 
          chalk.green('Available');

        console.log(`${chalk.bold(index + 1)}. ${chalk.cyan(mcp.name)} ${chalk.gray(`(${mcp.slug})`)}`);
        console.log(`   ${mcp.description}`);
        console.log(`   Category: ${mcp.category} | ${authStatus} | Claims: ${claimStatus}`);
        
        if (mcp.github_url) {
          console.log(`   📦 GitHub: ${mcp.github_url}`);
        }
        
        console.log(`   ${chalk.green('▶')} Claim: ${chalk.bold(`e14z claim mcp ${mcp.slug}`)}`);
        console.log();
      });

      console.log(chalk.gray(`💡 Use ${chalk.bold('e14z claim mcp <slug>')} to claim ownership`));
      console.log(chalk.gray('💡 You can only claim MCPs you actually own or maintain'));

    } catch (error) {
      console.error(chalk.red('Failed to list claimable MCPs:'), error.message);
      process.exit(1);
    }
  });

claimCommand
  .command('mcp <slug>')
  .description('Claim ownership of a specific MCP')
  .action(async (slug) => {
    try {
      const isAuth = await authManager.isAuthenticated();
      if (!isAuth) {
        console.log(chalk.yellow('Authentication required for claiming.'));
        console.log(`Run ${chalk.bold('e14z auth login')} first.`);
        process.exit(1);
      }

      console.log(chalk.bold(`\n🏷️  Starting claim process for: ${slug}\n`));

      // Check if claimable
      const spinner = ora('Checking claimability...').start();
      const claimStatus = await claimingManager.isClaimable(slug);
      spinner.stop();

      if (!claimStatus.claimable) {
        console.log(chalk.red(`❌ Cannot claim MCP "${slug}"`));
        console.log(`Reason: ${claimStatus.reason}`);
        
        if (claimStatus.mcp?.claimed_by) {
          console.log(chalk.gray('This MCP has already been claimed by another user.'));
        } else if (claimStatus.mcp?.source_type === 'published') {
          console.log(chalk.gray('This MCP was originally published, not wrapped.'));
        }
        
        process.exit(1);
      }

      // Start interactive claiming
      console.log(chalk.green('✅ MCP is available for claiming!'));
      console.log(chalk.gray('You will need to prove ownership through GitHub, npm, or manual review.\n'));

      const result = await claimingManager.interactiveClaim(slug);

      console.log(chalk.green('\n✅ Claim submitted successfully!'));
      
      if (result.status === 'approved') {
        console.log(chalk.bold('🎉 Your claim was automatically approved!'));
        console.log(`You now own MCP "${claimStatus.mcp.name}".`);
        console.log(`Use ${chalk.bold('e14z publish update ' + slug)} to make changes.`);
      } else {
        console.log('📝 Your claim is pending review.');
        console.log('You will be notified when it is processed.');
        console.log(chalk.gray('Most GitHub and npm verifications are processed within 24 hours.'));
      }

    } catch (error) {
      console.error(chalk.red('Claim failed:'), error.message);
      process.exit(1);
    }
  });

claimCommand
  .command('status')
  .description('Check status of your submitted claims')
  .action(async () => {
    try {
      const isAuth = await authManager.isAuthenticated();
      if (!isAuth) {
        console.log(chalk.yellow('Authentication required.'));
        process.exit(1);
      }

      console.log(chalk.bold('\n📋 Your Claim Status\n'));
      console.log(chalk.gray('This feature will be available in the next update.'));
      console.log(chalk.gray('For now, you will be notified via email when claims are processed.'));

    } catch (error) {
      console.error(chalk.red('Failed to check claim status:'), error.message);
      process.exit(1);
    }
  });

/**
 * Diagnostic Commands
 */
program
  .command('diagnose')
  .description('Run system diagnostics and connectivity tests')
  .action(async () => {
    console.log(chalk.bold('🔍 E14Z System Diagnostics\n'));
    
    // System info
    console.log(chalk.bold('System Information:'));
    console.log(`  Platform: ${process.platform}`);
    console.log(`  Architecture: ${process.arch}`);
    console.log(`  Node.js: ${process.version}`);
    console.log(`  E14Z: ${packageJson.version}\n`);
    
    // Authentication
    console.log(chalk.bold('Authentication:'));
    const isAuth = await authManager.isAuthenticated();
    if (isAuth) {
      const user = await authManager.getCurrentUser();
      console.log(chalk.green(`  ✓ Authenticated as ${user.login}`));
    } else {
      console.log(chalk.yellow('  ○ Not authenticated'));
    }
    console.log();
    
    // API connectivity
    console.log(chalk.bold('API Connectivity:'));
    const spinner = ora('Testing API connection...').start();
    
    try {
      const fetch = (await import('node-fetch')).default;
      const baseUrl = process.env.E14Z_API_URL || 'https://www.e14z.com';
      
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/health`, { timeout: 10000 });
      const endTime = Date.now();
      
      spinner.stop();
      
      if (response.ok) {
        console.log(chalk.green(`  ✓ API reachable (${endTime - startTime}ms)`));
      } else {
        console.log(chalk.yellow(`  ⚠ API returned ${response.status}`));
      }
    } catch (error) {
      spinner.stop();
      console.log(chalk.red(`  ✗ API unreachable: ${error.message}`));
    }
    
    console.log();
    console.log(chalk.gray('For more help, visit: https://e14z.com/docs'));
  });

/**
 * Version and Help
 */
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(`e14z ${packageJson.version}`);
    console.log(`Node.js ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
  });

// Main execution wrapper
async function main() {
  // Initialize bootstrap check early
  await bootstrapGlobalInstallation().catch(() => {
    // Ignore bootstrap errors, continue with normal execution
  });

  // Check if running as MCP server (stdin mode - piped input and no arguments)
  if ((process.stdin.isTTY === false || process.stdin.isTTY === undefined) && process.argv.length <= 2) {
    // Running as MCP server - delegate to MCP server implementation
    const { MCPServer } = require('./e14z.js');
    const server = new MCPServer();
    server.start().catch(error => {
      console.error('Failed to start E14Z MCP Server:', error);
      process.exit(1);
    });
    return;
  }

  // Default help if no command provided
  if (process.argv.length <= 2) {
    console.log(chalk.bold.cyan('🚀 E14Z - Universal MCP Runtime\n'));
    console.log('NPX-like auto-installation and execution of Model Context Protocol (MCP) servers\n');
    
    console.log(chalk.bold('Discovery & Execution:'));
    console.log(`  ${chalk.cyan('e14z discover')}           Discover available MCPs`);
    console.log(`  ${chalk.cyan('e14z info <slug>')}        Get detailed MCP information`);
    console.log(`  ${chalk.cyan('e14z run <slug>')}         Execute MCP with auto-installation`);
    console.log(`  ${chalk.cyan('e14z list')}               List all MCPs with status`);
    console.log();
    
    console.log(chalk.bold('Auto-Installation & Cache:'));
    console.log(`  ${chalk.cyan('e14z cache list')}         Show cached MCPs`);
    console.log(`  ${chalk.cyan('e14z cache clear <slug>')} Clear specific MCP cache`);
    console.log(`  ${chalk.cyan('e14z cache info')}         Show cache information`);
    console.log();
    
    console.log(chalk.bold('Publishing & Management:'));
    console.log(`  ${chalk.cyan('e14z auth login')}         Authenticate with GitHub`);
    console.log(`  ${chalk.cyan('e14z publish new')}        Publish a new MCP`);
    console.log(`  ${chalk.cyan('e14z publish list')}       Your published MCPs`);
    console.log(`  ${chalk.cyan('e14z claim list')}         MCPs available for claiming`);
    console.log();
    
    console.log(chalk.bold('MCP Server Mode:'));
    console.log(`  ${chalk.cyan('e14z')}                    Auto-detects when used via stdin (for AI agents)`);
    console.log();
    
    console.log(chalk.bold('Examples:'));
    console.log(`  ${chalk.gray('e14z discover payments')}     Find payment-related MCPs`);
    console.log(`  ${chalk.gray('e14z run stripe')}           Auto-install and run Stripe MCP`);
    console.log(`  ${chalk.gray('e14z cache list')}           Show installed MCPs`);
    console.log(`  ${chalk.gray('e14z publish new my-mcp')}   Publish your MCP`);
    console.log(`  ${chalk.gray('e14z claim mcp stripe')}     Claim wrapped MCP`);
    console.log();
    
    console.log(chalk.bold('🤖 Auto-Installation Features:'));
    console.log(`  • NPX-like package installation and execution`);
    console.log(`  • Security scanning and threat detection`);
    console.log(`  • Automatic dependency resolution`);
    console.log(`  • Transaction rollback on failures`);
    console.log(`  • Multi-package manager support (npm, pip, git)`);
    console.log();
    
    console.log(chalk.gray(`Use ${chalk.bold('e14z --help')} for all available commands`));
    process.exit(0);
  }

  // Parse command line arguments
  try {
    await program.parseAsync(process.argv);
    
    // After successful command execution, perform global installation if needed
    await performGlobalInstallation();
    
  } catch (error) {
    console.error(chalk.red('CLI Error:'), error.message);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error.message);
  process.exit(1);
});