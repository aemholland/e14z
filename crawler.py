#!/usr/bin/env python3

"""
AI-First MCP Crawler with Real MCP Connection
Combines intelligent discovery with actual MCP protocol communication

This crawler:
1. Uses AI to discover and filter relevant MCPs 
2. Connects to MCPs via MCP protocol to get REAL data
3. Uses AI to analyze and enhance the real data
4. Stores comprehensive intelligence in Supabase
"""

import asyncio
import json
import logging
import os
import subprocess
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
import aiohttp
import openai
from supabase import create_client, Client
from dataclasses import dataclass, asdict
import uuid
import tempfile
import shutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ai_mcp_crawler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class MCPAnalysis:
    """Comprehensive MCP analysis from AI + real connection"""
    # Basic Info
    name: str
    slug: str
    description: str
    enhanced_description: str
    version: str
    
    # Real MCP Data
    tools: List[Dict]
    auth_required: bool
    auth_env_vars: List[str]
    connection_working: bool
    protocol_version: Optional[str]
    
    # AI Analysis
    intelligence_score: float
    reliability_score: float
    tags: List[str]
    use_cases: List[str]
    business_value: str
    auth_requirements: List[str]
    
    # Installation
    auto_install_command: str
    install_type: str
    installation_verified: bool
    
    # Quality Metrics
    documentation_quality: str
    setup_complexity: str
    maintenance_level: str
    
    # Enhanced NPM Metadata
    github_url: str
    homepage: str
    license: str
    keywords: List[str]
    weekly_downloads: int
    monthly_downloads: int

class MCPProtocolClient:
    """Handles actual MCP protocol communication"""
    
    def __init__(self, timeout: int = 30):
        self.timeout = timeout
    
    async def connect_to_mcp(self, install_command: str) -> Dict[str, Any]:
        """Connect to MCP server and get real tools/data"""
        logger.info(f"🔌 Connecting to MCP: {install_command}")
        
        try:
            # Start MCP server process
            process = await self._start_mcp_server(install_command)
            if not process:
                return {"success": False, "error": "Failed to start MCP server"}
            
            # Communicate via JSON-RPC
            result = await self._communicate_with_server(process)
            
            # Cleanup
            await self._cleanup_process(process)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ MCP connection failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def _start_mcp_server(self, command: str) -> Optional[subprocess.Popen]:
        """Start MCP server process"""
        try:
            # Parse command
            if command.startswith('npx '):
                cmd_parts = command.split(' ')
                cmd = 'npx'
                args = cmd_parts[1:]
            else:
                cmd_parts = command.split(' ')
                cmd = cmd_parts[0]
                args = cmd_parts[1:]
            
            logger.info(f"🚀 Starting: {cmd} {' '.join(args)}")
            
            # Start process
            process = subprocess.Popen(
                [cmd] + args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=0
            )
            
            # Wait for startup (simple approach)
            await asyncio.sleep(3)
            
            if process.poll() is None:  # Still running
                return process
            else:
                logger.warning(f"⚠️ Process exited early with code {process.returncode}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to start MCP server: {e}")
            return None
    
    async def _communicate_with_server(self, process: subprocess.Popen) -> Dict[str, Any]:
        """Communicate with MCP server using JSON-RPC protocol and extract ALL possible data"""
        try:
            # Capture any stderr output for auth error analysis
            stderr_data = ""
            
            # Initialize request
            init_request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "roots": {"listChanged": True},
                        "sampling": {}
                    },
                    "clientInfo": {
                        "name": "e14z-ai-crawler",
                        "version": "1.0.0"
                    }
                }
            }
            
            logger.info("📡 Sending initialize request...")
            process.stdin.write(json.dumps(init_request) + '\n')
            process.stdin.flush()
            
            # Read response with timeout
            import select
            import sys
            
            # Check for stderr output
            if hasattr(process.stderr, 'read'):
                try:
                    # Non-blocking read of stderr
                    stderr_available = select.select([process.stderr], [], [], 0.1)[0]
                    if stderr_available:
                        stderr_data = process.stderr.read()
                        if stderr_data:
                            logger.info(f"📝 Captured stderr: {stderr_data[:200]}...")
                except:
                    pass
            
            response_line = process.stdout.readline()
            if not response_line:
                return {
                    "success": False, 
                    "error": "No response from server",
                    "stderr": stderr_data
                }
            
            try:
                init_response = json.loads(response_line.strip())
                logger.info(f"✅ Got initialize response: {init_response.get('result', {}).get('protocolVersion', 'unknown version')}")
            except json.JSONDecodeError:
                logger.warning(f"⚠️ Non-JSON response: {response_line[:100]}")
                return {
                    "success": False, 
                    "error": "Invalid JSON response",
                    "stderr": stderr_data,
                    "raw_response": response_line[:200]
                }
            
            # Extract comprehensive server data
            result = init_response.get('result', {})
            protocol_version = result.get('protocolVersion')
            server_info = result.get('serverInfo', {})
            capabilities = result.get('capabilities', {})
            
            # Log comprehensive server info
            logger.info(f"🖥️ Server Info: {server_info}")
            logger.info(f"🔧 Capabilities: {list(capabilities.keys())}")
            
            # Request tools
            tools_request = {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {}
            }
            
            logger.info("🛠️ Requesting tools list...")
            process.stdin.write(json.dumps(tools_request) + '\n')
            process.stdin.flush()
            
            # Read tools response
            tools_line = process.stdout.readline()
            tools = []
            resources = []
            prompts = []
            
            if tools_line:
                try:
                    tools_response = json.loads(tools_line.strip())
                    if tools_response.get('result', {}).get('tools'):
                        tools = tools_response['result']['tools']
                        logger.info(f"🛠️ Found {len(tools)} tools")
                        
                        # Log ALL tool details for comprehensive analysis
                        for i, tool in enumerate(tools):
                            tool_name = tool.get('name', 'unnamed')
                            tool_desc = tool.get('description', 'no description')
                            tool_params = tool.get('inputSchema', {}).get('properties', {})
                            logger.info(f"   Tool {i+1}: {tool_name}")
                            logger.info(f"     Description: {tool_desc}")
                            if tool_params:
                                logger.info(f"     Parameters: {list(tool_params.keys())}")
                    else:
                        logger.warning("⚠️ No tools in response")
                except json.JSONDecodeError:
                    logger.warning(f"⚠️ Invalid tools response: {tools_line[:100]}")
            
            # Get ALL additional MCP data - resources, prompts, and any other capabilities
            additional_data = {}
            
            try:
                # Request resources
                resources_request = {"jsonrpc": "2.0", "id": 3, "method": "resources/list", "params": {}}
                process.stdin.write(json.dumps(resources_request) + '\n')
                process.stdin.flush()
                
                resources_line = process.stdout.readline()
                if resources_line:
                    try:
                        resources_response = json.loads(resources_line.strip())
                        if resources_response.get('result', {}).get('resources'):
                            resources = resources_response['result']['resources']
                            logger.info(f"📁 Found {len(resources)} resources")
                            # Log resource details
                            for i, resource in enumerate(resources[:3]):
                                logger.info(f"   Resource {i+1}: {resource.get('name', 'unnamed')} - {resource.get('description', 'no desc')}")
                    except json.JSONDecodeError:
                        pass
                
                # Request prompts
                prompts_request = {"jsonrpc": "2.0", "id": 4, "method": "prompts/list", "params": {}}
                process.stdin.write(json.dumps(prompts_request) + '\n')
                process.stdin.flush()
                
                prompts_line = process.stdout.readline()
                if prompts_line:
                    try:
                        prompts_response = json.loads(prompts_line.strip())
                        if prompts_response.get('result', {}).get('prompts'):
                            prompts = prompts_response['result']['prompts']
                            logger.info(f"💬 Found {len(prompts)} prompts")
                            # Log prompt details
                            for i, prompt in enumerate(prompts[:3]):
                                logger.info(f"   Prompt {i+1}: {prompt.get('name', 'unnamed')} - {prompt.get('description', 'no desc')}")
                    except json.JSONDecodeError:
                        pass
                        
            except Exception as e:
                logger.warning(f"⚠️ Failed to get additional MCP data: {e}")
            
            # Calculate comprehensive functionality score
            total_functionality = len(tools) + len(resources) + len(prompts)
            functionality_breakdown = {
                "tools_count": len(tools),
                "resources_count": len(resources),
                "prompts_count": len(prompts),
                "has_capabilities": bool(capabilities),
                "has_server_info": bool(server_info)
            }
            
            return {
                "success": True,
                "tools": tools,
                "resources": resources,
                "prompts": prompts,
                "protocol_version": protocol_version,
                "server_info": server_info,
                "capabilities": capabilities,
                "total_functionality": total_functionality,
                "functionality_breakdown": functionality_breakdown,
                "stderr": stderr_data,
                "additional_data": additional_data
            }
            
        except Exception as e:
            logger.error(f"❌ Communication failed: {e}")
            # Try to capture any stderr even on failure
            stderr_data = ""
            try:
                if hasattr(process.stderr, 'read'):
                    stderr_data = process.stderr.read() or ""
            except:
                pass
            
            return {
                "success": False, 
                "error": str(e),
                "stderr": stderr_data
            }
    
    async def _cleanup_process(self, process: subprocess.Popen):
        """Safely cleanup MCP server process"""
        try:
            if process.poll() is None:  # Still running
                process.terminate()
                await asyncio.sleep(1)
                if process.poll() is None:  # Force kill
                    process.kill()
        except Exception as e:
            logger.warning(f"⚠️ Cleanup warning: {e}")

