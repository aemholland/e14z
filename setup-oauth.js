#!/usr/bin/env node

/**
 * E14Z OAuth Setup Script
 * Run this after creating the GitHub OAuth app to configure the Client ID
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupOAuth() {
  console.log('🔧 E14Z GitHub OAuth Setup\n');
  
  console.log('First, create a GitHub OAuth app:');
  console.log('1. Go to: https://github.com/settings/developers');
  console.log('2. Click "OAuth Apps" → "New OAuth App"');
  console.log('3. Use these settings:');
  console.log('   Application name: E14Z CLI');
  console.log('   Homepage URL: https://e14z.com');
  console.log('   Description: The npm for AI agents - Discover, run, and publish MCP servers');
  console.log('   Authorization callback URL: https://e14z.com/auth/callback');
  console.log('   ✅ Enable Device Flow: YES\n');
  
  const clientId = await question('Enter your GitHub OAuth Client ID: ');
  
  if (!clientId || !clientId.startsWith('Ov23li')) {
    console.log('❌ Invalid Client ID format. Should start with "Ov23li"');
    process.exit(1);
  }
  
  // Update the auth manager file
  const authManagerPath = path.join(__dirname, 'lib', 'auth', 'manager.js');
  
  try {
    let content = await fs.readFile(authManagerPath, 'utf8');
    
    // Replace the placeholder
    content = content.replace(
      'REPLACE_WITH_ACTUAL_CLIENT_ID',
      clientId
    );
    
    await fs.writeFile(authManagerPath, content);
    
    console.log('✅ OAuth Client ID configured successfully!');
    console.log('\nTest authentication with:');
    console.log('  e14z auth login\n');
    
  } catch (error) {
    console.error('❌ Failed to update auth manager:', error.message);
    process.exit(1);
  }
  
  rl.close();
}

setupOAuth().catch(error => {
  console.error('Setup failed:', error.message);
  process.exit(1);
});