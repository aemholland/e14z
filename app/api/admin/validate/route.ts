import { NextRequest, NextResponse } from 'next/server'
import { 
  validateAndAddMCP, 
  validateMCPBatch,
  updateVerificationStatuses,
  auditExistingMCPs 
} from '@/lib/mcp/validator'

/**
 * Admin API for MCP validation and management
 * POST /api/admin/validate - Validate and add new MCP
 * PUT /api/admin/validate - Update verification statuses
 * GET /api/admin/validate - Audit existing MCPs
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data, options = {} } = body

    switch (action) {
      case 'validate_single':
        if (!data.name || !data.github_url) {
          return NextResponse.json(
            { error: 'Name and github_url are required' },
            { status: 400 }
          )
        }

        const result = await validateAndAddMCP(data, options)
        return NextResponse.json(result)

      case 'validate_batch':
        if (!Array.isArray(data) || data.length === 0) {
          return NextResponse.json(
            { error: 'Data must be a non-empty array of MCP candidates' },
            { status: 400 }
          )
        }

        const batchResult = await validateMCPBatch(data, options)
        return NextResponse.json(batchResult)

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: validate_single, validate_batch' },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error('Validation API error:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await updateVerificationStatuses()
    return NextResponse.json({
      success: true,
      message: `Updated ${result.updated} MCPs`,
      updated: result.updated,
      errors: result.errors
    })
  } catch (err) {
    console.error('Verification update error:', err)
    return NextResponse.json(
      { error: 'Failed to update verification statuses', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'audit'

    switch (action) {
      case 'audit':
        const auditResult = await auditExistingMCPs()
        return NextResponse.json({
          success: true,
          potentialDuplicates: auditResult.potentialDuplicates,
          verificationUpdates: auditResult.verificationUpdates,
          summary: {
            duplicates_found: auditResult.potentialDuplicates.length,
            verification_updates_needed: auditResult.verificationUpdates.length
          }
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: audit' },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error('Audit API error:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}