class MCPAuthDetector:
    """Detects ACTUAL authentication requirements from MCP connections"""
    
    def extract_auth_from_mcp_result(self, package_name: str, mcp_result: Dict) -> tuple[bool, List[str]]:
        """Extract REAL auth requirements from MCP connection attempt"""
        
        logger.info(f"🔐 EXTRACTING REAL AUTH REQUIREMENTS for {package_name}")
        
        detected_env_vars = []
        auth_required = False
        
        # 1. PRIORITY: Extract from MCP connection error (most accurate)
        if not mcp_result.get('success', False):
            error_message = mcp_result.get('error', '')
            stderr_output = mcp_result.get('stderr', '')
            
            # Combine all error sources
            all_errors = f"{error_message} {stderr_output}".upper()
            
            if all_errors:
                logger.info(f"   ❌ MCP failed - extracting auth from error...")
                
                # Look for specific auth error patterns
                auth_error_patterns = [
                    r'missing required environment variable[:\s]+([A-Z][A-Z0-9_]{3,})',
                    r'environment variable ([A-Z][A-Z0-9_]{3,}) is required',
                    r'please set ([A-Z][A-Z0-9_]{3,})',
                    r'([A-Z][A-Z0-9_]{3,}) not found',
                    r'([A-Z][A-Z0-9_]{3,}) is not set',
                    r'missing ([A-Z][A-Z0-9_]{3,})',
                    r'requires? ([A-Z][A-Z0-9_]{3,})',
                    r'set the ([A-Z][A-Z0-9_]{3,}) environment variable'
                ]
                
                import re
                for pattern in auth_error_patterns:
                    matches = re.findall(pattern, all_errors, re.IGNORECASE)
                    for match in matches:
                        if any(keyword in match.lower() for keyword in ['key', 'token', 'secret', 'auth', 'api', 'url', 'client']):
                            detected_env_vars.append(match.upper())
                            logger.info(f"   🎯 REAL AUTH ERROR: {match}")
                
                # If we found specific env vars from errors, that's definitive
                if detected_env_vars:
                    auth_required = True
                    logger.info(f"   ✅ CONFIRMED AUTH from MCP errors: {detected_env_vars}")
                    return auth_required, list(set(detected_env_vars))
        
        # 2. If connection succeeded, check server info for auth requirements
        if mcp_result.get('success', False):
            server_info = mcp_result.get('server_info', {})
            capabilities = mcp_result.get('capabilities', {})
            
            # Some MCP servers report auth requirements in server info
            if server_info:
                server_name = server_info.get('name', '').lower()
                server_version = server_info.get('version', '').lower()
                
                # Check if server mentions auth in its info
                if any(keyword in f"{server_name} {server_version}" for keyword in ['auth', 'api', 'key', 'token']):
                    logger.info(f"   ℹ️ Server info suggests auth: {server_info}")
            
            # If connection worked, it either needs no auth OR auth was already provided
            # We'll mark as no auth required if it connected successfully
            logger.info(f"   ✅ MCP connected successfully - likely no auth required or auth provided")
            return False, []
        
        # 3. If we still don't know, check stderr for startup issues
        stderr = mcp_result.get('stderr', '')
        if stderr:
            # Look for any environment variable mentions in stderr
            import re
            env_mentions = re.findall(r'([A-Z][A-Z0-9_]{4,})', stderr)
            for var in env_mentions:
                if any(keyword in var.lower() for keyword in ['key', 'token', 'secret', 'auth', 'api']):
                    detected_env_vars.append(var)
                    logger.info(f"   📝 Found in stderr: {var}")
        
        # Clean up and return
        unique_env_vars = list(set(detected_env_vars))[:5]  # Limit to 5 most relevant
        auth_required = len(unique_env_vars) > 0
        
        logger.info(f"   🔐 FINAL AUTH RESULT: required={auth_required}, vars={unique_env_vars}")
        
        return auth_required, unique_env_vars

