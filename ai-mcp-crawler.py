#!/usr/bin/env python3

"""
🚀 AI-First MCP Crawler
Revolutionary MCP discovery and analysis system built on crawl4ai

Architecture:
- AI-driven discovery pipeline
- LLM-native content analysis
- Intelligent quality assessment
- Direct Claude integration
- Automated Supabase storage

Author: Claude Code AI
"""

import os
import json
import asyncio
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime

# Crawl4AI imports
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, LLMConfig, BrowserConfig, CacheMode
from crawl4ai.extraction_strategy import LLMExtractionStrategy

# Supabase integration
from supabase import create_client, Client

# Configure rich console for beautiful output
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich.table import Table

console = Console()

class MCPPackage(BaseModel):
    """AI-optimized MCP package data structure"""
    name: str = Field(..., description="Full NPM package name")
    description: str = Field(..., description="AI-enhanced description focused on capabilities")
    version: str = Field(..., description="Latest version")
    keywords: List[str] = Field(default=[], description="Package keywords")
    repository_url: Optional[str] = Field(None, description="GitHub repository URL")
    npm_url: str = Field(..., description="NPM package URL")
    
    # AI-extracted intelligence
    tools: List[Dict[str, Any]] = Field(default=[], description="Available MCP tools")
    use_cases: List[str] = Field(default=[], description="AI-generated use cases")
    auth_required: bool = Field(False, description="Requires authentication")
    auth_methods: List[str] = Field(default=[], description="Authentication methods")
    required_env_vars: List[str] = Field(default=[], description="Required environment variables")
    setup_complexity: str = Field("simple", description="Setup difficulty: simple, moderate, complex")
    
    # Quality metrics
    intelligence_score: float = Field(0.0, description="AI-assessed intelligence score")
    reliability_score: float = Field(0.0, description="AI-assessed reliability score")
    documentation_quality: str = Field("unknown", description="Documentation quality assessment")
    
    # Rich metadata
    tags: List[str] = Field(default=[], description="AI-generated semantic tags")
    category: str = Field("other", description="AI-determined category")
    business_value: str = Field("", description="AI-assessed business value proposition")

