/**
 * Multi-Step Command Executor for Complex Installation Commands
 * Handles commands like: git clone X && cd Y && pip install -e .
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class MultiStepExecutor {
  constructor(options = {}) {
    this.timeout = options.timeout || 60000;
    this.workingDir = options.workingDir;
    this.env = { ...process.env, ...options.env };
  }

  /**
   * Parse complex shell command into discrete steps
   */
  parseCommand(command) {
    // Split on && but preserve quoted strings
    const steps = [];
    const parts = command.split('&&').map(part => part.trim());
    
    // Don't update currentDir during parsing - only during execution
    for (const part of parts) {
      const step = this.parseStep(part, this.workingDir);
      steps.push(step);
    }
    
    return steps;
  }

  /**
   * Parse individual step
   */
  parseStep(command, currentDir) {
    const cmd = command.trim();
    
    // Git clone
    if (cmd.startsWith('git clone')) {
      const match = cmd.match(/git clone\s+(?:--\S+\s+)*(.+?)(?:\s+(\S+))?$/);
      return {
        type: 'git_clone',
        url: match[1],
        targetDir: match[2], // Only use explicit target dir, let git decide otherwise
        cwd: currentDir,
        command: cmd
      };
    }
    
    // Change directory
    if (cmd.startsWith('cd ')) {
      const targetDir = cmd.substring(3).trim();
      return {
        type: 'cd',
        targetDir: targetDir,
        cwd: currentDir,
        command: cmd
      };
    }
    
    // Python/UV commands
    if (cmd.includes('pip install') || cmd.startsWith('uv ')) {
      return {
        type: 'python',
        command: cmd,
        cwd: currentDir,
        needsVenv: cmd.includes('uv') || cmd.includes('.venv')
      };
    }
    
    // Virtual environment commands
    if (cmd.includes('venv') || cmd.includes('virtualenv')) {
      return {
        type: 'venv_create',
        command: cmd,
        cwd: currentDir
      };
    }
    
    // Source/activate commands
    if (cmd.includes('source') && cmd.includes('activate')) {
      return {
        type: 'venv_activate',
        command: cmd,
        cwd: currentDir,
        venvPath: this.extractVenvPath(cmd)
      };
    }
    
    // NPM commands
    if (cmd.includes('npm ') || cmd.includes('npx ')) {
      return {
        type: 'npm',
        command: cmd,
        cwd: currentDir
      };
    }
    
    // Generic shell command
    return {
      type: 'shell',
      command: cmd,
      cwd: currentDir
    };
  }

  /**
   * Execute all steps sequentially
   */
  async executeSteps(steps) {
    let currentDir = this.workingDir;
    let venvPath = null;
    const results = [];
    
    console.log(`🔄 Executing ${steps.length} installation steps...`);
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`   Step ${i + 1}/${steps.length}: ${step.type} - ${step.command}`);
      
      try {
        // Update step's working directory to current directory before execution
        step.cwd = currentDir || this.workingDir;
        
        const result = await this.executeStep(step, { currentDir, venvPath });
        results.push(result);
        
        console.log(`   ✅ Step ${i + 1} completed: ${step.type}`);
        
        // Update state based on step results
        if (step.type === 'cd') {
          const newDir = path.resolve(currentDir || process.cwd(), step.targetDir);
          console.log(`   📁 Directory changed: ${currentDir} -> ${newDir}`);
          currentDir = newDir;
        } else if (step.type === 'git_clone') {
          // Git clone creates a directory but doesn't change into it
          // Only explicit cd commands should change the current directory
          const targetDir = step.actualTargetDir || step.targetDir || this.extractRepoName(step.url);
          const clonedDir = path.resolve(currentDir || process.cwd(), targetDir);
          console.log(`   📁 Git clone completed, created directory: ${clonedDir} (staying in ${currentDir})`);
          // Don't change currentDir - that should only happen with explicit cd commands
        } else if (step.type === 'venv_create') {
          venvPath = path.resolve(step.cwd, '.venv');
          console.log(`   🐍 Virtual environment created: ${venvPath}`);
        }
        
        if (!result.success) {
          throw new Error(`Step ${i + 1} failed: ${result.error}`);
        }
        
      } catch (error) {
        return {
          success: false,
          error: `Failed at step ${i + 1} (${step.type}): ${error.message}`,
          completedSteps: i,
          results: results
        };
      }
    }
    
    return {
      success: true,
      completedSteps: steps.length,
      results: results,
      finalDir: currentDir,
      venvPath: venvPath
    };
  }

  /**
   * Execute individual step
   */
  async executeStep(step, context) {
    const { currentDir, venvPath } = context;
    
    switch (step.type) {
      case 'git_clone':
        return await this.executeGitClone(step);
      
      case 'cd':
        return await this.executeChangeDir(step, currentDir);
      
      case 'python':
      case 'npm':
      case 'shell':
        return await this.executeShellCommand(step, venvPath);
      
      case 'venv_create':
        return await this.executeVenvCreate(step);
      
      case 'venv_activate':
        return { success: true, message: 'Virtual env activation noted' };
      
      default:
        return await this.executeShellCommand(step, venvPath);
    }
  }

  /**
   * Execute git clone with branch discovery
   */
  async executeGitClone(step) {
    const { url, targetDir } = step;
    
    console.log(`📥 Cloning Git repository: ${url}`);
    
    // Try to discover available branches
    const branch = await this.discoverGitBranch(url);
    
    let cloneCommand = `git clone --depth 1`;
    if (branch) {
      console.log(`   Using branch: ${branch}`);
      cloneCommand += ` --branch ${branch}`;
    } else {
      console.log(`   Using default branch`);
    }
    cloneCommand += ` ${url}`;
    if (targetDir) {
      cloneCommand += ` ${targetDir}`;
    }
    
    const result = await this.runCommand(cloneCommand, { cwd: step.cwd });
    
    // If successful and no explicit target dir, determine what directory was created
    if (result.success && !targetDir) {
      // Update the step with the actual directory name for tracking
      step.actualTargetDir = this.extractRepoName(url);
    }
    
    return result;
  }

  /**
   * Discover git branch
   */
  async discoverGitBranch(repoUrl) {
    const branches = ['main', 'master', 'develop', 'dev'];
    
    try {
      // Try ls-remote to get default branch
      const result = await this.runCommand(`git ls-remote --symref ${repoUrl} HEAD`, { timeout: 10000 });
      if (result.success) {
        const match = result.stdout.match(/ref: refs\/heads\/(\S+)/);
        if (match) return match[1];
      }
    } catch (error) {
      // Fallback to trying common branch names
    }
    
    // Try common branches
    for (const branch of branches) {
      try {
        const result = await this.runCommand(`git ls-remote --exit-code --heads ${repoUrl} ${branch}`, { timeout: 5000 });
        if (result.success) return branch;
      } catch (error) {
        continue;
      }
    }
    
    return null; // Let git decide
  }

  /**
   * Execute change directory
   */
  async executeChangeDir(step, currentDir) {
    const targetPath = path.resolve(currentDir || process.cwd(), step.targetDir);
    
    try {
      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        return { success: false, error: `${targetPath} is not a directory` };
      }
      
      return { success: true, message: `Changed to ${targetPath}` };
    } catch (error) {
      return { success: false, error: `Directory ${targetPath} does not exist` };
    }
  }

  /**
   * Execute shell command with virtual environment support
   */
  async executeShellCommand(step, venvPath) {
    let command = step.command;
    let env = { ...this.env };
    
    // Handle virtual environment
    if (step.needsVenv && venvPath) {
      const binPath = path.join(venvPath, 'bin');
      env.PATH = `${binPath}:${env.PATH}`;
      env.VIRTUAL_ENV = venvPath;
    }
    
    return await this.runCommand(command, { 
      cwd: step.cwd,
      env: env
    });
  }

  /**
   * Execute virtual environment creation
   */
  async executeVenvCreate(step) {
    return await this.runCommand(step.command, { cwd: step.cwd });
  }

  /**
   * Run command with spawn
   */
  async runCommand(command, options = {}) {
    return new Promise((resolve) => {
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);
      
      const child = spawn(cmd, args, {
        stdio: 'pipe',
        cwd: options.cwd,
        env: options.env || this.env,
        shell: false
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          success: false,
          error: 'Command timed out',
          stdout,
          stderr
        });
      }, options.timeout || this.timeout);
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          success: code === 0,
          code,
          stdout,
          stderr,
          error: code !== 0 ? stderr || `Command failed with code ${code}` : null
        });
      });
      
      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message,
          stdout,
          stderr
        });
      });
    });
  }

  /**
   * Extract repository name from URL
   */
  extractRepoName(url) {
    const match = url.match(/\/([^\/]+?)(?:\.git)?$/);
    return match ? match[1] : 'repo';
  }

  /**
   * Extract virtual environment path from source command
   */
  extractVenvPath(command) {
    const match = command.match(/source\s+(.+?)\/bin\/activate/);
    return match ? match[1] : '.venv';
  }
}

module.exports = { MultiStepExecutor };