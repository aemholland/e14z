/**
 * E14Z Analytics Subscription Management API
 * Handles monetization tiers for analytics access
 */

import { NextRequest, NextResponse } from 'next/server';
import { withLogging } from '@/lib/logging/middleware';
import { supabase } from '@/lib/supabase/client';

export interface AnalyticsSubscriptionTier {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  analytics_access_level: 'anonymous' | 'community' | 'verified' | 'enterprise';
  max_mcps: number;
  export_formats: string[];
  real_time_alerts: boolean;
  ai_insights: boolean;
  competitive_intelligence: boolean;
  custom_reports: boolean;
  api_rate_limit: number;
  support_level: string;
}

// Define subscription tiers for analytics monetization
const ANALYTICS_SUBSCRIPTION_TIERS: AnalyticsSubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Basic analytics for community developers',
    price_monthly: 0,
    price_yearly: 0,
    features: [
      'Basic usage metrics',
      'Success rates and execution counts',
      '7-day data retention',
      'Public dashboard view only'
    ],
    analytics_access_level: 'anonymous',
    max_mcps: 3,
    export_formats: [],
    real_time_alerts: false,
    ai_insights: false,
    competitive_intelligence: false,
    custom_reports: false,
    api_rate_limit: 100, // requests per hour
    support_level: 'Community'
  },
  {
    id: 'community',
    name: 'Community',
    description: 'Enhanced analytics for active developers',
    price_monthly: 9,
    price_yearly: 89, // ~17% discount
    features: [
      'All Free features',
      'Time series data and trends',
      'Geographic distribution',
      '30-day data retention',
      'Basic email notifications'
    ],
    analytics_access_level: 'community',
    max_mcps: 10,
    export_formats: ['json'],
    real_time_alerts: false,
    ai_insights: false,
    competitive_intelligence: false,
    custom_reports: false,
    api_rate_limit: 500,
    support_level: 'Email'
  },
  {
    id: 'pro',
    name: 'Professional',
    description: 'Comprehensive analytics for serious developers',
    price_monthly: 29,
    price_yearly: 299, // ~14% discount
    features: [
      'All Community features',
      'User intelligence and behavior analysis',
      'Performance breakdown and optimization tips',
      'Error analysis and debugging insights',
      'Tool usage statistics',
      '90-day data retention',
      'Webhook notifications'
    ],
    analytics_access_level: 'verified',
    max_mcps: 50,
    export_formats: ['json', 'csv'],
    real_time_alerts: true,
    ai_insights: false,
    competitive_intelligence: false,
    custom_reports: true,
    api_rate_limit: 2000,
    support_level: 'Priority Email'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Advanced analytics and business intelligence',
    price_monthly: 99,
    price_yearly: 999, // ~17% discount
    features: [
      'All Professional features',
      'Competitive intelligence and market analysis',
      'AI-powered insights and recommendations',
      'Revenue optimization suggestions',
      'Custom user segments and cohort analysis',
      'Unlimited data retention',
      'Real-time alerts and monitoring',
      'White-label dashboard options',
      'Dedicated account manager'
    ],
    analytics_access_level: 'enterprise',
    max_mcps: 500,
    export_formats: ['json', 'csv', 'excel', 'pdf'],
    real_time_alerts: true,
    ai_insights: true,
    competitive_intelligence: true,
    custom_reports: true,
    api_rate_limit: 10000,
    support_level: 'Phone + Slack'
  }
];

/**
 * GET /api/subscriptions - Get available subscription tiers and current user status
 */
export const GET = withLogging(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const include_current = searchParams.get('include_current') === 'true';
    
    let responseData: any = {
      tiers: ANALYTICS_SUBSCRIPTION_TIERS,
      currency: 'USD',
      billing_cycles: ['monthly', 'yearly'],
      features_comparison: generateFeaturesComparison(),
      generated_at: new Date().toISOString()
    };
    
    // Include current user subscription status if requested
    if (include_current) {
      const authHeader = req.headers.get('authorization');
      const userId = await getUserId(authHeader);
      
      if (userId) {
        const currentSubscription = await getCurrentSubscription(userId);
        responseData.current_subscription = currentSubscription;
        responseData.usage_stats = await getUsageStats(userId);
      }
    }
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Subscriptions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/subscriptions - Create or upgrade subscription
 */
export const POST = withLogging(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { tier_id, billing_cycle = 'monthly', payment_method } = body;
    
    // Get user authentication
    const authHeader = req.headers.get('authorization');
    const userId = await getUserId(authHeader);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Validate tier
    const tier = ANALYTICS_SUBSCRIPTION_TIERS.find(t => t.id === tier_id);
    if (!tier) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      );
    }
    
    // Don't allow "downgrading" to free if user has paid subscription
    if (tier_id === 'free') {
      return NextResponse.json(
        { error: 'Use cancellation endpoint to downgrade to free tier' },
        { status: 400 }
      );
    }
    
    // Check current subscription
    const currentSubscription = await getCurrentSubscription(userId);
    
    // Calculate pricing
    const price = billing_cycle === 'yearly' ? tier.price_yearly : tier.price_monthly;
    
    // In a real implementation, this would integrate with Stripe, Paddle, etc.
    const paymentResult = await processPayment({
      user_id: userId,
      tier_id,
      billing_cycle,
      amount: price,
      payment_method
    });
    
    if (!paymentResult.success) {
      return NextResponse.json(
        { error: 'Payment failed', details: paymentResult.error || 'Payment processing failed' },
        { status: 402 }
      );
    }
    
    // Create or update subscription
    const subscription = await createOrUpdateSubscription({
      user_id: userId,
      tier_id,
      billing_cycle,
      payment_id: paymentResult.payment_id,
      current_subscription: currentSubscription
    });
    
    return NextResponse.json({
      subscription,
      tier,
      message: currentSubscription ? 'Subscription upgraded successfully' : 'Subscription created successfully',
      next_billing_date: subscription.next_billing_date,
      invoice_url: paymentResult.invoice_url
    });
    
  } catch (error) {
    console.error('Subscription creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
});

