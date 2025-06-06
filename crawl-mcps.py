#!/usr/bin/env python3

"""
🚀 AI-First MCP Crawler CLI
Command-line interface for intelligent MCP discovery and analysis

Usage:
    python crawl-mcps.py --query "database tools" --limit 5 --store
    python crawl-mcps.py --analyze "@hubspot/mcp-server"
    python crawl-mcps.py --discover --top-quality
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path

# Add current directory to path
sys.path.append(str(Path(__file__).parent))

# Import our crawler
import importlib.util
spec = importlib.util.spec_from_file_location("ai_mcp_crawler", "ai-mcp-crawler.py")
ai_mcp_crawler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai_mcp_crawler)

IntelligentMCPAnalyzer = ai_mcp_crawler.IntelligentMCPAnalyzer

async def main():
    """Main CLI interface"""
    
    parser = argparse.ArgumentParser(
        description="🚀 AI-First MCP Crawler - Intelligent MCP Discovery & Analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Discover MCP servers
  python crawl-mcps.py --query "database tools" --limit 5
  
  # Analyze specific package
  python crawl-mcps.py --analyze "@hubspot/mcp-server"
  
  # Full discovery with storage
  python crawl-mcps.py --discover --store --limit 10
  
  # Find top quality MCPs
  python crawl-mcps.py --top-quality --limit 20

Environment Variables:
  OPENAI_API_KEY         - OpenAI API key for LLM analysis
  SUPABASE_URL          - Supabase project URL  
  SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
        """
    )
    
    # Main operation modes
    parser.add_argument("--query", "-q", type=str, 
                       help="Search query for MCP discovery")
    parser.add_argument("--analyze", "-a", type=str,
                       help="Analyze specific MCP package by name")
    parser.add_argument("--discover", "-d", action="store_true",
                       help="Run comprehensive MCP discovery")
    parser.add_argument("--top-quality", "-t", action="store_true", 
                       help="Discover top quality MCPs")
    
    # Configuration options
    parser.add_argument("--limit", "-l", type=int, default=10,
                       help="Maximum number of packages to analyze (default: 10)")
    parser.add_argument("--store", "-s", action="store_true",
                       help="Store results to Supabase database")
    parser.add_argument("--llm-provider", type=str, default="openai/gpt-4o",
                       help="LLM provider (default: openai/gpt-4o)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    
    args = parser.parse_args()
    
    # Validate arguments
    if not any([args.query, args.analyze, args.discover, args.top_quality]):
        parser.error("Must specify one of: --query, --analyze, --discover, or --top-quality")
    
    # Check for required environment variables
    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        print("❌ Error: OPENAI_API_KEY environment variable is required")
        print("   Set it with: export OPENAI_API_KEY='your-api-key'")
        sys.exit(1)
    
    # Get Supabase credentials (optional)
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if args.store and (not supabase_url or not supabase_key):
        print("❌ Error: --store requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        print("   Set them with:")
        print("   export SUPABASE_URL='your-supabase-url'")
        print("   export SUPABASE_SERVICE_ROLE_KEY='your-service-key'")
        sys.exit(1)
    
    # Initialize the AI crawler
    print("🚀 Initializing AI-First MCP Crawler...")
    crawler = IntelligentMCPAnalyzer(
        llm_provider=args.llm_provider,
        api_key=openai_key,
        supabase_url=supabase_url,
        supabase_key=supabase_key
    )
    
    try:
        # Execute the requested operation
        if args.analyze:
            # Analyze specific package
            print(f"\n🔍 Analyzing package: {args.analyze}")
            result = await crawler.analyze_mcp_package(args.analyze)
            
            if result:
                print(f"\n✅ Analysis complete for {args.analyze}")
                if args.store and crawler.supabase:
                    await crawler.store_to_supabase(result)
            else:
                print(f"❌ Failed to analyze {args.analyze}")
                sys.exit(1)
        
        elif args.query:
            # Search with specific query
            print(f"\n🔍 Searching for: {args.query}")
            results = await crawler.crawl_and_analyze(
                search_query=args.query,
                limit=args.limit,
                store_results=args.store
            )
            print(f"\n📊 Found and analyzed {len(results)} packages")
        
        elif args.discover:
            # General MCP discovery
            print(f"\n🔍 Discovering MCPs...")
            results = await crawler.crawl_and_analyze(
                search_query="mcp server model context protocol",
                limit=args.limit,
                store_results=args.store
            )
            print(f"\n📊 Discovered and analyzed {len(results)} packages")
        
        elif args.top_quality:
            # Find top quality MCPs
            print(f"\n🏆 Finding top quality MCPs...")
            results = await crawler.crawl_and_analyze(
                search_query="mcp model context protocol ai agents claude",
                limit=args.limit,
                store_results=args.store
            )
            
            # Sort by intelligence score
            results.sort(key=lambda x: x.intelligence_score, reverse=True)
            
            print(f"\n🏆 Top {len(results)} quality MCPs found:")
            for i, mcp in enumerate(results[:10], 1):
                print(f"  {i}. {mcp.name} (Intelligence: {mcp.intelligence_score:.2f})")
    
    except KeyboardInterrupt:
        print("\n🛑 Operation cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())