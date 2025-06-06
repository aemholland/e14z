#!/usr/bin/env python3

"""
Test script for AI-First MCP Crawler
"""

import os
import sys
import asyncio

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import our crawler
import importlib.util
spec = importlib.util.spec_from_file_location("ai_mcp_crawler", "ai-mcp-crawler.py")
ai_mcp_crawler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai_mcp_crawler)

IntelligentMCPAnalyzer = ai_mcp_crawler.IntelligentMCPAnalyzer

async def test_basic_functionality():
    """Test basic crawler functionality without external API calls"""
    
    print("🧪 Testing AI-First MCP Crawler...")
    
    # Test 1: Initialize crawler
    print("1. Initializing crawler...")
    try:
        crawler = IntelligentMCPAnalyzer(
            llm_provider="openai/gpt-4o",
            api_key="test-key",  # Won't be used in this test
            supabase_url=None,
            supabase_key=None
        )
        print("✅ Crawler initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize crawler: {e}")
        return False
    
    # Test 2: Check browser config
    print("2. Checking browser configuration...")
    try:
        assert crawler.browser_config.headless == True
        print("✅ Browser config correct")
    except Exception as e:
        print(f"❌ Browser config issue: {e}")
        return False
    
    # Test 3: Check LLM config
    print("3. Checking LLM configuration...")
    try:
        assert crawler.llm_config.provider == "openai/gpt-4o"
        print("✅ LLM config correct")
    except Exception as e:
        print(f"❌ LLM config issue: {e}")
        return False
    
    print("🎉 Basic functionality tests passed!")
    return True

async def test_with_real_api():
    """Test with real API if credentials are available"""
    
    print("\n🌐 Testing with real APIs...")
    
    # Check if we have real API keys
    openai_key = os.getenv('OPENAI_API_KEY')
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not openai_key:
        print("⚠️ OPENAI_API_KEY not found, skipping real API tests")
        return True
    
    print("🔑 API credentials found, testing real functionality...")
    
    # Initialize with real credentials
    crawler = IntelligentMCPAnalyzer(
        llm_provider="openai/gpt-4o",
        api_key=openai_key,
        supabase_url=supabase_url,
        supabase_key=supabase_key
    )
    
    # Test a simple package analysis
    print("📦 Analyzing a known MCP package...")
    try:
        # Test with a lightweight package first
        test_package = "@modelcontextprotocol/server-filesystem"
        
        result = await crawler.analyze_mcp_package(test_package)
        
        if result:
            print(f"✅ Successfully analyzed {test_package}")
            print(f"   Description: {result.description[:100]}...")
            print(f"   Intelligence Score: {result.intelligence_score}")
            print(f"   Tools: {len(result.tools)}")
            print(f"   Use Cases: {len(result.use_cases)}")
            return True
        else:
            print(f"❌ Failed to analyze {test_package}")
            return False
            
    except Exception as e:
        print(f"❌ Real API test failed: {e}")
        return False

if __name__ == "__main__":
    async def run_tests():
        print("🚀 AI-First MCP Crawler Test Suite")
        print("=" * 50)
        
        # Run basic tests
        basic_ok = await test_basic_functionality()
        
        if basic_ok:
            # Run real API tests if possible
            api_ok = await test_with_real_api()
            
            if api_ok:
                print("\n🎉 All tests passed! Crawler is ready for use.")
            else:
                print("\n⚠️ Basic tests passed but API tests failed.")
        else:
            print("\n❌ Basic tests failed. Check your setup.")
    
    asyncio.run(run_tests())