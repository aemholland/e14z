# Contributing to E14Z

Thank you for your interest in contributing to E14Z! This document provides guidelines for contributing to the project.

## 🎯 Ways to Contribute

### 1. Submit New MCP Servers

Help grow the E14Z database by submitting new MCP servers:

- **Web Form**: Visit [e14z.com/submit](https://e14z.com/submit) (easiest)
- **GitHub Issue**: Use our [MCP Submission Template](.github/ISSUE_TEMPLATE/mcp-submission.md)
- **Pull Request**: Add to our seed data and submit a PR

**Required Information:**
- MCP name and description
- GitHub repository URL
- Connection type (stdio, http, websocket)
- Category (search, database, file-system, etc.)
- Documentation or setup instructions

### 2. Improve Existing MCPs

- Update descriptions or categorizations
- Add missing GitHub URLs or documentation links
- Report broken or outdated MCPs
- Suggest better categorization

### 3. Code Contributions

#### Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/aemholland/e14z.git
   cd e14z
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Fill in your Supabase credentials
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Development Guidelines

- **Code Style**: We use ESLint and Prettier. Run `npm run lint` before submitting
- **TypeScript**: All code must be properly typed
- **Testing**: Add tests for new features when applicable
- **Documentation**: Update README.md for significant changes

#### Areas for Contribution

- **Search Algorithm**: Improve relevance ranking
- **UI/UX**: Better search experience and MCP detail pages
- **Performance**: Optimize database queries and API responses
- **Mobile**: Improve mobile responsiveness
- **Accessibility**: Ensure proper ARIA labels and keyboard navigation

### 4. Documentation

- Improve setup instructions
- Add API usage examples
- Create tutorials for common use cases
- Fix typos or unclear sections

### 5. Bug Reports

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser/environment details
- Screenshots if applicable

## 🗃️ Understanding the Architecture

### Key Files and Directories

```
app/
├── layout.tsx                 # Root layout and navigation
├── page.tsx                   # Homepage with search
├── browse/page.tsx           # Browse all MCPs
├── mcp/[slug]/page.tsx       # Individual MCP pages
├── api/                      # REST API endpoints
└── docs/page.tsx             # API documentation

components/
├── search/                   # Search-related components
├── mcp/                      # MCP display components
└── ui/                       # Reusable UI components

lib/
├── supabase/                 # Database client and queries
├── search/                   # Search algorithm
└── utils/                    # Shared utilities
```

### Database Schema

The database is designed for future scale:

- **mcps**: Core MCP registry
- **performance_logs**: Time-series performance data
- **reviews**: Agent feedback and ratings
- **health_checks**: Real-time monitoring data

## 🚀 Submitting Changes

### Pull Request Process

1. **Ensure your branch is up to date**
   ```bash
   git checkout main
   git pull origin main
   git checkout your-branch
   git rebase main
   ```

2. **Run checks**
   ```bash
   npm run lint
   npm run build
   ```

3. **Commit with clear messages**
   ```bash
   git commit -m "feat: add advanced search filters"
   ```

4. **Push and create PR**
   ```bash
   git push origin your-branch
   ```

### PR Guidelines

- **Title**: Clear, descriptive title
- **Description**: Explain what changes you made and why
- **Testing**: Describe how you tested your changes
- **Screenshots**: Include for UI changes
- **Breaking Changes**: Clearly document any breaking changes

## 🔒 Open Source vs Proprietary

E14Z uses an "open source code, proprietary data" model:

**Open Source (MIT License):**
- All application code
- Database schema
- API implementations
- UI components
- Documentation

**Proprietary:**
- The curated MCP database entries
- Performance analytics data
- User reviews and ratings

This means you can:
- ✅ Fork and modify the codebase
- ✅ Self-host the platform
- ✅ Contribute improvements back
- ❌ Copy our MCP database
- ❌ Use our performance analytics data

## 📝 Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers learn and contribute
- Report inappropriate behavior to the maintainers

## 🏷️ Commit Message Format

We follow conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add health status indicators to MCP cards
fix: resolve search pagination bug
docs: update API documentation with examples
```

## 🎉 Recognition

Contributors will be:
- Listed in our README
- Credited in release notes
- Given priority for feature requests
- Invited to our contributor Discord

## 📧 Questions?

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: contribute@e14z.com (for sensitive issues)

Thank you for helping make E14Z the best discovery platform for AI agents! 🚀