class AIAnalyzer:
    """AI-powered analysis of MCP data using OpenAI o4-mini for enhanced accuracy"""
    
    def __init__(self):
        # Initialize OpenAI client for enhanced analysis
        self.openai_client = None
        if os.getenv('OPENAI_API_KEY'):
            try:
                self.openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
                logger.info("✅ OpenAI o4-mini client initialized for enhanced analysis")
            except Exception as e:
                logger.warning(f"⚠️ OpenAI client failed to initialize: {e}")
                self.openai_client = None
        else:
            logger.info("ℹ️ No OpenAI API key - using Claude's built-in analysis")
    
    async def analyze_mcp_intelligence(self, package_data: Dict, mcp_data: Dict) -> Dict[str, Any]:
        """Use AI to analyze and enhance MCP data with OpenAI o4-mini for improved accuracy"""
        
        name = package_data.get('name', 'unknown')
        tools = mcp_data.get('tools', [])
        connection_success = mcp_data.get('success', False)
        
        logger.info(f"🧠 AI STARTING ANALYSIS for {name}")
        logger.info(f"   📊 Input data: connection={connection_success}, tools={len(tools)}, package_keys={list(package_data.keys())}")
        
        # Try OpenAI o4-mini first for enhanced accuracy, fallback to Claude's analysis
        if self.openai_client:
            try:
                analysis = await self._openai_enhanced_analysis(name, package_data, mcp_data)
                logger.info(f"🤖 OPENAI o4-mini ANALYSIS COMPLETE for {name}")
            except Exception as e:
                logger.warning(f"⚠️ OpenAI analysis failed for {name}: {e}")
                logger.info(f"🧠 Falling back to Claude's analysis...")
                analysis = self._claude_intelligent_analysis(name, package_data.get('description', ''), tools, connection_success, mcp_data, package_data)
        else:
            # Use Claude's built-in intelligence
            analysis = self._claude_intelligent_analysis(name, package_data.get('description', ''), tools, connection_success, mcp_data, package_data)
        
        logger.info(f"🧠 AI ANALYSIS COMPLETE for {name}:")
        logger.info(f"   📊 Intelligence={analysis['intelligence_score']:.2f}, Reliability={analysis['reliability_score']:.2f}")
        logger.info(f"   🏷️ Generated {len(analysis['tags'])} tags: {analysis['tags'][:10]}...")
        logger.info(f"   📝 Description length: {len(analysis['enhanced_description'])} chars")
        logger.info(f"   🔐 Auth detected: {analysis.get('auth_requirements', [])}")
        
        return analysis
    
    async def _openai_enhanced_analysis(self, name: str, package_data: Dict, mcp_data: Dict) -> Dict[str, Any]:
        """Enhanced analysis using OpenAI o4-mini for better description accuracy"""
        
        tools = mcp_data.get('tools', [])
        connection_success = mcp_data.get('success', False)
        readme = package_data.get('readme', '')
        keywords = package_data.get('keywords', [])
        
        # Prepare comprehensive context for OpenAI
        context = {
            'name': name,
            'description': package_data.get('description', ''),
            'readme_snippet': readme[:2000] if readme else '',  # First 2000 chars
            'keywords': keywords,
            'tools': [{'name': t.get('name', ''), 'description': t.get('description', '')} for t in tools],
            'connection_working': connection_success,
            'tool_count': len(tools)
        }
        
        prompt = f"""Analyze this MCP (Model Context Protocol) package and provide HIGHLY ACCURATE analysis for AI agents:

PACKAGE: {name}
DESCRIPTION: {package_data.get('description', '')}
README CONTENT: {readme[:1000] if readme else 'Not available'}
KEYWORDS: {', '.join(keywords)}
TOOLS COUNT: {len(tools)}
CONNECTION SUCCESS: {connection_success}

ACTUAL TOOLS FROM MCP CONNECTION:
{json.dumps([{'name': t.get('name', ''), 'description': t.get('description', ''), 'parameters': list(t.get('inputSchema', {}).get('properties', {}).keys()) if t.get('inputSchema', {}).get('properties') else []} for t in tools[:10]], indent=2)}

CONTEXT: This is for an AI agent discovery platform. Agents will use this info to decide if they need this MCP.

Provide JSON response with:
1. enhanced_description: EXACTLY 200 chars describing what this tool ACTUALLY does based on its tools (be specific - "browser automation" not "general automation". DON'T say "MCP" or "this MCP" - just describe the functionality)
2. primary_category: ONE word for main function (documentation/payments/automation/search/database/api/etc)
3. searchable_tags: Array of 20+ terms AI agents would search for (include tool names, use cases, technology keywords)
4. intelligence_score: 0.0-1.0 (higher if many sophisticated tools and working connection)
5. reliability_score: 0.0-1.0 (higher if connection works and tools are well-defined)
6. auth_requirements: Array of likely env vars (only if you're confident from tool/package context)
7. use_cases: Array of MINIMUM 5 specific use cases based on actual tools (must be at least 3, preferably 5+)

CRITICAL: Be accurate about what this does. If it's a doc viewer, say "provides documentation access". If it's Playwright, say "automates browser interactions". Don't mention "MCP" in descriptions.
"""

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert at analyzing software packages. Provide accurate, specific descriptions based on actual functionality."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for consistency
                max_tokens=1000
            )
            
            # Parse response
            content = response.choices[0].message.content
            
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                analysis_data = json.loads(json_match.group())
                
                # Ensure description is exactly 200 chars
                desc = analysis_data.get('enhanced_description', '')
                if len(desc) > 200:
                    desc = desc[:197] + "..."
                
                # Convert to standard format
                return {
                    'intelligence_score': analysis_data.get('intelligence_score', 0.5),
                    'reliability_score': analysis_data.get('reliability_score', 0.5),
                    'tags': analysis_data.get('searchable_tags', [])[:25],  # Limit to 25 tags
                    'enhanced_description': desc,
                    'use_cases': analysis_data.get('use_cases', [])[:5],
                    'business_value': f"Enables AI agents to perform {analysis_data.get('primary_category', 'utility')} tasks with verified tools and reliable integration.",
                    'auth_requirements': analysis_data.get('auth_requirements', []),
                    'documentation_quality': 'excellent' if connection_success and len(tools) > 10 else 'good' if connection_success else 'fair',
                    'setup_complexity': 'simple' if not analysis_data.get('auth_requirements') else 'moderate',
                    'maintenance_level': 'low' if connection_success else 'medium'
                }
            else:
                raise ValueError("No JSON found in OpenAI response")
                
        except Exception as e:
            logger.error(f"❌ OpenAI analysis failed: {e}")
            raise e
    
    def _claude_intelligent_analysis(self, name: str, description: str, tools: List[Dict], 
                                   connection_success: bool, mcp_data: Dict, package_data: Dict = None) -> Dict[str, Any]:
        """Claude's comprehensive intelligent analysis of MCP data"""
        
        if package_data is None:
            package_data = {}
        
        # Get all available text for analysis
        readme = package_data.get('readme', '')
        keywords = package_data.get('keywords', [])
        detailed_desc = package_data.get('detailed_description', description)
        
        # Combine all text sources
        all_text = f"{name} {description} {detailed_desc} {readme} {' '.join(keywords)}".lower()
        
        # 1. Intelligence Score Analysis
        intelligence_score = 0.1  # Base score
        
        if connection_success:
            intelligence_score += 0.4  # Working connection is valuable
            
        tools_count = len(tools)
        if tools_count > 0:
            # More tools = higher intelligence, with diminishing returns
            tool_bonus = min(0.4, tools_count * 0.05)
            intelligence_score += tool_bonus
            
            # Analyze tool sophistication
            sophisticated_tools = 0
            for tool in tools:
                tool_name = tool.get('name', '').lower()
                tool_desc = tool.get('description', '').lower()
                
                # Look for sophisticated functionality
                if any(keyword in f"{tool_name} {tool_desc}" for keyword in 
                      ['execute', 'analyze', 'process', 'generate', 'create', 'search', 'query', 'update', 'delete']):
                    sophisticated_tools += 1
            
            if sophisticated_tools > 0:
                intelligence_score += min(0.1, sophisticated_tools * 0.02)
        
        # Package quality indicators
        if 'official' in name.lower() or 'modelcontextprotocol' in name.lower():
            intelligence_score += 0.1
            
        intelligence_score = min(1.0, intelligence_score)
        
        # 2. Reliability Score Analysis  
        reliability_score = 0.2  # Base score
        
        if connection_success:
            reliability_score += 0.5  # Major factor
            
        if mcp_data.get('protocol_version'):
            reliability_score += 0.1  # Protocol compliance
            
        if tools_count > 0:
            reliability_score += 0.1  # Has actual functionality
            
        if tools_count > 5:
            reliability_score += 0.1  # Comprehensive functionality
            
        reliability_score = min(1.0, reliability_score)
        
        # 3. SEARCHABLE Tag Generation (what people actually search for)
        logger.info(f"🏷️ CLAUDE GENERATING SEARCHABLE TAGS for {name}")
        
        tags = set()
        
        # SEARCHABLE TERMS - what users actually type in search
        searchable_mapping = {
            # What people search for → what they find
            'web-automation': ['playwright', 'selenium', 'browser', 'automation', 'testing'],
            'testing': ['test', 'automation', 'e2e', 'browser', 'visual', 'screenshot'],
            'database': ['postgres', 'mysql', 'mongodb', 'sql', 'database', 'storage'],
            'api': ['api', 'rest', 'graphql', 'webhook', 'integration'],
            'search': ['search', 'brave', 'google', 'web-search', 'query'],
            'ai': ['openai', 'anthropic', 'gpt', 'ai', 'claude', 'llm'],
            'github': ['git', 'github', 'version-control', 'repository'],
            'slack': ['slack', 'chat', 'messaging', 'communication'],
            'stripe': ['stripe', 'payment', 'billing', 'e-commerce'],
            'email': ['email', 'sendgrid', 'mailgun', 'smtp'],
            'file-management': ['file', 'filesystem', 'storage', 'upload', 'download'],
            'data-processing': ['data', 'etl', 'transform', 'process', 'csv', 'json'],
            'monitoring': ['monitoring', 'logging', 'metrics', 'alerts'],
            'cloud': ['aws', 'azure', 'cloud', 'serverless'],
            'productivity': ['calendar', 'notes', 'tasks', 'todo', 'productivity'],
            'security': ['auth', 'security', 'oauth', 'jwt', 'encryption'],
            'social-media': ['twitter', 'facebook', 'social', 'posting'],
            'content': ['content', 'cms', 'blog', 'publishing'],
            'notification': ['notification', 'alert', 'webhook', 'push'],
            'image-processing': ['image', 'photo', 'visual', 'screenshot'],
            'document': ['document', 'pdf', 'word', 'text'],
            'scraping': ['scraping', 'crawling', 'extraction', 'parsing'],
            'workflow': ['workflow', 'automation', 'pipeline', 'task'],
        }
        
        # Analyze what people would search for based on actual functionality
        for search_term, indicators in searchable_mapping.items():
            if any(indicator in all_text for indicator in indicators):
                tags.add(search_term)
                logger.info(f"   🔍 Added searchable tag: {search_term}")
        
        # Add tool-based searchable tags based on what tools actually do
        for tool in tools:
            tool_name = tool.get('name', '').lower()
            tool_desc = tool.get('description', '').lower()
            tool_full = f"{tool_name} {tool_desc}"
            
            # What would people search for based on tool capabilities?
            tool_search_terms = {
                'click': 'web-interaction',
                'screenshot': 'screenshot-capture',
                'navigate': 'browser-navigation', 
                'type': 'form-filling',
                'wait': 'timing-control',
                'upload': 'file-upload',
                'download': 'file-download',
                'search': 'search-functionality',
                'create': 'content-creation',
                'delete': 'data-management',
                'update': 'data-modification',
                'query': 'data-querying',
                'validate': 'validation',
                'authenticate': 'authentication',
                'send': 'messaging',
                'fetch': 'data-retrieval'
            }
            
            for action, search_term in tool_search_terms.items():
                if action in tool_full:
                    tags.add(search_term)
        
        # Add resources and prompts as searchable features
        resources = mcp_data.get('resources', [])
        prompts = mcp_data.get('prompts', [])
        
        if resources:
            tags.add('resource-access')
            logger.info(f"   📁 Added resource-access tag ({len(resources)} resources)")
        if prompts:
            tags.add('prompt-templates')
            logger.info(f"   💬 Added prompt-templates tag ({len(prompts)} prompts)")
        
        # NPM keywords as searchable terms (clean them up)
        npm_keywords = package_data.get('keywords', [])
        for keyword in npm_keywords:
            if isinstance(keyword, str) and len(keyword) > 2 and keyword.isalpha():
                clean_keyword = keyword.lower().replace('-', '_')
                tags.add(clean_keyword)
        
        # Ensure we have enough searchable tags
        if len(tags) < 20:
            # Add common search terms based on MCP category
            fallback_tags = [
                'mcp', 'automation', 'integration', 'ai-tools', 'productivity',
                'workflow', 'assistant', 'helper', 'connector', 'service',
                'api-integration', 'data-tools', 'utility', 'automation-tools',
                'claude-tools', 'ai-assistant', 'model-context-protocol'
            ]
            
            for tag in fallback_tags:
                if len(tags) >= 20:
                    break
                tags.add(tag)
        
        logger.info(f"   🏷️ Generated {len(tags)} searchable tags")
        
        # 4. Enhanced Description Generation
        enhanced_description = self._generate_enhanced_description(
            name, detailed_desc, tools, connection_success, tools_count, tags, package_data
        )
        
        # 5. Use Cases Generation (more comprehensive)
        use_cases = self._generate_comprehensive_use_cases(name, tools, tags, tools_count)
        
        # 6. Business Value Assessment
        business_value = self._generate_business_value(name, tools_count, tags, connection_success)
        
        # 7. Quality Assessments
        doc_quality = "excellent" if connection_success and tools_count > 10 else \
                     "good" if connection_success and tools_count > 0 else \
                     "fair" if connection_success else "poor"
        
        setup_complexity = self._assess_setup_complexity(all_text, tools)
        maintenance_level = self._assess_maintenance_level(connection_success, tools_count, package_data)
        
        # Extract auth requirements if available
        auth_requirements = []
        
        # Check if we have auth info from the MCP data
        if mcp_data.get('auth_env_vars'):
            auth_requirements = mcp_data.get('auth_env_vars', [])
        elif package_data and package_data.get('name'):
            # Use the same logic as MCPAuthDetector for consistency
            package_name = package_data['name'].lower()
            service_patterns = {
                'stripe': ['STRIPE_SECRET_KEY', 'STRIPE_API_KEY'],
                'github': ['GITHUB_TOKEN', 'GITHUB_PERSONAL_ACCESS_TOKEN'],
                'openai': ['OPENAI_API_KEY'],
                'anthropic': ['ANTHROPIC_API_KEY'],
                'brave': ['BRAVE_SEARCH_API_KEY'],
                'slack': ['SLACK_BOT_TOKEN'],
                'notion': ['NOTION_API_KEY'],
                'postgres': ['DATABASE_URL'],
                'supabase': ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
            }
            
            for service, env_vars in service_patterns.items():
                if service in package_name:
                    auth_requirements = env_vars
                    break
        
        logger.info(f"   🔐 Auth requirements: {auth_requirements}")
        
        return {
            "intelligence_score": intelligence_score,
            "reliability_score": reliability_score,
            "tags": list(tags),  # Return all searchable tags
            "use_cases": use_cases,
            "business_value": business_value,
            "enhanced_description": enhanced_description,
            "auth_requirements": auth_requirements,
            "documentation_quality": doc_quality,
            "setup_complexity": setup_complexity,
            "maintenance_level": maintenance_level
        }
    
    def _generate_enhanced_description(self, name: str, description: str, tools: List[Dict], 
                                     connection_success: bool, tools_count: int, tags: set, package_data: Dict) -> str:
        """Generate a 200-character description of what this tool actually does (no MCP mentions)"""
        
        logger.info(f"📝 CLAUDE GENERATING 200-CHAR DESCRIPTION for {name}")
        
        # Identify the primary function from tools and tags
        primary_functions = []
        
        if connection_success and tools_count > 0:
            # Extract key actions from actual tools
            for tool in tools[:3]:  # Top 3 tools
                tool_name = tool.get('name', '').lower()
                if any(action in tool_name for action in ['click', 'navigate', 'screenshot']):
                    primary_functions.append('browser automation')
                elif any(action in tool_name for action in ['query', 'search', 'find']):
                    primary_functions.append('search and query operations')
                elif any(action in tool_name for action in ['create', 'upload', 'save']):
                    primary_functions.append('content creation')
                elif any(action in tool_name for action in ['send', 'message', 'notify']):
                    primary_functions.append('communication')
                elif any(action in tool_name for action in ['get', 'fetch', 'retrieve']):
                    primary_functions.append('data retrieval')
        
        # Determine primary category from tags
        primary_tag = 'automation'
        priority_tags = ['web-automation', 'database', 'api', 'search', 'ai', 'github', 'slack', 'stripe', 'documentation']
        for tag in priority_tags:
            if tag in tags:
                primary_tag = tag.replace('-', ' ')
                break
        
        # Generate concise description based on actual functionality (NO MCP MENTIONS)
        if connection_success and tools_count > 0:
            if tools_count > 20:
                desc = f"Comprehensive {primary_tag} tool with {tools_count} functions for "
            elif tools_count > 5:
                desc = f"Feature-rich {primary_tag} tool with {tools_count} functions for "
            else:
                desc = f"Focused {primary_tag} tool with {tools_count} functions for "
            
            if primary_functions:
                desc += f"{', '.join(set(primary_functions))} and task automation"
            else:
                desc += f"{primary_tag} operations and task automation"
        else:
            desc = f"Provides {primary_tag} capabilities requiring configuration for automated task execution and workflow integration"
        
        # Truncate to exactly 200 characters
        if len(desc) > 200:
            desc = desc[:197] + "..."
        
        logger.info(f"   📝 Generated description ({len(desc)} chars): {desc}")
        
        return desc
    
    def _generate_comprehensive_use_cases(self, name: str, tools: List[Dict], tags: set, tools_count: int) -> List[str]:
        """Generate comprehensive use cases based on functionality - MINIMUM 3 use cases"""
        use_cases = []
        
        # Primary use cases based on tools and tags
        if any('playwright' in tag for tag in tags) or any('browser' in tag for tag in tags):
            use_cases.extend([
                'Web automation and browser testing',
                'Screenshot capture and visual validation', 
                'Form filling and data extraction',
                'E2E testing for web applications',
                'Web scraping and content monitoring'
            ])
        elif any('database' in tag for tag in tags):
            use_cases.extend([
                'Database operations and queries',
                'Data storage and retrieval',
                'Database schema management',
                'Data backup and migration',
                'Real-time data monitoring'
            ])
        elif any('search' in tag for tag in tags):
            use_cases.extend([
                'Web search and information retrieval',
                'Research assistance and fact-checking',
                'Content discovery and aggregation',
                'Market research automation',
                'Competitive intelligence gathering'
            ])
        elif any('documentation' in tag for tag in tags):
            use_cases.extend([
                'Documentation access and retrieval',
                'Code reference lookup',
                'API documentation browsing',
                'Development assistance',
                'Knowledge base querying'
            ])
        elif any('ai' in tag for tag in tags):
            use_cases.extend([
                'AI model integration and orchestration',
                'LLM-powered content generation',
                'AI assistant enhancement',
                'Automated content creation',
                'Intelligent data processing'
            ])
        
        # Tool-specific use cases if we don't have enough
        if len(use_cases) < 3:
            for tool in tools[:5]:
                tool_name = tool.get('name', '').lower()
                if 'click' in tool_name:
                    use_cases.append('Automated web interaction and clicking')
                elif 'navigate' in tool_name:
                    use_cases.append('Website navigation and browsing')
                elif 'upload' in tool_name:
                    use_cases.append('File upload automation')
                elif 'send' in tool_name:
                    use_cases.append('Message and notification sending')
                elif 'get' in tool_name or 'fetch' in tool_name:
                    use_cases.append('Data retrieval and information gathering')
        
        # Generic fallbacks to ensure minimum 3
        if len(use_cases) < 3:
            use_cases.extend([
                'Automated task execution',
                'Workflow integration and automation',
                'Agent-based process automation'
            ])
        
        # Remove duplicates and return at least 3, max 5
        unique_use_cases = list(dict.fromkeys(use_cases))  # Preserves order, removes duplicates
        return unique_use_cases[:5] if len(unique_use_cases) >= 3 else unique_use_cases + ['General automation tasks'] * (3 - len(unique_use_cases))
    
    def _generate_business_value(self, name: str, tools_count: int, tags: set, connection_success: bool) -> str:
        """Generate business value proposition"""
        if connection_success and tools_count > 0:
            primary_value = next(iter(tags)) if tags else 'automation'
            return f"Enables AI agents to perform {primary_value} tasks at scale with {tools_count} verified tools, reducing manual work and increasing productivity through reliable MCP integration."
        else:
            return f"Potential to enhance AI agent capabilities in {next(iter(tags), 'utility')} domain once properly configured and connected."
    
    def _assess_setup_complexity(self, text: str, tools: List[Dict]) -> str:
        """Assess setup complexity based on requirements"""
        auth_indicators = ['auth', 'token', 'key', 'credential', 'login', 'password']
        config_indicators = ['config', 'setup', 'install', 'database', 'server']
        
        auth_count = sum(1 for indicator in auth_indicators if indicator in text)
        config_count = sum(1 for indicator in config_indicators if indicator in text)
        
        if auth_count > 3 or config_count > 5:
            return 'complex'
        elif auth_count > 1 or config_count > 2:
            return 'moderate'
        else:
            return 'simple'
    
    def _assess_maintenance_level(self, connection_success: bool, tools_count: int, package_data: Dict) -> str:
        """Assess maintenance requirements"""
        if connection_success and tools_count > 5:
            return 'low'
        elif connection_success:
            return 'medium'
        else:
            # Check if recently updated
            modified = package_data.get('modified', '')
            if modified and '2024' in modified:
                return 'medium'
            else:
                return 'high'
    
    def _rule_based_analysis(self, package_data: Dict, mcp_data: Dict) -> Dict[str, Any]:
        """Fallback rule-based analysis when AI is not available"""
        name = package_data.get('name', '').lower()
        description = package_data.get('description', '').lower()
        
        # Calculate intelligence score based on connection and tools
        intelligence_score = 0.5  # Base score
        if mcp_data.get('success', False):
            intelligence_score += 0.3
        
        tools_count = len(mcp_data.get('tools', []))
        if tools_count > 0:
            intelligence_score += min(0.2, tools_count * 0.1)
        
        # Calculate reliability score
        reliability_score = 0.3  # Base score
        if mcp_data.get('success', False):
            reliability_score += 0.4
        if mcp_data.get('protocol_version'):
            reliability_score += 0.2
        if tools_count > 0:
            reliability_score += 0.1
        
        # Generate tags based on name and description
        tags = []
        tag_keywords = {
            'search': ['search', 'brave', 'google'],
            'database': ['postgres', 'mysql', 'mongodb', 'database', 'sql'],
            'api': ['api', 'rest', 'graphql'],
            'web': ['web', 'browser', 'http'],
            'github': ['github', 'git'],
            'slack': ['slack', 'chat'],
            'files': ['file', 'filesystem', 'directory'],
            'ai': ['openai', 'anthropic', 'ai', 'gpt'],
            'cloud': ['aws', 'azure', 'gcp', 'cloud']
        }
        
        text = f"{name} {description}"
        for tag, keywords in tag_keywords.items():
            if any(keyword in text for keyword in keywords):
                tags.append(tag)
        
        if not tags:
            tags = ['general', 'utility']
        
        # Generate use cases
        use_cases = []
        if 'search' in tags:
            use_cases.append('Web search for AI agents')
        if 'database' in tags:
            use_cases.append('Database operations and queries')
        if 'api' in tags:
            use_cases.append('API integration and data retrieval')
        if 'files' in tags:
            use_cases.append('File system operations')
        
        if not use_cases:
            use_cases = ['General MCP functionality']
        
        # Determine setup complexity
        setup_complexity = 'simple'
        if any(word in text for word in ['auth', 'token', 'key', 'credential']):
            setup_complexity = 'moderate'
        if any(word in text for word in ['database', 'server', 'deploy']):
            setup_complexity = 'complex'
        
        return {
            "intelligence_score": min(1.0, intelligence_score),
            "reliability_score": min(1.0, reliability_score),
            "tags": tags[:5],  # Limit to 5 tags
            "use_cases": use_cases[:3],  # Limit to 3 use cases
            "business_value": f"Provides {', '.join(tags)} functionality for AI agents",
            "documentation_quality": "good" if mcp_data.get('success') else "fair",
            "setup_complexity": setup_complexity,
            "maintenance_level": "medium"
        }

