import { NextRequest, NextResponse } from 'next/server'
import { getMCPBySlug } from '@/lib/search/engine'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      )
    }

    const mcp = await getMCPBySlug(slug)

    if (!mcp) {
      return NextResponse.json(
        { error: `MCP not found: ${slug}` },
        { status: 404 }
      )
    }

    return NextResponse.json({ mcp })
  } catch (error) {
    console.error('Error fetching MCP details:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch MCP details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}