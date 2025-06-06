#!/usr/bin/env python3

"""
Test script for the complete AI-first MCP crawler
Tests the full pipeline: Discovery → Connection → AI Analysis → Storage
"""

import asyncio
import os
from ai_mcp_crawler_complete import CompleteAIMCPCrawler

async def test_single_mcp():
    """Test processing a single known MCP"""
    print("🧪 Testing single MCP processing...")
    
    # Mock package data for a known working MCP
    test_package = {
        "name": "@modelcontextprotocol/server-brave-search",
        "description": "MCP server for Brave Search API",
        "version": "0.1.0",
        "keywords": ["mcp", "brave", "search"]
    }
    
    crawler = CompleteAIMCPCrawler()
    
    try:
        result = await crawler._process_single_mcp(test_package)
        
        if result:
            print(f"✅ Test passed!")
            print(f"   Name: {result.name}")
            print(f"   Connection Working: {result.connection_working}")
            print(f"   Tools Found: {len(result.tools)}")
            print(f"   Auth Required: {result.auth_required}")
            print(f"   Intelligence Score: {result.intelligence_score:.2f}")
            print(f"   Reliability Score: {result.reliability_score:.2f}")
            print(f"   Tags: {result.tags}")
        else:
            print("❌ Test failed - no result returned")
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")

async def test_discovery_only():
    """Test just the discovery phase"""
    print("🔍 Testing MCP discovery...")
    
    crawler = CompleteAIMCPCrawler()
    
    try:
        packages = await crawler.npm_discovery.discover_mcps(limit=5)
        
        print(f"✅ Discovery test passed!")
        print(f"   Found {len(packages)} packages")
        for pkg in packages[:3]:
            print(f"   - {pkg.get('name', 'unknown')}: {pkg.get('description', 'no description')[:60]}...")
            
    except Exception as e:
        print(f"❌ Discovery test failed: {e}")

async def test_full_mini_crawl():
    """Test a mini crawl with just 3 MCPs"""
    print("🚀 Testing mini crawl (3 MCPs)...")
    
    crawler = CompleteAIMCPCrawler()
    
    try:
        stats = await crawler.crawl_mcps(limit=3)
        
        print(f"✅ Mini crawl test complete!")
        print(f"   Stats: {stats}")
        
    except Exception as e:
        print(f"❌ Mini crawl test failed: {e}")

async def main():
    """Run all tests"""
    print("🧪 Testing Complete AI-First MCP Crawler")
    print("=" * 50)
    
    # Check environment
    required_env = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
    missing = [var for var in required_env if not os.getenv(var)]
    
    if missing:
        print(f"❌ Missing environment variables: {missing}")
        print("Please set these before running tests.")
        return
    
    # Run tests
    await test_discovery_only()
    print()
    
    await test_single_mcp()
    print()
    
    await test_full_mini_crawl()
    print()
    
    print("🎉 All tests complete!")

if __name__ == "__main__":
    asyncio.run(main())