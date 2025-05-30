import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const {
      session_id,
      mcp_id,
      rating,
      success,
      latency_ms,
      error_count = 0,
      tasks_completed = 0,
      tasks_failed = 0,
      review_text,
      use_case,
      agent_type,
      agent_version
    } = body

    // Generate session_id if not provided (for API compatibility)
    const finalSessionId = session_id || `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!mcp_id || !rating) {
      return NextResponse.json(
        { error: 'Missing required fields: mcp_id, rating' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 10) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 10' },
        { status: 400 }
      )
    }

    // Check if MCP exists
    const { data: mcp, error: mcpError } = await supabase
      .from('mcps')
      .select('id')
      .eq('id', mcp_id)
      .single()

    if (mcpError || !mcp) {
      return NextResponse.json(
        { error: 'Invalid MCP ID' },
        { status: 400 }
      )
    }

    const userAgent = request.headers.get('user-agent') || ''
    const extractedAgentType = agent_type || extractAgentType(userAgent)

    // Insert review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        mcp_id,
        rating,
        review_text,
        agent_type: extractedAgentType,
        agent_version,
        use_case,
        tasks_completed,
        tasks_failed,
        avg_latency_experienced: latency_ms,
        session_id: finalSessionId
      })
      .select()
      .single()

    if (reviewError) {
      console.error('Review insertion error:', reviewError)
      return NextResponse.json(
        { error: 'Failed to save review' },
        { status: 500 }
      )
    }

    // Insert performance log
    if (typeof success === 'boolean') {
      const { error: perfError } = await supabase
        .from('performance_logs')
        .insert({
          mcp_id,
          latency_ms,
          success,
          error_type: success ? null : 'user_reported',
          error_message: success ? null : `${error_count} errors reported`,
          agent_type: extractedAgentType,
          use_case,
          session_id: finalSessionId
        })

      if (perfError) {
        console.error('Performance log error:', perfError)
        // Don't fail the review if performance logging fails
      }
    }

    return NextResponse.json({
      message: 'Review submitted successfully',
      review_id: review.id,
      thanks: 'Thank you for helping improve MCP discovery!'
    })

  } catch (err) {
    console.error('Review API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function extractAgentType(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  
  if (ua.includes('claude')) return 'claude'
  if (ua.includes('gpt') || ua.includes('openai')) return 'openai'
  if (ua.includes('gemini')) return 'gemini'
  if (ua.includes('anthropic')) return 'anthropic'
  if (ua.includes('python')) return 'python-script'
  if (ua.includes('curl')) return 'curl'
  if (ua.includes('postman')) return 'postman'
  if (ua.includes('bot')) return 'bot'
  
  return 'unknown'
}