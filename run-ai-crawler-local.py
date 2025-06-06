#!/usr/bin/env python3

"""
Local launcher for AI-first MCP crawler
Sets up environment variables from .env.local and runs the crawler
"""

import os
import asyncio
import sys
from pathlib import Path

def load_env_file():
    """Load environment variables from .env.local"""
    env_file = Path(__file__).parent / '.env.local'
    
    if not env_file.exists():
        print("❌ .env.local file not found!")
        return False
    
    print("📄 Loading environment from .env.local...")
    
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value
    
    # Verify required variables (using NEXT_PUBLIC_ prefix from .env.local)
    required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    missing = []
    
    for var in required:
        if var not in os.environ or os.environ[var] == 'your_supabase_url_here':
            missing.append(var)
    
    if missing:
        print(f"❌ Missing required environment variables: {missing}")
        return False
    
    # Check for optional OpenAI API key for enhanced analysis
    if 'OPENAI_API_KEY' in os.environ and os.environ['OPENAI_API_KEY']:
        print("🤖 OpenAI API key found - will use o4-mini for enhanced analysis")
    else:
        print("ℹ️ No OpenAI API key - using Claude's built-in analysis")
    
    # Map NEXT_PUBLIC_ variables to standard names for the crawler
    if 'NEXT_PUBLIC_SUPABASE_URL' in os.environ:
        os.environ['SUPABASE_URL'] = os.environ['NEXT_PUBLIC_SUPABASE_URL']
    
    print("✅ Environment loaded successfully")
    return True

async def run_crawler(limit=5):
    """Run the AI crawler with specified limit"""
    print(f"🚀 Starting AI-first MCP crawler (limit: {limit})")
    
    try:
        # Import the crawler (after env is set)
        sys.path.append(str(Path(__file__).parent))
        from ai_mcp_crawler_complete import CompleteAIMCPCrawler
        
        # Initialize and run
        crawler = CompleteAIMCPCrawler()
        stats = await crawler.crawl_mcps(limit=limit)
        
        print("\n" + "="*50)
        print("🎉 Crawl Complete!")
        print("="*50)
        print(f"📦 Discovered: {stats['discovered']}")
        print(f"🔌 Connected: {stats['connected']}")
        print(f"💾 Stored: {stats['stored']}")
        print(f"❌ Failed: {stats['failed']}")
        print("="*50)
        
        return stats
        
    except Exception as e:
        print(f"💥 Crawler failed: {e}")
        return None

def main():
    """Main entry point"""
    print("🤖 AI-First MCP Crawler - Local Runner")
    print("="*50)
    
    # Load environment
    if not load_env_file():
        sys.exit(1)
    
    # Get limit from command line or default to 5
    limit = 5
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            print(f"⚠️ Invalid limit '{sys.argv[1]}', using default: 5")
    
    print(f"🎯 Crawling {limit} MCPs")
    
    # Run the crawler
    asyncio.run(run_crawler(limit))

if __name__ == "__main__":
    main()