class IntelligentMCPAnalyzer:
    """AI-first MCP package analyzer using crawl4ai's LLM capabilities"""
    
    def __init__(self, 
                 llm_provider: str = "openai/gpt-4o", 
                 api_key: Optional[str] = None,
                 supabase_url: Optional[str] = None,
                 supabase_key: Optional[str] = None):
        
        self.llm_config = LLMConfig(
            provider=llm_provider,
            api_token=api_key or os.getenv('OPENAI_API_KEY')
        )
        
        # Initialize Supabase client if credentials provided
        self.supabase = None
        if supabase_url and supabase_key:
            self.supabase = create_client(supabase_url, supabase_key)
        
        # Browser configuration for optimal crawling
        self.browser_config = BrowserConfig(
            headless=True,
            verbose=False
        )
        
        console.print(Panel.fit(
            f"🧠 AI-First MCP Crawler Initialized\n"
            f"🤖 LLM Provider: {llm_provider}\n"
            f"🔗 Supabase: {'Connected' if self.supabase else 'Not configured'}\n"
            f"🚀 Ready for intelligent MCP discovery",
            title="[bold green]Crawler Status",
            border_style="green"
        ))

    async def discover_npm_mcps(self, search_query: str = "mcp server", limit: int = 50) -> List[Dict[str, Any]]:
        """Intelligently discover MCP packages from NPM using AI-driven search"""
        
        console.print(f"\n🔍 [bold blue]Discovering MCPs with query: '{search_query}'[/bold blue]")
        
        # Define the extraction schema for NPM search results
        npm_search_schema = {
            "type": "object",
            "properties": {
                "packages": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Package name"},
                            "description": {"type": "string", "description": "Package description"},
                            "version": {"type": "string", "description": "Latest version"},
                            "keywords": {"type": "array", "items": {"type": "string"}},
                            "repository_url": {"type": "string", "description": "Repository URL"},
                            "npm_url": {"type": "string", "description": "NPM package URL"},
                            "relevance_score": {"type": "number", "description": "AI-assessed relevance to MCP (0-1)"}
                        },
                        "required": ["name", "description", "version", "npm_url"]
                    }
                }
            }
        }
        
        # Create AI-powered extraction strategy
        extraction_strategy = LLMExtractionStrategy(
            llm_config=self.llm_config,
            schema=json.dumps(npm_search_schema),
            extraction_type="schema",
            instruction=f"""
            Extract NPM packages related to '{search_query}' from this page.
            Focus on packages that are Model Context Protocol (MCP) servers or tools.
            Look for packages with names containing 'mcp', 'model-context-protocol', or descriptions mentioning MCP, AI agents, Claude, or similar terms.
            
            For each package, assess its relevance to MCP on a scale of 0-1:
            - 1.0: Clearly an MCP server (name contains 'mcp-server', description mentions MCP)
            - 0.8-0.9: Likely MCP-related (mentions AI agents, Claude integration, etc.)
            - 0.5-0.7: Possibly MCP-related (general AI tooling)
            - 0.0-0.4: Not MCP-related
            
            Only include packages with relevance_score >= 0.5.
            """,
            chunk_token_threshold=2000,
            apply_chunking=True,
            extra_args={"temperature": 0.1, "max_tokens": 3000}
        )
        
        crawl_config = CrawlerRunConfig(
            extraction_strategy=extraction_strategy,
            cache_mode=CacheMode.BYPASS,
            word_count_threshold=10
        )
        
        # Search NPM for MCP packages
        search_url = f"https://www.npmjs.com/search?q={search_query.replace(' ', '%20')}"
        
        async with AsyncWebCrawler(config=self.browser_config) as crawler:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task("Crawling NPM search results...", total=None)
                
                result = await crawler.arun(
                    url=search_url,
                    config=crawl_config
                )
                
                progress.update(task, description="✅ NPM search complete")
        
        if not result.success:
            console.print(f"❌ [red]Failed to crawl NPM: {result.error_message}[/red]")
            return []
        
        try:
            extracted_data = json.loads(result.extracted_content)
            packages = extracted_data.get('packages', [])
            
            console.print(f"📦 [green]Found {len(packages)} relevant MCP packages[/green]")
            
            # Sort by relevance score
            packages.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
            
            return packages[:limit]
            
        except json.JSONDecodeError as e:
            console.print(f"❌ [red]Failed to parse extracted data: {e}[/red]")
            return []

    async def analyze_mcp_package(self, package_name: str) -> Optional[MCPPackage]:
        """Perform deep AI analysis of an MCP package"""
        
        console.print(f"\n🧠 [bold blue]Analyzing package: {package_name}[/bold blue]")
        
        # Define comprehensive analysis schema
        analysis_schema = {
            "type": "object",
            "properties": {
                "package_info": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string", "description": "Enhanced description focusing on capabilities"},
                        "version": {"type": "string"},
                        "keywords": {"type": "array", "items": {"type": "string"}},
                        "repository_url": {"type": "string"},
                        "npm_url": {"type": "string"}
                    }
                },
                "mcp_intelligence": {
                    "type": "object", 
                    "properties": {
                        "tools": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "description": {"type": "string"},
                                    "parameters": {"type": "array", "items": {"type": "string"}}
                                }
                            }
                        },
                        "use_cases": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Specific business use cases for this MCP"
                        },
                        "auth_required": {"type": "boolean"},
                        "auth_methods": {"type": "array", "items": {"type": "string"}},
                        "required_env_vars": {"type": "array", "items": {"type": "string"}},
                        "setup_complexity": {"type": "string", "enum": ["simple", "moderate", "complex"]},
                        "tags": {
                            "type": "array", 
                            "items": {"type": "string"},
                            "description": "Semantic tags for search optimization"
                        },
                        "category": {"type": "string", "description": "Primary category"},
                        "business_value": {"type": "string", "description": "Value proposition"}
                    }
                },
                "quality_assessment": {
                    "type": "object",
                    "properties": {
                        "intelligence_score": {"type": "number", "description": "Overall intelligence (0-1)"},
                        "reliability_score": {"type": "number", "description": "Reliability assessment (0-1)"},
                        "documentation_quality": {"type": "string", "enum": ["excellent", "good", "fair", "poor", "unknown"]}
                    }
                }
            }
        }
        
        # Create AI analysis strategy
        analysis_strategy = LLMExtractionStrategy(
            llm_config=self.llm_config,
            schema=json.dumps(analysis_schema),
            extraction_type="schema",
            instruction=f"""
            Perform a comprehensive analysis of the NPM package '{package_name}' for MCP capabilities.
            
            Extract and analyze:
            1. Package information (name, description, version, etc.)
            2. MCP-specific intelligence:
               - Available tools and their descriptions
               - Practical use cases for business automation
               - Authentication requirements and methods
               - Required environment variables
               - Setup complexity assessment
               - Semantic tags for discoverability
               - Primary category classification
               - Business value proposition
            3. Quality assessment:
               - Intelligence score (how smart/useful is this MCP)
               - Reliability score (how well-maintained/stable)
               - Documentation quality level
            
            Focus on extracting actionable intelligence that helps users understand:
            - What this MCP does in practical terms
            - How to set it up and use it
            - What business problems it solves
            - How reliable and well-maintained it is
            
            Be specific and avoid generic descriptions. If information is not available, be honest about limitations.
            """,
            chunk_token_threshold=3000,
            apply_chunking=True,
            extra_args={"temperature": 0.1, "max_tokens": 4000}
        )
        
        crawl_config = CrawlerRunConfig(
            extraction_strategy=analysis_strategy,
            cache_mode=CacheMode.BYPASS,
            word_count_threshold=10
        )
        
        # Crawl the NPM package page
        npm_url = f"https://www.npmjs.com/package/{package_name}"
        
        async with AsyncWebCrawler(config=self.browser_config) as crawler:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task(f"Analyzing {package_name}...", total=None)
                
                result = await crawler.arun(
                    url=npm_url,
                    config=crawl_config
                )
                
                progress.update(task, description="✅ Analysis complete")
        
        if not result.success:
            console.print(f"❌ [red]Failed to analyze package {package_name}: {result.error_message}[/red]")
            return None
        
        try:
            analysis_data = json.loads(result.extracted_content)
            
            # Extract data sections
            package_info = analysis_data.get('package_info', {})
            mcp_intel = analysis_data.get('mcp_intelligence', {})
            quality = analysis_data.get('quality_assessment', {})
            
            # Create MCPPackage instance
            mcp_package = MCPPackage(
                name=package_info.get('name', package_name),
                description=package_info.get('description', ''),
                version=package_info.get('version', ''),
                keywords=package_info.get('keywords', []),
                repository_url=package_info.get('repository_url'),
                npm_url=package_info.get('npm_url', npm_url),
                
                tools=mcp_intel.get('tools', []),
                use_cases=mcp_intel.get('use_cases', []),
                auth_required=mcp_intel.get('auth_required', False),
                auth_methods=mcp_intel.get('auth_methods', []),
                required_env_vars=mcp_intel.get('required_env_vars', []),
                setup_complexity=mcp_intel.get('setup_complexity', 'simple'),
                tags=mcp_intel.get('tags', []),
                category=mcp_intel.get('category', 'other'),
                business_value=mcp_intel.get('business_value', ''),
                
                intelligence_score=quality.get('intelligence_score', 0.0),
                reliability_score=quality.get('reliability_score', 0.0),
                documentation_quality=quality.get('documentation_quality', 'unknown')
            )
            
            # Display analysis results
            self._display_analysis_results(mcp_package)
            
            return mcp_package
            
        except json.JSONDecodeError as e:
            console.print(f"❌ [red]Failed to parse analysis for {package_name}: {e}[/red]")
            return None
    
    def _display_analysis_results(self, mcp: MCPPackage):
        """Display beautiful analysis results"""
        
        table = Table(title=f"🧠 AI Analysis: {mcp.name}")
        table.add_column("Aspect", style="cyan")
        table.add_column("Details", style="white")
        
        table.add_row("Description", mcp.description[:100] + "..." if len(mcp.description) > 100 else mcp.description)
        table.add_row("Version", mcp.version)
        table.add_row("Tools", str(len(mcp.tools)))
        table.add_row("Use Cases", str(len(mcp.use_cases)))
        table.add_row("Auth Required", "✅ Yes" if mcp.auth_required else "❌ No")
        table.add_row("Setup", mcp.setup_complexity.title())
        table.add_row("Category", mcp.category.title())
        table.add_row("Intelligence", f"{mcp.intelligence_score:.2f}/1.0")
        table.add_row("Reliability", f"{mcp.reliability_score:.2f}/1.0")
        table.add_row("Tags", ", ".join(mcp.tags[:5]) + ("..." if len(mcp.tags) > 5 else ""))
        
        console.print(table)

    async def store_to_supabase(self, mcp: MCPPackage) -> bool:
        """Store analyzed MCP to Supabase database"""
        
        if not self.supabase:
            console.print("⚠️ [yellow]Supabase not configured, skipping storage[/yellow]")
            return False
        
        console.print(f"💾 [blue]Storing {mcp.name} to Supabase...[/blue]")
        
        try:
            # Prepare data for insertion
            insert_data = {
                "name": mcp.name,
                "slug": mcp.name.lower().replace("/", "-").replace("@", ""),
                "description": mcp.description,
                "endpoint": f"npx {mcp.name}",
                "package_manager": "npm",
                "npm_url": mcp.npm_url,
                "github_url": mcp.repository_url,
                "version": mcp.version,
                
                "auth_required": mcp.auth_required,
                "auth_methods": mcp.auth_methods,
                "required_env_vars": mcp.required_env_vars,
                "setup_complexity": mcp.setup_complexity,
                
                "tools": [{"name": t.get("name", ""), "description": t.get("description", "")} for t in mcp.tools],
                "tool_count": len(mcp.tools),
                "use_cases": mcp.use_cases,
                "tags": mcp.tags,
                "category": mcp.category,
                
                "intelligence_score": mcp.intelligence_score,
                "reliability_score": mcp.reliability_score,
                "documentation_quality_score": mcp.documentation_quality,
                "health_status": "healthy" if mcp.reliability_score > 0.7 else "unknown",
                "verified": mcp.intelligence_score > 0.6,
                
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            # Insert into Supabase
            result = self.supabase.table('mcps').upsert(insert_data, on_conflict='name').execute()
            
            if result.data:
                console.print(f"✅ [green]Successfully stored {mcp.name}[/green]")
                return True
            else:
                console.print(f"❌ [red]Failed to store {mcp.name}[/red]")
                return False
                
        except Exception as e:
            console.print(f"❌ [red]Error storing {mcp.name}: {str(e)}[/red]")
            return False

    async def crawl_and_analyze(self, 
                               search_query: str = "mcp server", 
                               limit: int = 10,
                               store_results: bool = True) -> List[MCPPackage]:
        """Complete crawl and analysis pipeline"""
        
        console.print(Panel.fit(
            f"🚀 Starting AI-First MCP Crawler\n"
            f"🔍 Query: '{search_query}'\n"
            f"📊 Limit: {limit} packages\n"
            f"💾 Store to Supabase: {'Yes' if store_results and self.supabase else 'No'}",
            title="[bold green]Crawler Configuration",
            border_style="green"
        ))
        
        # Phase 1: Discovery
        discovered_packages = await self.discover_npm_mcps(search_query, limit * 2)  # Get more to filter
        
        if not discovered_packages:
            console.print("❌ [red]No packages discovered[/red]")
            return []
        
        # Phase 2: Analysis
        analyzed_mcps = []
        
        with Progress(console=console) as progress:
            analysis_task = progress.add_task("Analyzing packages...", total=min(limit, len(discovered_packages)))
            
            for package in discovered_packages[:limit]:
                package_name = package.get('name')
                if not package_name:
                    continue
                    
                mcp = await self.analyze_mcp_package(package_name)
                if mcp:
                    analyzed_mcps.append(mcp)
                    
                    # Phase 3: Storage (if enabled)
                    if store_results and self.supabase:
                        await self.store_to_supabase(mcp)
                
                progress.advance(analysis_task)
        
        # Final summary
        console.print(Panel.fit(
            f"🎉 Crawl Complete!\n"
            f"📦 Packages discovered: {len(discovered_packages)}\n"
            f"🧠 Packages analyzed: {len(analyzed_mcps)}\n"
            f"💾 Packages stored: {len(analyzed_mcps) if store_results and self.supabase else 0}\n"
            f"⭐ Average intelligence: {sum(m.intelligence_score for m in analyzed_mcps) / len(analyzed_mcps):.2f}" if analyzed_mcps else "⭐ Average intelligence: N/A",
            title="[bold green]Results Summary",
            border_style="green"
        ))
        
        return analyzed_mcps

async def main():
    """Main crawler execution"""
    
    # Initialize the AI-first crawler
    crawler = IntelligentMCPAnalyzer(
        llm_provider="openai/gpt-4o",
        api_key=os.getenv('OPENAI_API_KEY'),
        supabase_url=os.getenv('SUPABASE_URL'),
        supabase_key=os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    )
    
    # Run the complete analysis pipeline
    results = await crawler.crawl_and_analyze(
        search_query="mcp server model context protocol",
        limit=5,  # Start small for testing
        store_results=True
    )
    
    # Display final results table
    if results:
        summary_table = Table(title="🏆 Top MCP Packages by Intelligence Score")
        summary_table.add_column("Package", style="cyan")
        summary_table.add_column("Intelligence", justify="center", style="green")
        summary_table.add_column("Reliability", justify="center", style="blue")
        summary_table.add_column("Category", style="yellow")
        summary_table.add_column("Tools", justify="center", style="magenta")
        
        for mcp in sorted(results, key=lambda x: x.intelligence_score, reverse=True):
            summary_table.add_row(
                mcp.name,
                f"{mcp.intelligence_score:.2f}",
                f"{mcp.reliability_score:.2f}",
                mcp.category.title(),
                str(len(mcp.tools))
            )
        
        console.print(summary_table)

if __name__ == "__main__":
    asyncio.run(main())