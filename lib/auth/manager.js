/**
 * E14Z Authentication Manager - GitHub OAuth and credential storage
 * XDG Base Directory Specification compliant
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { machineId } = require('node-machine-id');

class AuthManager {
  constructor() {
    this.configDir = this.getConfigDir();
    this.credentialsFile = path.join(this.configDir, 'credentials.json');
    this.deviceId = null;
  }

  /**
   * Get XDG-compliant configuration directory
   */
  getConfigDir() {
    const platform = os.platform();
    
    if (platform === 'darwin') {
      // macOS: ~/Library/Application Support/e14z
      return path.join(os.homedir(), 'Library', 'Application Support', 'e14z');
    } else if (platform === 'win32') {
      // Windows: %APPDATA%/e14z
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'e14z');
    } else {
      // Linux/Unix: ~/.config/e14z
      return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'e14z');
    }
  }

  /**
   * Get unique device ID for authentication
   */
  async getDeviceId() {
    if (!this.deviceId) {
      try {
        this.deviceId = await machineId();
      } catch (error) {
        // Fallback to random ID if machine ID fails
        this.deviceId = crypto.randomBytes(16).toString('hex');
      }
    }
    return this.deviceId;
  }

  /**
   * Ensure config directory exists
   */
  async ensureConfigDir() {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      
      // Set restrictive permissions (only user can read/write)
      if (os.platform() !== 'win32') {
        await fs.chmod(this.configDir, 0o700);
      }
    } catch (error) {
      throw new Error(`Failed to create config directory: ${error.message}`);
    }
  }

  /**
   * Encrypt data using device-specific key
   */
  async encrypt(data) {
    const deviceId = await this.getDeviceId();
    const key = crypto.createHash('sha256').update(deviceId).digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher('aes-256-cbc', key);
    cipher.setAutoPadding(true);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  /**
   * Decrypt data using device-specific key
   */
  async decrypt(encryptedData) {
    const deviceId = await this.getDeviceId();
    const key = crypto.createHash('sha256').update(deviceId).digest();
    
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    decipher.setAutoPadding(true);
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Save credentials securely
   */
  async saveCredentials(credentials) {
    await this.ensureConfigDir();
    
    const encrypted = await this.encrypt(credentials);
    
    await fs.writeFile(this.credentialsFile, JSON.stringify(encrypted, null, 2));
    
    // Set restrictive file permissions
    if (os.platform() !== 'win32') {
      await fs.chmod(this.credentialsFile, 0o600);
    }
  }

  /**
   * Load credentials securely
   */
  async loadCredentials() {
    try {
      const encryptedData = await fs.readFile(this.credentialsFile, 'utf8');
      const encrypted = JSON.parse(encryptedData);
      return await this.decrypt(encrypted);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // No credentials file
      }
      throw new Error(`Failed to load credentials: ${error.message}`);
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    const credentials = await this.loadCredentials();
    return !!(credentials && credentials.access_token && credentials.user);
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    const credentials = await this.loadCredentials();
    if (!credentials || !credentials.user) {
      return null;
    }
    return credentials.user;
  }

  /**
   * Start GitHub OAuth device flow
   */
  async startGitHubAuth() {
    const deviceId = await this.getDeviceId();
    
    // Check if GitHub credentials are configured
    const clientId = process.env.E14Z_GITHUB_CLIENT_ID || 'Ov23liB8nfCag6pJOw7K';
    const clientSecret = process.env.E14Z_GITHUB_CLIENT_SECRET || 'dfe5bd56dd3ee268996e683f8d31673db345cfc5';
    
    if (clientSecret === 'NEW_CLIENT_SECRET_HERE') {
      throw new Error('GitHub authentication is not configured. Please contact the E14Z team or set E14Z_GITHUB_CLIENT_SECRET environment variable.');
    }
    
    try {
      const fetch = (await import('node-fetch')).default;
      
      // Start device flow
      const deviceResponse = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          scope: 'read:user user:email'
        })
      });

      if (!deviceResponse.ok) {
        const errorText = await deviceResponse.text();
        throw new Error(`GitHub device flow failed (${deviceResponse.status}): ${errorText}`);
      }

      const deviceData = await deviceResponse.json();
      
      return {
        device_code: deviceData.device_code,
        user_code: deviceData.user_code,
        verification_uri: deviceData.verification_uri,
        verification_uri_complete: deviceData.verification_uri_complete,
        expires_in: deviceData.expires_in,
        interval: deviceData.interval || 5
      };
    } catch (error) {
      throw new Error(`Failed to start GitHub authentication: ${error.message}`);
    }
  }

  /**
   * Poll for GitHub OAuth completion
   */
  async pollGitHubAuth(deviceCode, interval = 5) {
    const maxAttempts = 120; // 10 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const fetch = (await import('node-fetch')).default;
        
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: process.env.E14Z_GITHUB_CLIENT_ID || 'Ov23liB8nfCag6pJOw7K',
            client_secret: process.env.E14Z_GITHUB_CLIENT_SECRET || 'dfe5bd56dd3ee268996e683f8d31673db345cfc5',
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
          })
        });

        // Parse response body once
        let tokenData;
        try {
          const responseText = await tokenResponse.text();
          tokenData = JSON.parse(responseText);
          
          // Log only if there's an unexpected error
          if (!tokenResponse.ok && tokenResponse.status !== 400) {
            console.error(`\nError: GitHub request failed (${tokenResponse.status})`);
          }
        } catch (error) {
          // Network or parsing error, retry
          await new Promise(resolve => setTimeout(resolve, interval * 1000));
          attempts++;
          continue;
        }

        // Optional debug logging (comment out for production)
        // console.log(`Debug: Poll attempt ${attempts + 1}, status:`, tokenData.error || 'success');

        if (tokenData.access_token) {
          // Get user info
          const userResponse = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `token ${tokenData.access_token}`,
              'Accept': 'application/json'
            }
          });

          if (!userResponse.ok) {
            throw new Error('Failed to get user info from GitHub');
          }

          const userData = await userResponse.json();

          const credentials = {
            access_token: tokenData.access_token,
            token_type: tokenData.token_type,
            scope: tokenData.scope,
            user: {
              id: userData.id,
              login: userData.login,
              name: userData.name,
              email: userData.email,
              avatar_url: userData.avatar_url
            },
            authenticated_at: new Date().toISOString()
          };

          await this.saveCredentials(credentials);
          return credentials;
        }

        if (tokenData.error === 'authorization_pending') {
          // Wait and continue polling
          await new Promise(resolve => setTimeout(resolve, interval * 1000));
          attempts++;
          continue;
        }

        if (tokenData.error === 'slow_down') {
          // GitHub wants us to slow down
          interval = Math.min(interval * 2, 30);
          await new Promise(resolve => setTimeout(resolve, interval * 1000));
          attempts++;
          continue;
        }

        if (tokenData.error === 'expired_token' || tokenData.error === 'access_denied') {
          throw new Error(`Authentication ${tokenData.error.replace('_', ' ')}`);
        }

        throw new Error(`Unknown error: ${tokenData.error || 'Unknown'}`);

      } catch (error) {
        if (attempts >= maxAttempts - 1) {
          throw new Error(`Authentication timeout after ${maxAttempts} attempts: ${error.message}`);
        }
        // Network error, retry silently
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
        attempts++;
      }
    }

    throw new Error('Authentication timeout');
  }

  /**
   * Sign out and remove credentials
   */
  async signOut() {
    try {
      await fs.unlink(this.credentialsFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to sign out: ${error.message}`);
      }
    }
  }

  /**
   * Get GitHub API headers for authenticated requests
   */
  async getGitHubHeaders() {
    const credentials = await this.loadCredentials();
    if (!credentials || !credentials.access_token) {
      throw new Error('Not authenticated. Run "e14z auth login" first.');
    }

    return {
      'Authorization': `token ${credentials.access_token}`,
      'Accept': 'application/json',
      'User-Agent': `e14z-cli/2.0.7`
    };
  }

  /**
   * Validate current authentication
   */
  async validateAuth() {
    try {
      const headers = await this.getGitHubHeaders();
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch('https://api.github.com/user', { headers });
      
      if (response.status === 401) {
        // Token expired or invalid
        await this.signOut();
        return false;
      }

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

module.exports = { AuthManager };