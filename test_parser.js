#!/usr/bin/env node

const { PackageManagerFactory } = require('./lib/execution/package-managers.js');

// Test the parser with real database commands
const testCommands = [
  'npx -y @circleci/mcp-server-circleci',
  'npx -y @notionhq/notion-mcp-server',
  'npx -y github:yuniko-software/minecraft-mcp-server --host localhost --port 25565 --username ClaudeBot'
];

const factory = new PackageManagerFactory();

console.log('🧪 Testing NPM Command Parser\n');

for (const command of testCommands) {
  console.log(`📋 Testing: ${command}`);
  
  try {
    const mockInstallMethod = { type: 'npm', command };
    const mockMCP = { name: 'test', slug: 'test' };
    
    const manager = factory.getManager(mockMCP, mockInstallMethod);
    const parsed = manager.parseInstallCommand(mockInstallMethod);
    
    console.log(`   ✅ Parsed successfully:`);
    console.log(`      Package: ${parsed.name}`);
    console.log(`      Version: ${parsed.version}`);
    console.log(`      Is NPX: ${parsed.isNpxCommand || false}`);
    console.log(`      Original: ${parsed.originalCommand || 'none'}`);
    
  } catch (error) {
    console.log(`   ❌ Parse failed: ${error.message}`);
  }
  
  console.log();
}