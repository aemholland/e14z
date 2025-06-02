/**
 * OpenAPI/Swagger Configuration for E14Z MCP Registry API
 * Comprehensive documentation for all API endpoints with security and examples
 */

import swaggerJsdoc from 'swagger-jsdoc'

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'E14Z MCP Registry API',
    version: '4.1.1',
    description: `
# E14Z MCP Registry API

The E14Z API provides comprehensive access to the Model Context Protocol (MCP) Registry, 
allowing AI agents and developers to discover, manage, and analyze MCP servers.

## Features

- **MCP Discovery**: Search and filter from 50+ verified MCP servers
- **Analytics**: Comprehensive usage and performance analytics  
- **Security**: Enterprise-grade security with JWT authentication and RBAC
- **Real-time Monitoring**: Health checks and alerting
- **Admin Dashboard**: Complete management interface

## Authentication

Most endpoints support multiple authentication methods:
- **JWT Bearer Token**: For authenticated users with role-based access
- **API Key**: For programmatic access (header: \`X-API-Key\`)
- **Anonymous**: Limited access for public discovery

## Rate Limiting

- **Anonymous**: 100 requests/hour
- **Authenticated**: 1000 requests/hour  
- **Enterprise**: 10,000 requests/hour

## Error Handling

All errors follow RFC 7807 Problem Details format:

\`\`\`json
{
  "type": "https://e14z.com/errors/not-found",
  "title": "MCP Not Found",
  "status": 404,
  "detail": "The requested MCP server was not found",
  "instance": "/api/mcp/nonexistent-slug",
  "trace_id": "req_123456789"
}
\`\`\`
    `,
    contact: {
      name: 'E14Z Support',
      url: 'https://e14z.com/support',
      email: 'support@e14z.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    },
    termsOfService: 'https://e14z.com/terms'
  },
  servers: [
    {
      url: 'https://www.e14z.com/api',
      description: 'Production API'
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Development API'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for authenticated users'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for programmatic access'
      }
    },
    schemas: {
      MCP: {
        type: 'object',
        required: ['id', 'slug', 'name', 'endpoint', 'category', 'verified'],
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier for the MCP',
            example: 'mcp_123456789'
          },
          slug: {
            type: 'string',
            description: 'URL-friendly identifier',
            example: 'stripe-mcp'
          },
          name: {
            type: 'string',
            description: 'Display name of the MCP',
            example: 'Stripe Payment Processing'
          },
          description: {
            type: 'string',
            description: 'Detailed description of the MCP capabilities',
            example: 'Process payments, manage subscriptions, and handle financial transactions via Stripe API'
          },
          endpoint: {
            type: 'string',
            description: 'Installation endpoint or command',
            example: 'npx @stripe/mcp-server'
          },
          category: {
            type: 'string',
            enum: ['payments', 'databases', 'content-creation', 'ai-tools', 'development-tools', 'cloud-storage', 'communication', 'infrastructure', 'productivity', 'project-management', 'security', 'social-media', 'web-apis', 'finance', 'research', 'iot', 'other'],
            description: 'Primary category of the MCP',
            example: 'payments'
          },
          verified: {
            type: 'boolean',
            description: 'Whether the MCP is officially verified',
            example: true
          },
          health_status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'down', 'unknown'],
            description: 'Current health status of the MCP',
            example: 'healthy'
          },
          rating: {
            type: 'number',
            minimum: 1,
            maximum: 10,
            description: 'Average user rating (1-10)',
            example: 8.5
          },
          tools: {
            type: 'array',
            description: 'Available tools provided by this MCP',
            items: {
              $ref: '#/components/schemas/Tool'
            }
          },
          use_cases: {
            type: 'array',
            description: 'Common use cases for this MCP',
            items: {
              type: 'string'
            },
            example: ['Payment processing', 'Subscription management', 'Invoice generation']
          },
          installation: {
            $ref: '#/components/schemas/Installation'
          },
          quality: {
            $ref: '#/components/schemas/QualityMetrics'
          },
          resources: {
            $ref: '#/components/schemas/Resources'
          }
        }
      },
      Tool: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Tool identifier',
            example: 'create_payment'
          },
          description: {
            type: 'string',
            description: 'Tool description',
            example: 'Create a new payment intent'
          },
          parameters: {
            oneOf: [
              {
                type: 'array',
                items: { type: 'string' },
                description: 'Simple parameter list'
              },
              {
                type: 'object',
                description: 'Detailed parameter schema',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    required: { type: 'boolean' },
                    description: { type: 'string' }
                  }
                }
              }
            ]
          }
        }
      },
      Installation: {
        type: 'object',
        properties: {
          primary_method: {
            $ref: '#/components/schemas/InstallationMethod'
          },
          alternative_methods: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/InstallationMethod'
            }
          },
          auth_method: {
            type: 'string',
            enum: ['none', 'api_key', 'oauth', 'jwt', 'custom'],
            description: 'Required authentication method'
          }
        }
      },
      InstallationMethod: {
        type: 'object',
        required: ['type', 'command'],
        properties: {
          type: {
            type: 'string',
            enum: ['npm', 'pip', 'git', 'docker', 'binary', 'other']
          },
          command: {
            type: 'string',
            description: 'Installation command'
          },
          description: {
            type: 'string',
            description: 'Human-readable description'
          },
          priority: {
            type: 'number',
            description: 'Installation method priority (lower = preferred)'
          }
        }
      },
      QualityMetrics: {
        type: 'object',
        properties: {
          health_status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'down', 'unknown']
          },
          success_rate: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Success rate (0-1)'
          },
          avg_response_time: {
            type: 'number',
            description: 'Average response time in milliseconds'
          },
          last_check: {
            type: 'string',
            format: 'date-time',
            description: 'Last health check timestamp'
          }
        }
      },
      Resources: {
        type: 'object',
        properties: {
          github_url: {
            type: 'string',
            format: 'uri',
            description: 'GitHub repository URL'
          },
          documentation_url: {
            type: 'string',
            format: 'uri',
            description: 'Documentation URL'
          },
          website_url: {
            type: 'string',
            format: 'uri',
            description: 'Official website URL'
          }
        }
      },
      DiscoveryResponse: {
        type: 'object',
        required: ['results', 'total', 'page', 'limit'],
        properties: {
          results: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/MCP'
            }
          },
          total: {
            type: 'integer',
            description: 'Total number of results available'
          },
          page: {
            type: 'integer',
            description: 'Current page number (1-based)'
          },
          limit: {
            type: 'integer',
            description: 'Number of results per page'
          },
          has_more: {
            type: 'boolean',
            description: 'Whether more results are available'
          },
          filters: {
            type: 'object',
            description: 'Applied search filters'
          },
          performance: {
            $ref: '#/components/schemas/SearchPerformance'
          }
        }
      },
      SearchPerformance: {
        type: 'object',
        properties: {
          query_time_ms: {
            type: 'number',
            description: 'Search query execution time'
          },
          total_mcps: {
            type: 'integer',
            description: 'Total MCPs in registry'
          },
          cache_hit: {
            type: 'boolean',
            description: 'Whether result was served from cache'
          }
        }
      },
      Analytics: {
        type: 'object',
        properties: {
          mcp_id: {
            type: 'string',
            description: 'MCP identifier'
          },
          timeframe: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d', '90d'],
            description: 'Analytics timeframe'
          },
          summary: {
            $ref: '#/components/schemas/AnalyticsSummary'
          },
          time_series: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TimeSeriesDataPoint'
            }
          },
          geographic_distribution: {
            type: 'object',
            additionalProperties: {
              type: 'integer'
            }
          },
          user_intelligence: {
            $ref: '#/components/schemas/UserIntelligence'
          }
        }
      },
      AnalyticsSummary: {
        type: 'object',
        properties: {
          total_executions: {
            type: 'integer',
            description: 'Total number of executions'
          },
          unique_users: {
            type: 'integer',
            description: 'Number of unique users'
          },
          success_rate: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Execution success rate'
          },
          avg_execution_time: {
            type: 'number',
            description: 'Average execution time in milliseconds'
          },
          error_rate: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Error rate'
          }
        }
      },
      TimeSeriesDataPoint: {
        type: 'object',
        required: ['timestamp', 'value'],
        properties: {
          timestamp: {
            type: 'string',
            format: 'date-time'
          },
          value: {
            type: 'number'
          },
          metadata: {
            type: 'object',
            additionalProperties: true
          }
        }
      },
      UserIntelligence: {
        type: 'object',
        properties: {
          agent_types: {
            type: 'object',
            additionalProperties: {
              type: 'integer'
            }
          },
          usage_patterns: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          retention_rate: {
            type: 'number',
            minimum: 0,
            maximum: 1
          }
        }
      },
      Review: {
        type: 'object',
        required: ['mcp_id', 'rating', 'success'],
        properties: {
          mcp_id: {
            type: 'string',
            description: 'MCP identifier being reviewed'
          },
          rating: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            description: 'Overall rating (1-10)'
          },
          review_text: {
            type: 'string',
            maxLength: 1000,
            description: 'Optional review text'
          },
          use_case: {
            type: 'string',
            description: 'What the MCP was used for'
          },
          success: {
            type: 'boolean',
            description: 'Whether the MCP worked as expected'
          },
          tasks_completed: {
            type: 'integer',
            minimum: 0,
            description: 'Number of successful tasks'
          },
          tasks_failed: {
            type: 'integer',
            minimum: 0,
            description: 'Number of failed tasks'
          },
          rating_breakdown: {
            $ref: '#/components/schemas/RatingBreakdown'
          },
          use_case_category: {
            type: 'string',
            enum: ['payments', 'databases', 'content-creation', 'ai-tools', 'development-tools', 'cloud-storage', 'communication', 'infrastructure', 'productivity', 'project-management', 'security', 'social-media', 'web-apis', 'finance', 'research', 'iot', 'other']
          }
        }
      },
      RatingBreakdown: {
        type: 'object',
        properties: {
          setup_difficulty: {
            type: 'integer',
            minimum: 1,
            maximum: 3,
            description: '1=failed, 2=difficult, 3=easy'
          },
          documentation_quality: {
            type: 'integer',
            minimum: 1,
            maximum: 3,
            description: '1=poor, 2=adequate, 3=excellent'
          },
          reliability: {
            type: 'integer',
            minimum: 1,
            maximum: 3,
            description: '1=frequent failures, 2=occasional, 3=stable'
          },
          performance: {
            type: 'integer',
            minimum: 1,
            maximum: 3,
            description: '1=slow, 2=acceptable, 3=fast'
          }
        }
      },
      Error: {
        type: 'object',
        required: ['type', 'title', 'status'],
        properties: {
          type: {
            type: 'string',
            format: 'uri',
            description: 'Error type URI'
          },
          title: {
            type: 'string',
            description: 'Human-readable error title'
          },
          status: {
            type: 'integer',
            description: 'HTTP status code'
          },
          detail: {
            type: 'string',
            description: 'Detailed error description'
          },
          instance: {
            type: 'string',
            description: 'Request path that caused the error'
          },
          trace_id: {
            type: 'string',
            description: 'Request trace ID for debugging'
          }
        }
      }
    },
    responses: {
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              type: 'https://e14z.com/errors/not-found',
              title: 'Resource Not Found',
              status: 404,
              detail: 'The requested resource was not found',
              instance: '/api/mcp/nonexistent',
              trace_id: 'req_123456789'
            }
          }
        }
      },
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              type: 'https://e14z.com/errors/unauthorized',
              title: 'Authentication Required',
              status: 401,
              detail: 'Valid authentication credentials are required',
              instance: '/api/analytics/protected-endpoint'
            }
          }
        }
      },
      Forbidden: {
        description: 'Access denied',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      RateLimitExceeded: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              type: 'https://e14z.com/errors/rate-limit',
              title: 'Rate Limit Exceeded',
              status: 429,
              detail: 'Too many requests. Please try again later.',
              instance: '/api/discover'
            }
          }
        }
      },
      ValidationError: {
        description: 'Request validation failed',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/Error' },
                {
                  type: 'object',
                  properties: {
                    validation_errors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          field: { type: 'string' },
                          message: { type: 'string' },
                          code: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Discovery',
      description: 'MCP discovery and search endpoints'
    },
    {
      name: 'MCPs',
      description: 'Individual MCP management and details'
    },
    {
      name: 'Analytics',
      description: 'Usage analytics and performance metrics'
    },
    {
      name: 'Reviews',
      description: 'User reviews and ratings system'
    },
    {
      name: 'Admin',
      description: 'Administrative endpoints (admin access required)'
    },
    {
      name: 'Health',
      description: 'System health and monitoring'
    }
  ]
}

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    './app/api/**/*.ts',
    './lib/**/*.ts',
    './docs/api-examples.md'
  ]
}

export const swaggerSpec = swaggerJsdoc(options)
export default swaggerSpec