#!/usr/bin/env python3

"""
🎬 AI-First MCP Crawler Demo
Showcase the revolutionary capabilities of the new crawler
"""

import os
import sys
import asyncio
from pathlib import Path

# Add current directory to path  
sys.path.append(str(Path(__file__).parent))

# Import our crawler
import importlib.util
spec = importlib.util.spec_from_file_location("ai_mcp_crawler", "ai-mcp-crawler.py")
ai_mcp_crawler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai_mcp_crawler)

IntelligentMCPAnalyzer = ai_mcp_crawler.IntelligentMCPAnalyzer

from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()

async def demo_mock_analysis():
    """Demo the crawler with mock data (no API calls needed)"""
    
    console.print(Panel.fit(
        Text.from_markup(
            "🎬 [bold green]AI-First MCP Crawler Demo[/bold green]\n\n"
            "This demo showcases the revolutionary new architecture:\n"
            "• [cyan]AI-native intelligence[/cyan] - LLM drives every decision\n"
            "• [cyan]Schema-based extraction[/cyan] - Structured data from the start\n" 
            "• [cyan]Quality assessment[/cyan] - Intelligent scoring and validation\n"
            "• [cyan]Seamless integration[/cyan] - Built for Claude and AI agents\n\n"
            "[yellow]Note: This demo uses mock data to show capabilities[/yellow]"
        ),
        title="🚀 Revolutionary MCP Discovery",
        border_style="green"
    ))
    
    # Initialize crawler (mock mode)
    crawler = IntelligentMCPAnalyzer(
        llm_provider="openai/gpt-4o",
        api_key="mock-key",
        supabase_url=None,
        supabase_key=None
    )
    
    # Demo the data structures and capabilities
    console.print("\n📋 [bold blue]Example MCP Analysis Results:[/bold blue]\n")
    
    # Mock data showing what the AI would extract
    mock_mcps = [
        {
            "name": "@hubspot/mcp-server",
            "description": "HubSpot CRM integration server providing comprehensive contact, deal, and marketing automation capabilities through the Model Context Protocol",
            "intelligence_score": 0.92,
            "reliability_score": 0.88,
            "use_cases": [
                "Automate lead qualification and scoring workflows",
                "Sync customer data between HubSpot and other systems", 
                "Generate automated sales reports and analytics",
                "Trigger marketing campaigns based on deal stages"
            ],
            "tools": ["create_contact", "get_deals", "update_company", "send_email"],
            "auth_required": True,
            "auth_methods": ["oauth2", "private_app_token"],
            "setup_complexity": "moderate",
            "category": "crm-integration",
            "tags": ["hubspot", "crm", "sales", "marketing", "automation", "api-integration"]
        },
        {
            "name": "@modelcontextprotocol/server-filesystem", 
            "description": "Secure filesystem operations server enabling AI agents to read, write, and manage files and directories with safety constraints",
            "intelligence_score": 0.85,
            "reliability_score": 0.95,
            "use_cases": [
                "Enable AI agents to read configuration files",
                "Automated file organization and cleanup",
                "Process and transform document contents",
                "Manage project file structures"
            ],
            "tools": ["read_file", "write_file", "list_directory", "create_directory"],
            "auth_required": False,
            "auth_methods": [],
            "setup_complexity": "simple",
            "category": "file-management", 
            "tags": ["filesystem", "files", "directories", "safe-operations", "mcp-official"]
        },
        {
            "name": "mcp-server-postgres",
            "description": "PostgreSQL database integration server providing secure SQL query execution and schema management for AI agents",
            "intelligence_score": 0.89,
            "reliability_score": 0.91,
            "use_cases": [
                "Execute complex database queries for analytics",
                "Manage database schema migrations",
                "Generate reports from business data",
                "Automate data backup and maintenance tasks"
            ],
            "tools": ["execute_query", "describe_table", "create_backup", "analyze_performance"],
            "auth_required": True,
            "auth_methods": ["connection_string", "credentials"],
            "setup_complexity": "moderate",
            "category": "database",
            "tags": ["postgresql", "database", "sql", "analytics", "data-management"]
        }
    ]
    
    # Display each mock MCP with rich formatting
    for i, mcp in enumerate(mock_mcps, 1):
        console.print(f"\n[bold cyan]📦 {i}. {mcp['name']}[/bold cyan]")
        console.print(f"   [dim]Intelligence Score: {mcp['intelligence_score']:.2f} | Reliability: {mcp['reliability_score']:.2f}[/dim]")
        console.print(f"   📝 {mcp['description']}")
        console.print(f"   🔧 Tools: {', '.join(mcp['tools'][:3])}{'...' if len(mcp['tools']) > 3 else ''}")
        console.print(f"   🎯 Use Cases: {len(mcp['use_cases'])} identified")
        console.print(f"   🔐 Auth: {'Required' if mcp['auth_required'] else 'Not required'}")
        console.print(f"   📂 Category: {mcp['category']}")
        console.print(f"   🏷️ Tags: {', '.join(mcp['tags'][:4])}...")
    
    console.print(Panel.fit(
        Text.from_markup(
            "🎯 [bold green]Key Improvements Over Old Crawler:[/bold green]\n\n"
            "• [green]10x smarter analysis[/green] - AI understands context, not just text\n"
            "• [green]Rich structured data[/green] - Every field is meaningful and actionable\n"
            "• [green]Quality scoring[/green] - Intelligent assessment of usefulness\n" 
            "• [green]Business-focused[/green] - Use cases tailored for real workflows\n"
            "• [green]Seamless storage[/green] - Direct integration with Supabase\n\n"
            "[cyan]Ready to revolutionize MCP discovery! 🚀[/cyan]"
        ),
        title="✨ AI-First Revolution",
        border_style="green"
    ))