/**
 * Helper Functions
 */

async function getUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  
  // Implement JWT token verification and user ID extraction
  // For now, return a mock user ID for development
  return 'mock-user-id';
}

async function getCurrentSubscription(userId: string) {
  try {
    const { data: subscription } = await supabase
      .from('analytics_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    return subscription || null;
  } catch (error) {
    return null;
  }
}

async function getUsageStats(userId: string) {
  try {
    // Get user's MCPs
    const { data: userMCPs } = await supabase
      .from('mcps')
      .select('id')
      .or(`created_by.eq.${userId},claimed_by.eq.${userId}`);
    
    if (!userMCPs || userMCPs.length === 0) {
      return {
        mcps_count: 0,
        total_executions: 0,
        api_requests_this_month: 0
      };
    }
    
    const mcpIds = userMCPs.map(mcp => mcp.id);
    
    // Get execution stats for this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const { data: executions } = await supabase
      .from('mcp_execution_analytics')
      .select('execution_id')
      .in('mcp_id', mcpIds)
      .gte('execution_start_time', startOfMonth.toISOString());
    
    return {
      mcps_count: mcpIds.length,
      total_executions: executions?.length || 0,
      api_requests_this_month: 0 // Would track API usage if implemented
    };
  } catch (error) {
    return {
      mcps_count: 0,
      total_executions: 0,
      api_requests_this_month: 0
    };
  }
}

function generateFeaturesComparison() {
  const allFeatures = [
    'Basic usage metrics',
    'Time series data',
    'Geographic distribution', 
    'User intelligence',
    'Performance breakdown',
    'Error analysis',
    'Tool usage statistics',
    'Competitive intelligence',
    'AI-powered insights',
    'Real-time alerts',
    'Custom reports',
    'Export capabilities',
    'Webhook notifications',
    'Priority support'
  ];
  
  return allFeatures.map(feature => {
    const tierSupport = ANALYTICS_SUBSCRIPTION_TIERS.map(tier => {
      const hasFeature = tier.features.some(f => 
        f.toLowerCase().includes(feature.toLowerCase()) ||
        feature.toLowerCase().includes(f.toLowerCase())
      );
      return {
        tier_id: tier.id,
        supported: hasFeature
      };
    });
    
    return {
      feature,
      tiers: tierSupport
    };
  });
}

async function processPayment(paymentData: any): Promise<{
  success: boolean;
  payment_id?: string;
  invoice_url?: string;
  error?: string;
}> {
  try {
    // Mock payment processing - in production, integrate with Stripe/Paddle
    console.log('Processing payment:', paymentData);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock random failure for testing (5% failure rate)
    if (Math.random() < 0.05) {
      return {
        success: false,
        error: 'Payment declined by card issuer'
      };
    }
    
    return {
      success: true,
      payment_id: `pay_${Date.now()}`,
      invoice_url: `https://invoice.example.com/pay_${Date.now()}`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment processing failed'
    };
  }
}

async function createOrUpdateSubscription(data: any) {
  const {
    user_id,
    tier_id,
    billing_cycle,
    payment_id,
    current_subscription
  } = data;
  
  const tier = ANALYTICS_SUBSCRIPTION_TIERS.find(t => t.id === tier_id)!;
  const nextBillingDate = new Date();
  
  if (billing_cycle === 'yearly') {
    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
  } else {
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
  }
  
  const subscriptionData = {
    user_id,
    tier_id,
    tier_name: tier.name,
    billing_cycle,
    status: 'active',
    price: billing_cycle === 'yearly' ? tier.price_yearly : tier.price_monthly,
    next_billing_date: nextBillingDate.toISOString(),
    payment_id,
    features: tier.features,
    analytics_access_level: tier.analytics_access_level,
    api_rate_limit: tier.api_rate_limit,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (current_subscription) {
    // Update existing subscription
    const { data } = await supabase
      .from('analytics_subscriptions')
      .update(subscriptionData)
      .eq('id', current_subscription.id)
      .select()
      .single();
    
    return data;
  } else {
    // Create new subscription
    const { data } = await supabase
      .from('analytics_subscriptions')
      .insert(subscriptionData)
      .select()
      .single();
    
    return data;
  }
}