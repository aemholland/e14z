/**
 * E14Z Claimable MCPs API - Get MCPs available for claiming
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/claimable - Get MCPs available for claiming
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const category = url.searchParams.get('category');
    
    // Build query for wrapped MCPs without owners
    let query = supabase
      .from('mcps')
      .select(`
        id,
        slug,
        name,
        description,
        endpoint,
        clean_command,
        category,
        auth_method,
        github_url,
        documentation_url,
        website_url,
        author,
        company,
        tools,
        use_cases,
        tags,
        health_status,
        rating,
        created_at,
        updated_at
      `)
      .eq('source_type', 'wrapped')
      .is('claimed_by', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply category filter if specified
    if (category) {
      query = query.eq('category', category);
    }

    const { data: mcps, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: `Failed to get claimable MCPs: ${error.message}` },
        { status: 500 }
      );
    }

    // Get claim counts for each MCP
    const mcpIds = mcps?.map(mcp => mcp.id) || [];
    let claimCounts: Record<string, { total: number; pending: number }> = {};

    if (mcpIds.length > 0) {
      const { data: claims } = await supabase
        .from('mcp_claims')
        .select('mcp_id, status')
        .in('mcp_id', mcpIds);

      if (claims) {
        claimCounts = claims.reduce((acc: Record<string, { total: number; pending: number }>, claim: any) => {
          if (!acc[claim.mcp_id]) {
            acc[claim.mcp_id] = { total: 0, pending: 0 };
          }
          acc[claim.mcp_id].total++;
          if (claim.status === 'pending') {
            acc[claim.mcp_id].pending++;
          }
          return acc;
        }, {});
      }
    }

    // Enhance MCPs with claim data
    const enhancedMCPs = mcps?.map(mcp => ({
      ...mcp,
      claims: claimCounts[mcp.id] || { total: 0, pending: 0 },
      claimable: true
    })) || [];

    return NextResponse.json({
      mcps: enhancedMCPs,
      total: enhancedMCPs.length,
      metadata: {
        limit,
        category: category || 'all',
        filters_applied: {
          source_type: 'wrapped',
          claimed_by: null
        }
      }
    });

  } catch (error: any) {
    console.error('Claimable MCPs error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get claimable MCPs' },
      { status: 500 }
    );
  }
}