/**
 * E14Z Claiming API - Allow developers to claim wrapped MCPs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAPM } from '@/lib/observability/apm-middleware';

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
 * Get or create user in database
 */
async function getOrCreateUser(githubUser: any) {
  // First try to get existing user
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('github_id', githubUser.id)
    .single();

  if (existingUser) {
    return existingUser;
  }

  // Create new user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      github_id: githubUser.id,
      username: githubUser.login,
      name: githubUser.name,
      email: githubUser.email,
      avatar_url: githubUser.avatar_url,
      profile_data: githubUser,
      can_publish: true,
      publishing_tier: 'community'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return newUser;
}

/**
 * POST /api/claim - Submit claim for MCP
 */
async function claimHandler(request: NextRequest) {
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
    const user = await getOrCreateUser(githubUser);

    const claimData = await request.json();
    const { mcp_slug, verification_method, verification_data, contact_email, additional_info } = claimData;

    if (!mcp_slug) {
      return NextResponse.json(
        { error: 'MCP slug is required' },
        { status: 400 }
      );
    }

    // Get the MCP
    const { data: mcp, error: mcpError } = await supabase
      .from('mcps')
      .select('*')
      .eq('slug', mcp_slug)
      .single();

    if (mcpError || !mcp) {
      return NextResponse.json(
        { error: 'MCP not found' },
        { status: 404 }
      );
    }

    // Check if MCP is claimable
    if (mcp.source_type !== 'wrapped') {
      return NextResponse.json(
        { error: 'Only wrapped MCPs can be claimed' },
        { status: 400 }
      );
    }

    if (mcp.claimed_by) {
      return NextResponse.json(
        { error: 'MCP has already been claimed' },
        { status: 409 }
      );
    }

    // Determine claim status based on verification
    let claimStatus = 'pending';
    let claimVerification = 'manual_review';

    if (verification_data?.verified) {
      // Auto-approve for verified GitHub/npm ownership
      if (verification_method === 'github' && verification_data.method === 'owner') {
        claimStatus = 'approved';
        claimVerification = 'github_owner';
      } else if (verification_method === 'npm' && verification_data.method === 'npm_maintainer') {
        claimStatus = 'approved';
        claimVerification = 'npm_maintainer';
      } else {
        claimVerification = `${verification_method}_verified`;
      }
    }

    // Create claim record
    const { data: claim, error: claimError } = await supabase
      .from('mcp_claims')
      .insert({
        mcp_id: mcp.id,
        user_id: user.id,
        verification_method,
        verification_data,
        contact_email: contact_email || user.email,
        additional_info,
        status: claimStatus,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (claimError) {
      return NextResponse.json(
        { error: `Failed to submit claim: ${claimError.message}` },
        { status: 500 }
      );
    }

    // If auto-approved, update MCP immediately
    if (claimStatus === 'approved') {
      const { error: updateError } = await supabase
        .from('mcps')
        .update({
          claimed_by: user.id,
          claim_verification: claimVerification,
          source_type: 'claimed',
          updated_at: new Date().toISOString()
        })
        .eq('id', mcp.id);

      if (updateError) {
        console.error('Failed to update MCP after auto-approval:', updateError);
      } else {
        // Update user stats
        await supabase
          .from('users')
          .update({
            mcps_claimed: user.mcps_claimed + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
    }

    return NextResponse.json({
      success: true,
      claim,
      message: claimStatus === 'approved' 
        ? `✅ Claim approved! You now own MCP "${mcp.name}".`
        : `📝 Claim submitted for review. You'll be notified when it's processed.`,
      status: claimStatus
    });

  } catch (error: any) {
    console.error('Claim error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit claim' },
      { status: 500 }
    );
  }
}

// Export the handler wrapped with APM middleware
export const POST = withAPM(claimHandler, {
  trackQueries: true,
  trackCache: false,
  sampleRate: 1.0
});