async def show_architecture():
    """Show the new architecture overview"""
    
    console.print(Panel.fit(
        Text.from_markup(
            "[bold yellow]🏗️ NEW AI-FIRST ARCHITECTURE[/bold yellow]\n\n"
            "[cyan]1. Intelligent Discovery[/cyan]\n"
            "   • LLM-driven NPM search with relevance scoring\n"
            "   • Semantic filtering and quality prediction\n\n"
            "[cyan]2. AI-Native Analysis[/cyan]\n"  
            "   • Schema-based structured extraction\n"
            "   • Multi-provider LLM support (OpenAI, Claude, Ollama)\n"
            "   • Contextual understanding of MCP patterns\n\n"
            "[cyan]3. Autonomous Quality Control[/cyan]\n"
            "   • Semantic validation of descriptions\n"
            "   • Automatic use-case generation\n"
            "   • Intelligent confidence scoring\n\n"
            "[cyan]4. Unified Storage & Integration[/cyan]\n"
            "   • Direct Supabase integration\n"  
            "   • Vector search capabilities\n"
            "   • Real-time updates and deduplication\n\n"
            "[green]Built on crawl4ai - The AI-first web crawler[/green]"
        ),
        title="🧠 Revolutionary Architecture",
        border_style="blue"
    ))

async def show_usage_examples():
    """Show usage examples"""
    
    console.print(Panel.fit(
        Text.from_markup(
            "[bold yellow]🚀 USAGE EXAMPLES[/bold yellow]\n\n"
            "[cyan]# Discover database tools[/cyan]\n"
            "python crawl-mcps.py --query \"database postgresql\" --limit 5 --store\n\n"
            "[cyan]# Analyze specific MCP[/cyan]\n"
            "python crawl-mcps.py --analyze \"@hubspot/mcp-server\"\n\n"
            "[cyan]# Find top quality MCPs[/cyan]\n" 
            "python crawl-mcps.py --top-quality --limit 20\n\n"
            "[cyan]# Full discovery pipeline[/cyan]\n"
            "python crawl-mcps.py --discover --store --limit 10\n\n"
            "[green]Works seamlessly with Claude and any AI agent![/green]"
        ),
        title="💻 Command Line Interface", 
        border_style="cyan"
    ))

async def main():
    """Run the complete demo"""
    
    console.clear()
    console.print("[bold green]🎬 AI-First MCP Crawler Demo[/bold green]\n")
    
    await show_architecture()
    await asyncio.sleep(1)
    
    await demo_mock_analysis()
    await asyncio.sleep(1)
    
    await show_usage_examples()
    
    console.print(Panel.fit(
        Text.from_markup(
            "[bold green]🎉 DEMO COMPLETE![/bold green]\n\n"
            "The AI-first crawler is ready to revolutionize MCP discovery.\n"
            "Built with crawl4ai for maximum intelligence and reliability.\n\n"
            "[yellow]To run with real data, set your API keys:[/yellow]\n"
            "export OPENAI_API_KEY='your-key'\n"
            "export SUPABASE_URL='your-url'\n"
            "export SUPABASE_SERVICE_ROLE_KEY='your-key'\n\n"
            "[cyan]Then run: python crawl-mcps.py --discover --limit 5[/cyan]"
        ),
        title="🚀 Ready for Production",
        border_style="green"
    ))

if __name__ == "__main__":
    asyncio.run(main())