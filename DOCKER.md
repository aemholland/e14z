# E14Z Docker Setup

This guide covers running E14Z with Docker for consistent development and deployment.

## 🚀 Quick Start

### Development Mode (Recommended)
```bash
# Start development environment with hot reload
npm run docker:dev

# Or directly with docker-compose
docker-compose -f docker-compose.dev.yml up --build
```

### Production Mode
```bash
# Start production environment
npm run docker:prod

# Or directly with docker-compose
docker-compose up --build
```

## 📋 Prerequisites

- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **.env.local** file with Supabase credentials

### Environment Setup
Create `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🛠️ Available Commands

```bash
# Development
npm run docker:dev      # Start dev environment with hot reload
npm run docker:stop     # Stop all containers
npm run docker:clean    # Stop and remove all containers, volumes, images

# Production
npm run docker:prod     # Start production environment

# Direct Docker commands
docker-compose -f docker-compose.dev.yml up    # Development
docker-compose up                               # Production
docker-compose down                             # Stop
docker-compose logs -f                          # View logs
```

## 🔧 Development Features

### Hot Reload
- Source code changes trigger automatic rebuilds
- No need to restart containers during development
- Fast iteration cycle

### Volume Mounts
```yaml
volumes:
  - .:/app                    # Source code
  - /app/node_modules         # Preserved node_modules
  - /app/.next                # Preserved Next.js cache
```

### Health Checks
- Automatic health monitoring
- Available at `http://localhost:3000/api/health`
- Container restarts on health check failures

## 🌐 Access Points

Once running, access E14Z at:

- **Website**: http://localhost:3000
- **API**: http://localhost:3000/api/discover
- **MCP Protocol**: http://localhost:3000/mcp
- **Health Check**: http://localhost:3000/api/health
- **Documentation**: http://localhost:3000/docs

## 🐳 Container Architecture

### Development Container (Dockerfile.dev)
- Based on `node:18-alpine`
- Includes all dev dependencies
- Optimized for fast rebuilds
- Hot reload enabled

### Production Container (Dockerfile)
- Multi-stage build for optimal size
- Security hardening with non-root user
- Standalone Next.js output
- Health checks included

## 📊 Monitoring

### Health Checks
```bash
# Check container health
docker-compose ps

# View health check logs
docker-compose logs e14z-dev

# Manual health check
curl http://localhost:3000/api/health
```

### Logs
```bash
# Follow all logs
docker-compose logs -f

# Follow specific service
docker-compose logs -f e14z-dev

# View last 100 lines
docker-compose logs --tail=100 e14z-dev
```

## 🔒 Security

### Development
- Runs as root for development convenience
- All ports exposed for debugging
- Source code mounted for editing

### Production
- Non-root user (nextjs:nodejs)
- Minimal attack surface
- Standalone build with reduced dependencies

## 📦 Build Optimization

### Development Build
- Fast incremental builds
- All dependencies included
- Source maps enabled

### Production Build
- Multi-stage build reduces image size
- Only production dependencies
- Optimized for startup time

## 🧪 Testing with Docker

```bash
# Run tests in container
docker-compose exec e14z-dev npm test

# Run linting
docker-compose exec e14z-dev npm run lint

# Run deduplication
docker-compose exec e14z-dev npm run dedupe:dry
```

## 🔧 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs e14z-dev

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
docker-compose -f docker-compose.dev.yml up -p 3001:3000
```

### Environment Variables Not Loading
```bash
# Check .env.local exists
ls -la .env.local

# Verify environment in container
docker-compose exec e14z-dev env | grep SUPABASE
```

### Hot Reload Not Working
```bash
# Restart with fresh build
docker-compose down
docker-compose -f docker-compose.dev.yml up --build
```

## 🚀 Deployment

### Using Production Container
```bash
# Build production image
docker build -t e14z:latest .

# Run production container
docker run -p 3000:3000 --env-file .env.local e14z:latest
```

### Docker Hub
```bash
# Tag for registry
docker tag e14z:latest your-registry/e14z:latest

# Push to registry
docker push your-registry/e14z:latest
```

## 💡 Best Practices

1. **Always use development mode** for coding
2. **Test production builds** before deploying
3. **Keep .env.local secure** and never commit it
4. **Use specific image tags** in production
5. **Monitor health checks** in production
6. **Clean up regularly** with `npm run docker:clean`

## 🆘 Getting Help

If you encounter issues:

1. Check this documentation
2. Review container logs: `docker-compose logs -f`
3. Verify environment variables
4. Try clean rebuild: `npm run docker:clean && npm run docker:dev`
5. Open an issue on GitHub with logs and error details