/**
 * E14Z Publishing API - MCP publication and management
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
    // Update user info
    const { data: updatedUser } = await supabase
      .from('users')
      .update({
        username: githubUser.login,
        name: githubUser.name,
        email: githubUser.email,
        avatar_url: githubUser.avatar_url,
        profile_data: githubUser,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingUser.id)
      .select()
      .single();

    return updatedUser;
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
 * Generate unique slug from name
 */
async function generateSlug(name: string, existingSlug?: string) {
  let baseSlug = name.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (existingSlug && existingSlug === baseSlug) {
    return baseSlug; // Keep existing slug if unchanged
  }

  // Check if slug exists
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from('mcps')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!data) {
      return slug; // Slug is available
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * POST /api/publish - Publish new MCP
 */
async function publishHandler(request: NextRequest) {
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

    if (!user.can_publish) {
      return NextResponse.json(
        { error: 'Publishing not allowed for this user' },
        { status: 403 }
      );
    }

    const mcpData = await request.json();

    // Generate slug
    const slug = await generateSlug(mcpData.name);

    // Check for duplicate name
    const { data: existingMCP } = await supabase
      .from('mcps')
      .select('id')
      .eq('name', mcpData.name)
      .single();

    if (existingMCP) {
      return NextResponse.json(
        { error: 'MCP with this name already exists' },
        { status: 409 }
      );
    }

    // Insert MCP
    const { data: newMCP, error } = await supabase
      .from('mcps')
      .insert({
        slug,
        name: mcpData.name,
        description: mcpData.description,
        endpoint: mcpData.endpoint,
        clean_command: mcpData.clean_command,
        category: mcpData.category,
        auth_method: mcpData.auth_method || 'none',
        connection_type: mcpData.connection_type || 'stdio',
        protocol_version: mcpData.protocol_version || '2024-11-05',
        
        tags: mcpData.tags || [],
        use_cases: mcpData.use_cases || [],
        tools: mcpData.tools ? JSON.parse(mcpData.tools) : null,
        
        github_url: mcpData.github_url,
        documentation_url: mcpData.documentation_url,
        website_url: mcpData.website_url,
        
        author: mcpData.author || user.name || user.username,
        company: mcpData.company,
        license: mcpData.license || 'MIT',
        pricing_model: mcpData.pricing_model || 'free',
        pricing_details: mcpData.pricing_details || {},
        
        source_type: 'published',
        claimed_by: user.id,
        claim_verification: 'published',
        verified: false,
        auto_discovered: false,
        
        health_status: 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to publish MCP: ${error.message}` },
        { status: 500 }
      );
    }

    // Update user stats
    await supabase
      .from('users')
      .update({
        mcps_published: user.mcps_published + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      mcp: newMCP,
      message: `MCP "${mcpData.name}" published successfully! It will be reviewed for verification.`
    });

  } catch (error: any) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to publish MCP' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/publish/[slug] - Update existing MCP
 */
async function updatePublishHandler(request: NextRequest) {
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

    const url = new URL(request.url);
    const slug = url.pathname.split('/').pop();

    if (!slug) {
      return NextResponse.json(
        { error: 'MCP slug required' },
        { status: 400 }
      );
    }

    // Get existing MCP
    const { data: existingMCP, error: fetchError } = await supabase
      .from('mcps')
      .select('*')
      .eq('slug', slug)
      .single();

    if (fetchError || !existingMCP) {
      return NextResponse.json(
        { error: 'MCP not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingMCP.claimed_by !== user.id) {
      return NextResponse.json(
        { error: 'You can only update MCPs you own' },
        { status: 403 }
      );
    }

    const updateData = await request.json();

    // Update MCP
    const { data: updatedMCP, error: updateError } = await supabase
      .from('mcps')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
        // Reset verification if significant changes
        verified: updateData.endpoint !== existingMCP.endpoint ? false : existingMCP.verified
      })
      .eq('slug', slug)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update MCP: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mcp: updatedMCP,
      message: 'MCP updated successfully'
    });

  } catch (error: any) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update MCP' },
      { status: 500 }
    );
  }
}

// Export the handlers wrapped with APM middleware
export const POST = withAPM(publishHandler, {
  trackQueries: true,
  trackCache: false,
  sampleRate: 1.0
});

export const PUT = withAPM(updatePublishHandler, {
  trackQueries: true,
  trackCache: false,
  sampleRate: 1.0
});