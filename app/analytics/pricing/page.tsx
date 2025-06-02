/**
 * E14Z Analytics Pricing Page
 * Subscription tiers for MCP developers to access detailed usage analytics
 */

'use client';

import { useState, useEffect } from 'react';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  analytics_access_level: string;
  max_mcps: number;
  export_formats: string[];
  real_time_alerts: boolean;
  ai_insights: boolean;
  competitive_intelligence: boolean;
  custom_reports: boolean;
  api_rate_limit: number;
  support_level: string;
  popular?: boolean;
}

export default function AnalyticsPricingPage() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);

  useEffect(() => {
    fetchPricingData();
  }, []);

  const fetchPricingData = async () => {
    try {
      const response = await fetch('/api/subscriptions?include_current=true');
      const data = await response.json();
      
      // Mark Pro tier as popular
      const tiersWithPopular = data.tiers.map((tier: SubscriptionTier) => ({
        ...tier,
        popular: tier.id === 'pro'
      }));
      
      setTiers(tiersWithPopular);
      setCurrentSubscription(data.current_subscription);
    } catch (error) {
      console.error('Failed to fetch pricing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierId: string) => {
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_JWT_TOKEN' // Replace with actual auth
        },
        body: JSON.stringify({
          tier_id: tierId,
          billing_cycle: isYearly ? 'yearly' : 'monthly'
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        alert('Subscription created successfully!');
        fetchPricingData(); // Refresh data
      } else {
        alert(`Subscription failed: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to create subscription');
    }
  };

  const formatPrice = (tier: SubscriptionTier) => {
    const price = isYearly ? tier.price_yearly : tier.price_monthly;
    if (price === 0) return 'Free';
    
    const monthlyPrice = isYearly ? Math.round(price / 12) : price;
    return `$${monthlyPrice}/mo`;
  };

  const getYearlySavings = (tier: SubscriptionTier) => {
    if (tier.price_yearly === 0) return null;
    const monthlyTotal = tier.price_monthly * 12;
    const savings = monthlyTotal - tier.price_yearly;
    const percentage = Math.round((savings / monthlyTotal) * 100);
    return `Save ${percentage}%`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            MCP Analytics
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get detailed insights into how developers use your MCPs. 
            Make data-driven decisions to improve adoption and performance.
          </p>
          
          {/* Free notice */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6 max-w-2xl mx-auto">
            <p className="text-green-800 font-medium">
              🎉 All analytics features are currently <strong>FREE and unlimited</strong>!
            </p>
            <p className="text-green-600 text-sm mt-1">
              No rate limits, no restrictions. Help us improve by using the platform.
            </p>
          </div>
          
          {/* Future pricing note */}
          <div className="mt-6">
            <p className="text-sm text-gray-500">
              Future pricing tiers are shown below for reference. 
              <br />
              All features remain free during our beta period.
            </p>
          </div>
        </div>

        {/* Current subscription banner */}
        {currentSubscription && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="text-center">
              <p className="text-blue-800">
                You're currently on the <strong>{currentSubscription.tier_name}</strong> plan
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Next billing: {new Date(currentSubscription.next_billing_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-lg ${
                tier.popular
                  ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
                  : 'border-gray-200'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 text-sm font-medium rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{tier.description}</p>
                
                <div className="mt-6">
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatPrice(tier)}
                    </span>
                    {tier.price_monthly > 0 && !isYearly && (
                      <span className="text-sm text-gray-500 ml-1">/month</span>
                    )}
                    {tier.price_monthly > 0 && isYearly && (
                      <span className="text-sm text-gray-500 ml-1">/month, billed yearly</span>
                    )}
                  </div>
                  {isYearly && getYearlySavings(tier) && (
                    <p className="text-sm text-green-600 mt-1">{getYearlySavings(tier)}</p>
                  )}
                </div>

                <div className="w-full mt-6 py-2 px-4 rounded-lg font-medium text-center bg-green-100 text-green-800 border border-green-200">
                  ✅ Free During Beta
                </div>

                <div className="mt-6 space-y-3">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900 mb-2">Features:</p>
                    <ul className="space-y-1">
                      {tier.features.slice(0, 4).map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <CheckIcon className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                          <span className="text-gray-600">{feature}</span>
                        </li>
                      ))}
                      {tier.features.length > 4 && (
                        <li className="text-gray-500 text-xs">
                          +{tier.features.length - 4} more features
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Up to {tier.max_mcps} MCPs</p>
                    <p>{tier.api_rate_limit.toLocaleString()} API requests/hour</p>
                    <p>{tier.support_level} support</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Feature comparison */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Compare Features
          </h2>
          
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Feature
                  </th>
                  {tiers.map((tier) => (
                    <th key={tier.id} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[
                  { feature: 'Basic Usage Metrics', key: 'basic' },
                  { feature: 'Time Series Data', key: 'timeseries' },
                  { feature: 'Geographic Distribution', key: 'geo' },
                  { feature: 'User Intelligence', key: 'users' },
                  { feature: 'Performance Analysis', key: 'performance' },
                  { feature: 'Error Analysis', key: 'errors' },
                  { feature: 'Real-time Alerts', key: 'alerts' },
                  { feature: 'AI Insights', key: 'ai' },
                  { feature: 'Competitive Intelligence', key: 'competitive' },
                  { feature: 'Export Capabilities', key: 'export' }
                ].map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.feature}
                    </td>
                    {tiers.map((tier) => (
                      <td key={tier.id} className="px-6 py-4 whitespace-nowrap text-center">
                        {getFeatureSupport(tier, item.key) ? (
                          <CheckIcon className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <XMarkIcon className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                What data do you collect about my MCP usage?
              </h3>
              <p className="text-gray-600">
                We collect anonymized usage data including execution frequency, performance metrics, 
                geographic distribution of users, and error rates. No personal user data or MCP content is stored.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I cancel or change my plan anytime?
              </h3>
              <p className="text-gray-600">
                Yes, you can upgrade, downgrade, or cancel your subscription at any time. 
                Changes take effect at the next billing cycle.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-2">
                Do you offer custom enterprise plans?
              </h3>
              <p className="text-gray-600">
                Yes! Contact us for custom analytics solutions, white-label dashboards, 
                and dedicated support for large-scale MCP deployments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getFeatureSupport(tier: SubscriptionTier, featureKey: string): boolean {
  const featureMap: Record<string, (tier: SubscriptionTier) => boolean> = {
    basic: () => true,
    timeseries: (t) => ['community', 'pro', 'enterprise'].includes(t.id),
    geo: (t) => ['community', 'pro', 'enterprise'].includes(t.id),
    users: (t) => ['pro', 'enterprise'].includes(t.id),
    performance: (t) => ['pro', 'enterprise'].includes(t.id),
    errors: (t) => ['pro', 'enterprise'].includes(t.id),
    alerts: (t) => t.real_time_alerts,
    ai: (t) => t.ai_insights,
    competitive: (t) => t.competitive_intelligence,
    export: (t) => t.export_formats.length > 1
  };
  
  const checkFunction = featureMap[featureKey];
  return checkFunction ? checkFunction(tier) : false;
}