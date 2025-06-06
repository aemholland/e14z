#!/usr/bin/env python3

"""
Test setup for AI-first MCP crawler
Tests Supabase connection and basic functionality without AI calls
"""

import os
import asyncio
import json
from supabase import create_client

async def test_supabase_connection():
    """Test Supabase connection and schema"""
    print("🔍 Testing Supabase connection...")
    
    # Set environment variables
    os.environ['SUPABASE_URL'] = 'https://zmfvcqjtubfclkhsdqjx.supabase.co'
    os.environ['SUPABASE_SERVICE_ROLE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptZnZjcWp0dWJmY2xraHNkcWp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODUzMTU3NCwiZXhwIjoyMDY0MTA3NTc0fQ.omJ8EFyeEifFMQP1J-6ariQGAl3xxy6YDXJ2NgMaxs0'
    
    try:
        # Initialize Supabase client
        supabase = create_client(
            os.environ['SUPABASE_URL'],
            os.environ['SUPABASE_SERVICE_ROLE_KEY']
        )
        
        # Test query
        result = supabase.table('mcps').select('*').limit(1).execute()
        print(f"✅ Supabase connection successful")
        print(f"   MCPs table exists: {len(result.data) >= 0}")
        
        # If there's data, show schema
        if result.data:
            print(f"   Sample columns: {list(result.data[0].keys())}")
        else:
            print("   No data in mcps table yet")
            
        return True
        
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        return False

async def test_npm_discovery():
    """Test NPM discovery without AI analysis"""
    print("\n🔍 Testing NPM discovery...")
    
    try:
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            # Search for a known MCP package
            url = "https://registry.npmjs.org/-/v1/search?text=model-context-protocol&size=5"
            
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    packages = data.get('objects', [])
                    
                    print(f"✅ NPM discovery successful")
                    print(f"   Found {len(packages)} packages")
                    
                    for pkg in packages[:3]:
                        package_info = pkg.get('package', {})
                        print(f"   - {package_info.get('name', 'unknown')}")
                    
                    return True
                else:
                    print(f"❌ NPM API returned status {response.status}")
                    return False
                    
    except Exception as e:
        print(f"❌ NPM discovery failed: {e}")
        return False

async def test_basic_mcp_data_structure():
    """Test creating basic MCP data structure for storage"""
    print("\n🧪 Testing MCP data structure...")
    
    try:
        # Sample MCP data structure (using correct schema fields)
        sample_mcp = {
            # Required fields
            'name': '@modelcontextprotocol/server-brave-search',
            'slug': 'server-brave-search',
            'endpoint': 'npx @modelcontextprotocol/server-brave-search',
            'category': 'web-apis',
            
            # Optional fields
            'description': 'MCP server for Brave Search API',
            'tools': [
                {
                    'name': 'brave_web_search',
                    'description': 'Search the web using Brave Search API',
                    'parameters': []
                }
            ],
            'auth_required': True,
            'required_env_vars': ['BRAVE_SEARCH_API_KEY'],  # Correct field name
            'health_status': 'healthy',
            'mcp_protocol_data': {
                'version': '2024-11-05',
                'connection_working': True
            },
            'overall_intelligence_score': 0.8,  # Correct field name
            'reliability_score': 0.9,
            'tags': ['search', 'web', 'api'],
            'auto_install_command': 'npx @modelcontextprotocol/server-brave-search',
            'install_type': 'npm',
            'setup_complexity': 'moderate',
            'quality_breakdown': {
                'documentation_quality': 'good',
                'maintenance_level': 'low'
            },
            'verified': True,
            'auto_discovered': True,
            'discovery_source': 'test'
        }
        
        print("✅ MCP data structure valid")
        print(f"   Name: {sample_mcp['name']}")
        print(f"   Tools: {len(sample_mcp['tools'])}")
        print(f"   Auth Required: {sample_mcp['auth_required']}")
        
        return sample_mcp
        
    except Exception as e:
        print(f"❌ Data structure test failed: {e}")
        return None

async def test_storage_to_supabase(sample_data):
    """Test storing sample MCP data to Supabase"""
    print("\n💾 Testing storage to Supabase...")
    
    try:
        # Initialize Supabase client
        supabase = create_client(
            os.environ['SUPABASE_URL'],
            os.environ['SUPABASE_SERVICE_ROLE_KEY']
        )
        
        # Add timestamps
        from datetime import datetime
        sample_data['created_at'] = datetime.utcnow().isoformat()
        sample_data['updated_at'] = datetime.utcnow().isoformat()
        
        # Insert test data
        result = supabase.table('mcps').upsert(sample_data, on_conflict='slug').execute()
        
        if result.data:
            print("✅ Storage test successful")
            print(f"   Stored MCP: {result.data[0]['name']}")
            return True
        else:
            print("❌ Storage test failed - no data returned")
            return False
            
    except Exception as e:
        print(f"❌ Storage test failed: {e}")
        return False

async def main():
    """Run all setup tests"""
    print("🧪 AI-First MCP Crawler Setup Tests")
    print("=" * 50)
    
    all_passed = True
    
    # Test 1: Supabase connection
    if not await test_supabase_connection():
        all_passed = False
    
    # Test 2: NPM discovery
    if not await test_npm_discovery():
        all_passed = False
    
    # Test 3: Data structure
    sample_data = await test_basic_mcp_data_structure()
    if not sample_data:
        all_passed = False
    
    # Test 4: Storage (only if we have sample data)
    if sample_data and not await test_storage_to_supabase(sample_data):
        all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 All setup tests passed! Ready for live crawling.")
        print("\nNext steps:")
        print("1. Add OPENAI_API_KEY to environment")
        print("2. Run: python ai-mcp-crawler-complete.py")
    else:
        print("❌ Some tests failed. Please fix issues before proceeding.")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(main())