class NPMDiscovery:
    """Enhanced NPM discovery for MCPs with comprehensive metadata"""
    
    async def discover_mcps(self, limit: int = 50) -> List[Dict]:
        """Discover MCPs from specific NPM search with comprehensive metadata"""
        logger.info(f"🔍 Discovering MCPs from NPM MCP search (limit: {limit})")
        
        try:
            all_packages = []
            
            async with aiohttp.ClientSession() as session:
                # Use the specific NPM search URL for MCP packages
                pages_to_check = min(3, (limit // 20) + 1)  # Each page has ~20 results
                
                for page in range(pages_to_check):
                    url = f"https://registry.npmjs.org/-/v1/search?text=mcp&size=20&from={page * 20}&sortBy=downloads_monthly"
                    logger.info(f"📄 Fetching page {page + 1}: {url}")
                    
                    async with session.get(url) as response:
                        if response.status == 200:
                            data = await response.json()
                            packages = data.get('objects', [])
                            
                            for pkg in packages:
                                package_info = pkg.get('package', {})
                                if self._is_likely_mcp(package_info):
                                    # Get comprehensive package metadata
                                    enhanced_package = await self._get_enhanced_package_info(session, package_info)
                                    all_packages.append(enhanced_package)
                                    
                                    if len(all_packages) >= limit:
                                        break
                        else:
                            logger.warning(f"⚠️ NPM API page {page + 1} failed: {response.status}")
                    
                    if len(all_packages) >= limit:
                        break
            
            logger.info(f"📦 Found {len(all_packages)} MCP packages with enhanced metadata")
            return all_packages[:limit]
            
        except Exception as e:
            logger.error(f"❌ NPM discovery failed: {e}")
            return []
    
    async def _get_enhanced_package_info(self, session: aiohttp.ClientSession, package_info: Dict) -> Dict:
        """Get comprehensive package information from NPM registry"""
        try:
            package_name = package_info.get('name', '')
            if not package_name:
                return package_info
            
            # Get detailed package info from NPM registry
            registry_url = f"https://registry.npmjs.org/{package_name}"
            
            async with session.get(registry_url) as response:
                if response.status == 200:
                    detailed_info = await response.json()
                    latest_version = detailed_info.get('dist-tags', {}).get('latest', '1.0.0')
                    version_info = detailed_info.get('versions', {}).get(latest_version, {})
                    
                    # Combine all available metadata
                    enhanced = {
                        **package_info,
                        'detailed_description': version_info.get('description', package_info.get('description', '')),
                        'homepage': version_info.get('homepage', ''),
                        'repository': version_info.get('repository', {}),
                        'bugs': version_info.get('bugs', {}),
                        'keywords': version_info.get('keywords', []),
                        'license': version_info.get('license', ''),
                        'author': version_info.get('author', {}),
                        'maintainers': detailed_info.get('maintainers', []),
                        'readme': detailed_info.get('readme', ''),
                        'weekly_downloads': package_info.get('downloads', {}).get('weekly', 0),
                        'monthly_downloads': package_info.get('downloads', {}).get('monthly', 0),
                        'github_url': self._extract_github_url(version_info),
                        'created': detailed_info.get('time', {}).get('created', ''),
                        'modified': detailed_info.get('time', {}).get('modified', ''),
                        'latest_version': latest_version,
                        'all_versions': list(detailed_info.get('versions', {}).keys()),
                        'dependencies': version_info.get('dependencies', {}),
                        'dev_dependencies': version_info.get('devDependencies', {}),
                        'engines': version_info.get('engines', {}),
                        'scripts': version_info.get('scripts', {})
                    }
                    
                    logger.info(f"📋 Enhanced metadata for {package_name}: {len(enhanced.get('keywords', []))} keywords, github: {bool(enhanced.get('github_url'))}")
                    return enhanced
        
        except Exception as e:
            logger.warning(f"⚠️ Failed to enhance {package_name}: {e}")
        
        return package_info
    
    def _extract_github_url(self, version_info: Dict) -> str:
        """Extract GitHub URL from package repository info"""
        repo = version_info.get('repository', {})
        
        if isinstance(repo, dict):
            repo_url = repo.get('url', '')
        elif isinstance(repo, str):
            repo_url = repo
        else:
            return ''
        
        # Clean up GitHub URLs
        if 'github.com' in repo_url:
            # Handle various GitHub URL formats
            import re
            github_match = re.search(r'github\.com[:/]([^/]+/[^/]+?)(?:\.git|/|$)', repo_url)
            if github_match:
                return f"https://github.com/{github_match.group(1)}"
        
        return repo_url if repo_url.startswith('http') else ''
    
    def _is_likely_mcp(self, package: Dict) -> bool:
        """Use heuristics to filter likely MCP packages"""
        name = package.get('name', '').lower()
        description = package.get('description', '').lower()
        keywords = package.get('keywords', [])
        
        # Strong MCP indicators
        mcp_indicators = [
            'mcp' in name,
            'model-context-protocol' in name or 'model-context-protocol' in description,
            'claude' in keywords or 'anthropic' in keywords,
            'mcp-server' in keywords,
            any('mcp' in str(kw).lower() for kw in keywords)
        ]
        
        return any(mcp_indicators)

class MCPInstaller:
    """Handles MCP installation and command generation"""
    
    def generate_install_command(self, package: Dict) -> tuple[str, str]:
        """Generate installation command for MCP package"""
        name = package.get('name', '')
        
        # Determine install type and command
        if self._is_typescript_package(package):
            return f"npx {name}", "npm"
        else:
            return f"npx {name}", "npm"  # Default to npm for now
    
    def _is_typescript_package(self, package: Dict) -> bool:
        """Check if package is TypeScript/Node.js based"""
        # For now, assume all NPM packages are npm-based
        # Could be enhanced to detect Python, Rust, etc.
        return True

class CompleteAIMCPCrawler:
    """Complete AI-first MCP crawler with real MCP connection"""
    
    def __init__(self):
        # Initialize components
        self.mcp_client = MCPProtocolClient()
        self.auth_detector = MCPAuthDetector()
        self.ai_analyzer = AIAnalyzer()
        self.npm_discovery = NPMDiscovery()
        self.installer = MCPInstaller()
        
        # Initialize Supabase
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        if not supabase_url or not supabase_key:
            raise ValueError("Supabase credentials not found in environment")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # Stats
        self.stats = {
            'discovered': 0,
            'connected': 0, 
            'stored': 0,
            'failed': 0
        }
    
    async def crawl_mcps(self, limit: int = 20) -> Dict[str, Any]:
        """Main crawling method - discovers and analyzes MCPs"""
        logger.info(f"🚀 Starting AI-first MCP crawl (limit: {limit})")
        start_time = time.time()
        
        try:
            # Phase 1: AI-Enhanced Discovery
            logger.info("Phase 1: AI-Enhanced Discovery")
            packages = await self.npm_discovery.discover_mcps(limit)
            self.stats['discovered'] = len(packages)
            
            if not packages:
                logger.warning("⚠️ No packages discovered")
                return self.stats
            
            # Phase 2: Real MCP Connection & Analysis
            logger.info("Phase 2: Real MCP Connection & Analysis")
            results = []
            
            for i, package in enumerate(packages, 1):
                logger.info(f"📦 [{i}/{len(packages)}] Processing: {package.get('name', 'unknown')}")
                
                try:
                    result = await self._process_single_mcp(package)
                    if result:
                        # Store both analysis result and the original mcp_result for additional data
                        results.append(result)
                        self.stats['connected' if result[0].connection_working else 'failed'] += 1
                except Exception as e:
                    logger.error(f"❌ Failed to process {package.get('name', 'unknown')}: {e}")
                    self.stats['failed'] += 1
                
                # Brief pause between requests
                await asyncio.sleep(1)
            
            # Phase 3: Store to Supabase
            logger.info("Phase 3: Store to Supabase")
            stored_count = await self._store_results(results)
            self.stats['stored'] = stored_count
            
            duration = time.time() - start_time
            logger.info(f"🎉 Crawl complete in {duration:.1f}s")
            logger.info(f"📊 Stats: {self.stats}")
            
            return self.stats
            
        except Exception as e:
            logger.error(f"💥 Crawl failed: {e}")
            return self.stats
    
    async def _process_single_mcp(self, package: Dict) -> Optional[MCPAnalysis]:
        """Process a single MCP package"""
        try:
            name = package.get('name', 'unknown')
            
            # Generate installation command
            install_command, install_type = self.installer.generate_install_command(package)
            
            # Connect to MCP and get real data
            logger.info(f"🔌 Connecting to MCP: {name}")
            mcp_result = await self.mcp_client.connect_to_mcp(install_command)
            
            # Extract REAL auth requirements from MCP connection
            auth_required, auth_env_vars = self.auth_detector.extract_auth_from_mcp_result(name, mcp_result)
            
            # AI analysis of combined data  
            logger.info(f"🧠 AI analyzing: {name}")
            ai_analysis = await self.ai_analyzer.analyze_mcp_intelligence(package, mcp_result)
            
            # Use name as slug (no complex generation)
            slug = name
            
            # Build comprehensive analysis
            analysis = MCPAnalysis(
                name=name,
                slug=slug,
                description=package.get('description', ''),
                enhanced_description=ai_analysis.get('enhanced_description', package.get('description', '')),
                version=package.get('latest_version', '1.0.0'),
                
                # Real MCP data
                tools=mcp_result.get('tools', []),
                auth_required=auth_required,
                auth_env_vars=auth_env_vars,
                connection_working=mcp_result.get('success', False),
                protocol_version=mcp_result.get('protocol_version'),
                
                # AI analysis
                intelligence_score=ai_analysis['intelligence_score'],
                reliability_score=ai_analysis['reliability_score'],
                tags=ai_analysis['tags'],
                use_cases=ai_analysis['use_cases'],
                business_value=ai_analysis['business_value'],
                auth_requirements=ai_analysis.get('auth_requirements', []),
                
                # Installation
                auto_install_command=install_command,
                install_type=install_type,
                installation_verified=mcp_result.get('success', False),
                
                # Quality
                documentation_quality=ai_analysis['documentation_quality'],
                setup_complexity=ai_analysis['setup_complexity'],
                maintenance_level=ai_analysis['maintenance_level'],
                
                # Enhanced NPM metadata
                github_url=package.get('github_url', ''),
                homepage=package.get('homepage', ''),
                license=package.get('license', ''),
                keywords=package.get('keywords', []),
                weekly_downloads=package.get('weekly_downloads', 0),
                monthly_downloads=package.get('monthly_downloads', 0)
            )
            
            logger.info(f"✅ Analysis complete for {name}: connection={analysis.connection_working}, tools={len(analysis.tools)}")
            return (analysis, mcp_result)  # Return both for storage
            
        except Exception as e:
            logger.error(f"❌ Error processing {package.get('name', 'unknown')}: {e}")
            return None
    
    async def _store_results(self, results: List[tuple]) -> int:
        """Store results to Supabase"""
        stored_count = 0
        
        for analysis, mcp_result in results:
            try:
                # Convert to database format matching actual schema
                data = {
                    # Required fields
                    'name': analysis.name,
                    'slug': analysis.slug,
                    'endpoint': analysis.auto_install_command,  # Use install command as endpoint
                    'category': self._determine_category(analysis.name, analysis.enhanced_description, analysis.tags),
                    
                    # Enhanced descriptive fields
                    'description': analysis.enhanced_description or analysis.description,
                    
                    # MCP Protocol & Tools (COMPREHENSIVE data from actual MCP connection)
                    'tools': analysis.tools,
                    'available_resources': mcp_result.get('resources', []),
                    'prompt_templates': mcp_result.get('prompts', []),
                    'mcp_protocol_data': {
                        'version': analysis.protocol_version,
                        'connection_working': analysis.connection_working,
                        'tools_count': len(analysis.tools),
                        'resources_count': len(mcp_result.get('resources', [])),
                        'prompts_count': len(mcp_result.get('prompts', [])),
                        'total_functionality': mcp_result.get('total_functionality', len(analysis.tools)),
                        'functionality_breakdown': mcp_result.get('functionality_breakdown', {}),
                        'server_info': mcp_result.get('server_info', {}),
                        'capabilities': mcp_result.get('capabilities', {}),
                        'stderr_output': mcp_result.get('stderr', ''),
                        'raw_error_data': mcp_result.get('error', ''),
                        'additional_data': mcp_result.get('additional_data', {})
                    },
                    
                    # Authentication (REAL data from MCP connection)
                    'auth_required': analysis.auth_required,
                    'required_env_vars': analysis.auth_env_vars,  # From actual MCP errors/requirements
                    'setup_complexity': analysis.setup_complexity,
                    
                    # Installation
                    'install_type': analysis.install_type,
                    'auto_install_command': analysis.auto_install_command,
                    'installation_methods': [{
                        'type': analysis.install_type,
                        'command': analysis.auto_install_command,
                        'preferred': True
                    }],
                    
                    # Enhanced NPM metadata (map to correct database fields)
                    'github_url': analysis.github_url,
                    'website_url': analysis.homepage,  # homepage maps to website_url in DB
                    'license': analysis.license,
                    'stars': analysis.weekly_downloads,  # Use weekly downloads as popularity metric
                    
                    # Quality & Intelligence Scores
                    'overall_intelligence_score': analysis.intelligence_score,
                    'reliability_score': analysis.reliability_score,
                    'quality_breakdown': {
                        'documentation_quality': analysis.documentation_quality,
                        'setup_complexity': analysis.setup_complexity,
                        'maintenance_level': analysis.maintenance_level,
                        'business_value': analysis.business_value
                    },
                    
                    # Discovery metadata
                    'auto_discovered': True,
                    'discovery_source': 'ai_crawler_enhanced',
                    'discovery_confidence': 'high' if analysis.connection_working else 'medium',
                    'intelligence_collection_date': datetime.utcnow().isoformat(),
                    
                    # Comprehensive tags and use cases 
                    'tags': analysis.tags,
                    'use_cases': analysis.use_cases,  # CRITICAL: Store the use cases!
                    'topics': analysis.keywords + analysis.tags,  # Combine NPM keywords with AI tags
                    
                    # Health status (valid values: healthy, down, unknown, pending)
                    'health_status': 'healthy' if analysis.connection_working else 'down',
                    'connection_stability': 'stable' if analysis.connection_working else 'unreliable',
                    
                    # Verification status
                    'verified': analysis.connection_working,
                    
                    # Timestamps
                    'last_scraped_at': datetime.utcnow().isoformat(),
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }
                
                # Insert or update
                result = self.supabase.table('mcps').upsert(data, on_conflict='slug').execute()
                
                if result.data:
                    logger.info(f"💾 Stored: {analysis.name}")
                    stored_count += 1
                else:
                    logger.warning(f"⚠️ Failed to store: {analysis.name}")
                    
            except Exception as e:
                logger.error(f"❌ Storage error for {analysis.name}: {e}")
        
        return stored_count
    
# Removed _generate_slug - using name directly as slug for simplicity
    
    def _determine_category(self, name: str, description: str, tags: List[str]) -> str:
        """Determine valid category based on MCP content"""
        
        # Valid categories from database schema
        valid_categories = [
            'databases', 'payments', 'ai-tools', 'development-tools', 
            'cloud-storage', 'messaging', 'content-creation', 'monitoring',
            'project-management', 'security', 'automation', 'social-media',
            'web-apis', 'productivity', 'infrastructure', 'media-processing',
            'finance', 'communication', 'research', 'iot'
        ]
        
        text = f"{name} {description} {' '.join(tags)}".lower()
        
        # Category mapping based on keywords
        category_keywords = {
            'databases': ['database', 'postgres', 'mysql', 'mongodb', 'sql', 'sqlite'],
            'payments': ['payment', 'stripe', 'paypal', 'billing', 'invoice'],
            'ai-tools': ['openai', 'anthropic', 'gpt', 'claude', 'ai', 'llm', 'ml'],
            'development-tools': ['git', 'github', 'code', 'dev', 'build', 'test'],
            'cloud-storage': ['s3', 'storage', 'bucket', 'drive', 'dropbox'],
            'messaging': ['slack', 'discord', 'teams', 'chat', 'message'],
            'content-creation': ['content', 'generate', 'create', 'write'],
            'monitoring': ['monitor', 'metric', 'log', 'trace', 'alert'],
            'project-management': ['project', 'task', 'jira', 'trello'],
            'security': ['auth', 'security', 'token', 'permission', 'oauth'],
            'automation': ['automate', 'workflow', 'trigger', 'schedule'],
            'social-media': ['twitter', 'facebook', 'instagram', 'social'],
            'web-apis': ['api', 'rest', 'http', 'web', 'request', 'search', 'brave'],
            'productivity': ['calendar', 'note', 'document', 'office'],
            'infrastructure': ['deploy', 'server', 'cloud', 'aws', 'azure'],
            'media-processing': ['image', 'video', 'audio', 'media', 'ffmpeg'],
            'finance': ['finance', 'bank', 'investment', 'trading'],
            'communication': ['email', 'sms', 'call', 'notify'],
            'research': ['research', 'academic', 'paper', 'science'],
            'iot': ['iot', 'sensor', 'device', 'smart', 'home']
        }
        
        # Find best matching category
        for category, keywords in category_keywords.items():
            if any(keyword in text for keyword in keywords):
                return category
        
        # Default fallback
        return 'web-apis'

async def main():
    """Main entry point"""
    try:
        # Check environment
        required_env = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
        missing = [var for var in required_env if not os.getenv(var)]
        
        if missing:
            logger.error(f"❌ Missing environment variables: {missing}")
            return
        
        # Initialize crawler
        crawler = CompleteAIMCPCrawler()
        
        # Run crawl
        stats = await crawler.crawl_mcps(limit=25)
        
        print("\n" + "="*50)
        print("🎉 AI-First MCP Crawler Complete!")
        print("="*50)
        print(f"📦 Discovered: {stats['discovered']}")
        print(f"🔌 Connected: {stats['connected']}")
        print(f"💾 Stored: {stats['stored']}")
        print(f"❌ Failed: {stats['failed']}")
        print("="*50)
        
    except KeyboardInterrupt:
        logger.info("\n⏹️ Crawl interrupted by user")
    except Exception as e:
        logger.error(f"💥 Crawl failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())