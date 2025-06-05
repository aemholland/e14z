#!/usr/bin/env node

/**
 * Demo script showing how to use the MCP Crawler programmatically
 */

const { MCPCrawler } = require('../lib/crawler/mcp-crawler');

async function demoCrawler() {
  console.log('🤖 E14Z MCP Crawler Demo');
  console.log('=========================\n');

  try {
    // Initialize crawler with options
    const crawler = new MCPCrawler({
      dryRun: true, // Don't actually save to database in demo
      validateMCPs: true, // Test MCP functionality
      maxConcurrent: 3, // Limit concurrent operations
      
      // NPM discovery options
      npm: {
        maxResults: 20 // Limit for demo
      },
      
      // Validation options
      validation: {
        validateInstallation: false, // Skip installation for demo speed
        validateConnection: false,   // Skip connection for demo speed
        validateTools: true         // Still extract tools
      }
    });

    console.log('📡 PHASE 1: Discovery');
    console.log('Searching NPM registry for MCP packages...\n');

    // Test discovery only
    const npmDiscovery = crawler.npmDiscovery;
    const packages = await npmDiscovery.discoverMCPs();
    
    console.log(`\n✅ Discovery complete: ${packages.length} packages found`);
    
    if (packages.length > 0) {
      console.log('\n📦 Sample discovered packages:');
      packages.slice(0, 5).forEach((pkg, i) => {
        console.log(`   ${i + 1}. ${pkg.name}`);
        console.log(`      Description: ${pkg.description?.substring(0, 60)}...`);
        console.log(`      Discovery: ${pkg.discoveryMethod}`);
        console.log('');
      });
    }

    console.log('\n🔍 PHASE 2: Scraping');
    console.log('Extracting detailed MCP information...\n');

    // Test scraping on first package
    if (packages.length > 0) {
      const firstPackage = packages[0];
      console.log(`Testing scraper on: ${firstPackage.name}`);
      
      const scraper = crawler.npmScraper;
      const scrapedMCP = await scraper.scrapeMCPPackage(firstPackage);
      
      console.log('\n📊 Scraped MCP data:');
      console.log(`   Name: ${scrapedMCP.name}`);
      console.log(`   Slug: ${scrapedMCP.slug}`);
      console.log(`   Category: ${scrapedMCP.category}`);
      console.log(`   Auth Method: ${scrapedMCP.auth_method}`);
      console.log(`   Install Command: ${scrapedMCP.auto_install_command}`);
      console.log(`   Tools Found: ${scrapedMCP.tools?.length || 0}`);
      console.log(`   Quality Score: ${scrapedMCP.quality_score}/100`);
      
      if (scrapedMCP.tools && scrapedMCP.tools.length > 0) {
        console.log('\n🛠️ Tools:');
        scrapedMCP.tools.slice(0, 3).forEach(tool => {
          console.log(`   - ${tool.name}: ${tool.description}`);
        });
      }
      
      console.log('\n🏷️ Tags:', scrapedMCP.tags?.join(', ') || 'None');
      console.log('💡 Use Cases:', scrapedMCP.use_cases?.slice(0, 2).join(', ') || 'None');
    }

    console.log('\n\n🎯 PHASE 3: Full Crawler Demo');
    console.log('Running limited crawler with validation...\n');

    // Run actual crawler with very limited scope for demo
    const limitedCrawler = new MCPCrawler({
      dryRun: true,
      validateMCPs: false, // Skip for speed in demo
      maxConcurrent: 2,
      npm: { maxResults: 5 } // Very limited for demo
    });

    const stats = await limitedCrawler.crawl(['npm']);
    
    console.log('\n📈 Crawler Statistics:');
    console.log(`   Discovered: ${stats.discovered}`);
    console.log(`   Scraped: ${stats.scraped}`);
    console.log(`   Validated: ${stats.validated}`);
    console.log(`   Would Store: ${stats.scraped} (dry run)`);
    console.log(`   Errors: ${stats.failed}`);

    console.log('\n\n🚀 How to run the full crawler:');
    console.log('');
    console.log('# Discover and add new MCPs to database');
    console.log('npm run crawler:npm');
    console.log('');
    console.log('# Test a specific package');
    console.log('npm run crawler:test @modelcontextprotocol/server-filesystem');
    console.log('');
    console.log('# Dry run to see what would be found');
    console.log('npm run crawler:dry-run');
    console.log('');
    console.log('# Update existing MCPs');
    console.log('npm run crawler:update');
    console.log('');
    console.log('# Full command-line interface');
    console.log('node bin/crawler.js --help');

    console.log('\n✅ Demo completed successfully!');

  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    if (process.env.DEBUG) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️ Demo interrupted by user');
  process.exit(0);
});

// Run the demo
demoCrawler();