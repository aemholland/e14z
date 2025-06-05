#!/usr/bin/env node

/**
 * E14Z MCP Crawler CLI
 * Command-line interface for discovering and cataloging MCP servers
 */

const { MCPCrawler } = require('../lib/crawler/mcp-crawler');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
const sources = [];
let command = 'crawl';

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  switch (arg) {
    case '--help':
    case '-h':
      showHelp();
      process.exit(0);
      break;
      
    case '--dry-run':
      options.dryRun = true;
      break;
      
    case '--no-validation':
      options.validateMCPs = false;
      break;
      
    case '--force':
      options.forceRevalidation = true;
      break;
      
    case '--limit':
      options.limit = parseInt(args[++i]);
      break;
      
    case '--concurrent':
      options.maxConcurrent = parseInt(args[++i]);
      break;
      
    case '--source':
      sources.push(args[++i]);
      break;
      
    case 'discover':
    case 'crawl':
    case 'update':
    case 'test':
      command = arg;
      break;
      
    default:
      if (!arg.startsWith('-')) {
        // Treat as package name for test command
        options.packageName = arg;
      } else {
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
      }
  }
}

// Default sources
if (sources.length === 0) {
  sources.push('npm');
}

// Main execution
async function main() {
  console.log('🤖 E14Z MCP Crawler');
  console.log('===================\n');

  try {
    const crawler = new MCPCrawler(options);

    switch (command) {
      case 'discover':
      case 'crawl':
        await crawler.crawl(sources);
        break;
        
      case 'update':
        await crawler.updateExistingMCPs(options.limit || 50);
        break;
        
      case 'test':
        if (!options.packageName) {
          console.error('❌ Package name required for test command');
          console.error('Usage: crawler test <package-name>');
          process.exit(1);
        }
        await crawler.crawlPackage(options.packageName, sources[0]);
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }

    console.log('\n✅ Crawler completed successfully');
    
  } catch (error) {
    console.error('\n❌ Crawler failed:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🤖 E14Z MCP Crawler

USAGE:
  crawler [COMMAND] [OPTIONS]

COMMANDS:
  crawl                 Discover and crawl new MCP servers (default)
  discover              Alias for crawl
  update                Update existing MCPs with fresh data
  test <package-name>   Test crawling a specific package

OPTIONS:
  --source <source>     Specify package source (npm, pipx, cargo, go)
                        Can be used multiple times. Default: npm
  --dry-run             Don't save to database, just show what would be done
  --no-validation       Skip MCP validation (faster but less reliable)
  --force               Force re-validation of existing MCPs
  --limit <number>      Limit number of packages to process
  --concurrent <number> Max concurrent operations (default: 5)
  --help, -h            Show this help message

EXAMPLES:
  # Discover and crawl NPM packages
  crawler crawl --source npm

  # Dry run to see what would be found
  crawler crawl --dry-run

  # Test a specific package
  crawler test @modelcontextprotocol/server-filesystem

  # Update existing MCPs
  crawler update --limit 100

  # Crawl from multiple sources
  crawler crawl --source npm --source pipx

  # Fast discovery without validation
  crawler crawl --no-validation --concurrent 10

ENVIRONMENT VARIABLES:
  GITHUB_TOKEN         GitHub token for higher API rate limits
  DEBUG                Show detailed error messages

SOURCES:
  npm                  NPM registry (JavaScript/TypeScript)
  pipx                 PyPI registry (Python packages)
  cargo                Crates.io (Rust packages)  
  go                   Go package registries

For more information, visit: https://github.com/e14z/e14z
`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️ Crawler interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️ Crawler terminated');
  process.exit(0);
});

// Run the CLI
main();