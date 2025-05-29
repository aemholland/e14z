# E14Z - Model Context Protocol Discovery Platform

A comprehensive platform for discovering, evaluating, and connecting to Model Context Protocol (MCP) servers. E14Z provides intelligent search capabilities and real-time monitoring to help developers and AI systems find the right tools for any task.

## Overview

E14Z serves as a centralized registry and discovery service for MCP servers, offering both web interface and programmatic access through REST and native MCP APIs. The platform combines intelligent search algorithms with performance monitoring to ensure reliable tool discovery.

## Features

### Search & Discovery
- **Intelligent Search**: Advanced ranking system considering relevance, performance, and health status
- **Comprehensive Filtering**: Filter by category, verification status, health, and more
- **Real-time Results**: Fast search with highlighting and contextual information

### Monitoring & Analytics
- **Health Monitoring**: Live status indicators and uptime tracking
- **Performance Metrics**: Response time and reliability analytics
- **Usage Statistics**: Comprehensive metrics for informed decision-making

### APIs & Integration
- **REST API**: Standard HTTP endpoints for web applications
- **Native MCP Protocol**: Direct MCP server integration
- **Multiple Formats**: JSON responses with flexible data formats

### User Interface
- **Professional Design**: Clean, GitHub-inspired interface
- **Responsive Layout**: Optimized for desktop and mobile devices
- **Detailed Views**: Comprehensive MCP information and installation guides

## Technology Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Custom CSS with GitHub design system
- **Database**: Supabase (PostgreSQL)
- **Search**: Full-text search with trigram similarity
- **Deployment**: Vercel with serverless functions
- **Monitoring**: Real-time health checks and performance tracking

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/aemholland/e14z.git
   cd e14z
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser

## API Documentation

### REST API

**Search MCPs**
```bash
curl "https://e14z.com/api/discover?q=database&verified=true&limit=10"
```

**Submit New MCP**
```bash
curl -X POST "https://e14z.com/api/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example MCP",
    "description": "Example MCP server",
    "endpoint": "npx example-mcp-server",
    "category": "development"
  }'
```

### MCP Protocol

Connect directly via MCP protocol:
```bash
# Example using MCP client
mcp connect https://e14z.com/mcp
```

Available tools:
- `discover`: Search for MCP servers
- `details`: Get detailed MCP information
- `review`: Submit performance feedback

## Database Schema

The platform uses a scalable PostgreSQL schema:

- **mcps**: Core MCP registry with metadata and configuration
- **performance_logs**: Time-series performance and monitoring data  
- **reviews**: User feedback and ratings
- **health_checks**: Real-time availability monitoring
- **api_calls**: Usage analytics and discovery metrics

## Contributing

We welcome contributions to improve E14Z. Please follow these guidelines:

### Submitting MCPs

1. **Web Interface**: Use the submission form at [e14z.com/submit](https://e14z.com/submit)
2. **API**: Submit programmatically via the `/api/submit` endpoint
3. **GitHub**: Create an issue with the MCP submission template

### Code Contributions

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Maintain test coverage for new features
- Use the established code formatting
- Update documentation for API changes

## Performance

Current platform metrics:

- **Response Time**: <100ms average search latency
- **Availability**: 99.9% uptime target
- **Capacity**: Handles 1000+ concurrent searches
- **Growth**: 50+ MCP servers indexed and growing

## Support

- **Documentation**: [e14z.com/docs](https://e14z.com/docs)
- **Issues**: [GitHub Issues](https://github.com/aemholland/e14z/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aemholland/e14z/discussions)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) for the protocol specification
- [Anthropic](https://anthropic.com/) for MCP development and Claude
- The MCP community for building an ecosystem of useful tools
- All contributors who have helped improve this platform

---

**E14Z** - Connecting AI systems to the tools they need.