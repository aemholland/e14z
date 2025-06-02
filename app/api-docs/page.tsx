/**
 * Interactive API Documentation Page - Swagger UI
 * Comprehensive documentation for E14Z MCP Registry API
 */

'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading API Documentation...</p>
      </div>
    </div>
  )
})

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // CSS will be handled via the style tag at the bottom
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">
              E14Z MCP Registry API Documentation
            </h1>
            <p className="text-xl text-blue-100 mb-6">
              Comprehensive API for discovering, managing, and analyzing Model Context Protocol servers
            </p>
            <div className="flex justify-center space-x-4 flex-wrap gap-2">
              <a
                href="/api/docs?format=json"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                📄 Download OpenAPI JSON
              </a>
              <a
                href="/api/docs?format=yaml"
                className="inline-flex items-center px-4 py-2 border border-white text-sm font-medium rounded-md text-white hover:bg-blue-700 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                📋 Download OpenAPI YAML
              </a>
              <a
                href="https://github.com/aemholland/e14z"
                className="inline-flex items-center px-4 py-2 border border-white text-sm font-medium rounded-md text-white hover:bg-blue-700 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                🔗 GitHub Repository
              </a>
              <a
                href="/docs"
                className="inline-flex items-center px-4 py-2 border border-white text-sm font-medium rounded-md text-white hover:bg-blue-700 transition-colors"
              >
                📖 Getting Started Guide
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            <a href="#tag/Discovery" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
              🔍 Discovery API
            </a>
            <a href="#tag/MCPs" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
              🔧 MCP Management
            </a>
            <a href="#tag/Analytics" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
              📊 Analytics API
            </a>
            <a href="#tag/Reviews" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
              ⭐ Reviews API
            </a>
            <a href="#tag/Admin" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
              👨‍💼 Admin API
            </a>
            <a href="#tag/Health" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
              🏥 Health Monitoring
            </a>
          </div>
        </div>
      </div>

      {/* API Statistics */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">20+</div>
              <div className="text-sm text-gray-600">API Endpoints</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">50+</div>
              <div className="text-sm text-gray-600">MCP Servers</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">99.9%</div>
              <div className="text-sm text-gray-600">Uptime</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">v4.1</div>
              <div className="text-sm text-gray-600">API Version</div>
            </div>
          </div>
        </div>
      </div>

      {/* Swagger UI Container */}
      <div ref={containerRef} className="swagger-ui-container bg-white">
        <SwaggerUI
          url="/api/docs"
          docExpansion="list"
          defaultModelsExpandDepth={2}
          defaultModelExpandDepth={2}
          displayOperationId={false}
          displayRequestDuration={true}
          filter={true}
          showExtensions={true}
          showCommonExtensions={true}
          tryItOutEnabled={true}
          requestInterceptor={(request) => {
            // Add any custom headers or auth here
            console.log('API Request:', request)
            return request
          }}
          responseInterceptor={(response) => {
            console.log('API Response:', response)
            return response
          }}
          onComplete={() => {
            console.log('Swagger UI loaded successfully')
          }}
          plugins={[]}
          layout="StandaloneLayout"
          deepLinking={true}
          persistAuthorization={true}
          supportedSubmitMethods={['get', 'post', 'put', 'delete', 'patch']}
        />
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Need Help?</h3>
            <div className="flex justify-center space-x-6 text-sm flex-wrap gap-4">
              <a
                href="https://e14z.com/support"
                className="text-gray-300 hover:text-white transition-colors"
              >
                💬 Support
              </a>
              <a
                href="https://github.com/aemholland/e14z/issues"
                className="text-gray-300 hover:text-white transition-colors"
              >
                🐛 Report Bug
              </a>
              <a
                href="https://e14z.com/examples"
                className="text-gray-300 hover:text-white transition-colors"
              >
                📖 Code Examples
              </a>
              <a
                href="https://discord.gg/e14z"
                className="text-gray-300 hover:text-white transition-colors"
              >
                💬 Discord Community
              </a>
            </div>
            <div className="mt-6 text-xs text-gray-400">
              © 2025 E14Z. All rights reserved. | API v4.1.1 | OpenAPI 3.0.3
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .swagger-ui-container {
          background: white;
          min-height: 60vh;
        }
        
        .swagger-ui .topbar {
          display: none;
        }
        
        .swagger-ui .info {
          margin: 20px 0;
          padding: 0 20px;
        }
        
        .swagger-ui .scheme-container {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin: 20px;
        }
        
        .swagger-ui .btn.authorize {
          background-color: #2563eb;
          border-color: #2563eb;
          color: white;
        }
        
        .swagger-ui .btn.authorize:hover {
          background-color: #1d4ed8;
          border-color: #1d4ed8;
        }
        
        .swagger-ui .opblock .opblock-summary-method {
          font-weight: 700;
          border-radius: 4px;
        }
        
        .swagger-ui .opblock.opblock-get .opblock-summary {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }
        
        .swagger-ui .opblock.opblock-post .opblock-summary {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
        }
        
        .swagger-ui .opblock.opblock-put .opblock-summary {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }
        
        .swagger-ui .opblock.opblock-delete .opblock-summary {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .swagger-ui .opblock-tag {
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 20px;
          padding-bottom: 10px;
        }

        .swagger-ui .opblock-tag-section h3 {
          color: #1f2937;
          font-size: 1.5rem;
          margin-bottom: 10px;
        }

        .swagger-ui .parameter__name {
          font-weight: 600;
          color: #374151;
        }

        .swagger-ui .parameter__type {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .swagger-ui .response-col_status {
          font-weight: 600;
        }

        .swagger-ui table thead tr th,
        .swagger-ui table thead tr td {
          background: #f9fafb;
          color: #374151;
          font-weight: 600;
        }

        .swagger-ui .model-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }

        .swagger-ui .model-title {
          color: #1f2937;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .swagger-ui-container {
            padding: 0 10px;
          }
          
          .swagger-ui .info {
            padding: 0 10px;
          }
          
          .swagger-ui .scheme-container {
            margin: 10px;
            padding: 10px;
          }
        }
      `}</style>
    </div>
  )
}