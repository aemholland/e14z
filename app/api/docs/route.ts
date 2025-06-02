/**
 * API Documentation Route - Swagger UI
 * Serves interactive OpenAPI documentation for the E14Z MCP Registry API
 */

import { NextRequest, NextResponse } from 'next/server'
import { swaggerSpec } from '@/lib/documentation/swagger-config'

/**
 * GET /api/docs - Serve OpenAPI specification as JSON
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    if (format === 'yaml') {
      // Convert to YAML if requested
      const yaml = await import('js-yaml')
      const yamlString = yaml.dump(swaggerSpec)
      
      return new NextResponse(yamlString, {
        headers: {
          'Content-Type': 'application/x-yaml',
          'Content-Disposition': 'attachment; filename="e14z-api.yaml"'
        }
      })
    }

    // Default JSON format
    return NextResponse.json(swaggerSpec, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })

  } catch (error) {
    console.error('Error serving API documentation:', error)
    return NextResponse.json(
      { 
        error: 'Failed to load API documentation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}