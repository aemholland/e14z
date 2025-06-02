/**
 * E14Z My MCPs API - Get user's published MCPs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verify GitHub token and get user info
 */
async function verifyGitHubToken(token: string) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'e14z-api/1.0'
      }
    });

    if (!response.ok) {
      throw new Error('Invalid GitHub token');
    }

    return await response.json();
  } catch (error) {
    throw new Error('GitHub authentication failed');
  }
}

/**
 * GET /api/my-mcps - Get user's published MCPs
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('token ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(6);
    const githubUser = await verifyGitHubToken(token);

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('github_id', githubUser.id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's MCPs
    const { data: mcps, error: mcpsError } = await supabase
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
        verified,
        source_type,
        health_status,
        rating,
        created_at,
        updated_at,
        tools,
        tags,
        use_cases,
        github_url,
        documentation_url,
        website_url
      `)
      .eq('claimed_by', user.id)
      .order('created_at', { ascending: false });

    if (mcpsError) {
      return NextResponse.json(
        { error: `Failed to get MCPs: ${mcpsError.message}` },
        { status: 500 }
      );
    }

    // Get review stats for each MCP
    const mcpIds = mcps?.map(mcp => mcp.id) || [];
    let reviewStats: Record<string, { total: number; average_rating: number; success_rate: number; successful: number }> = {};

    if (mcpIds.length > 0) {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('mcp_id, rating, success')
        .in('mcp_id', mcpIds);

      if (reviews) {
        reviewStats = reviews.reduce((acc: Record<string, { total: number; average_rating: number; success_rate: number; successful: number }>, review: any) => {
          if (!acc[review.mcp_id]) {
            acc[review.mcp_id] = {
              total: 0,
              average_rating: 0,
              success_rate: 0,
              successful: 0
            };
          }
          
          acc[review.mcp_id].total++;
          acc[review.mcp_id].average_rating += review.rating || 0;
          if (review.success) {
            acc[review.mcp_id].successful++;
          }
          
          return acc;
        }, {});

        // Calculate averages
        Object.keys(reviewStats).forEach(mcpId => {
          const stats = reviewStats[mcpId];
          stats.average_rating = stats.total > 0 ? stats.average_rating / stats.total : 0;
          stats.success_rate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;
        });
      }
    }

    // Enhance MCPs with review data
    const enhancedMCPs = mcps?.map(mcp => ({
      ...mcp,
      reviews: reviewStats[mcp.id] || {
        total: 0,
        average_rating: 0,
        success_rate: 0,
        successful: 0
      }
    })) || [];

    return NextResponse.json({
      mcps: enhancedMCPs,
      user: {
        username: user.username,
        name: user.name,
        avatar_url: user.avatar_url,
        publishing_tier: user.publishing_tier,
        mcps_published: user.mcps_published,
        mcps_claimed: user.mcps_claimed
      }
    });

  } catch (error: any) {
    console.error('My MCPs error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get MCPs' },
      { status: 500 }
    );
  }
}