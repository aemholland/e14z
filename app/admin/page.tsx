/**
 * E14Z Admin Dashboard
 * Comprehensive system monitoring and management interface
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  UserGroupIcon, 
  CpuChipIcon, 
  ExclamationTriangleIcon,
  ClockIcon,
  CircleStackIcon,
  CommandLineIcon,
  BellIcon
} from '@heroicons/react/24/outline';

interface SystemStats {
  uptime: string;
  total_requests_24h: number;
  error_rate_24h: number;
  avg_response_time: number;
  active_users: number;
  total_mcps: number;
  pending_reviews: number;
  critical_alerts: number;
}

interface TopMCP {
  id: string;
  name: string;
  slug: string;
  executions_24h: number;
  success_rate: number;
  avg_execution_time: number;
}

export default function AdminDashboard() {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [topMCPs, setTopMCPs] = useState<TopMCP[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, mcpsResponse] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/top-mcps')
      ]);

      const stats = await statsResponse.json();
      const mcps = await mcpsResponse.json();

      setSystemStats(stats);
      setTopMCPs(mcps.mcps || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusColor = (value: number, threshold: number, inverse = false) => {
    const isGood = inverse ? value < threshold : value > threshold;
    return isGood ? 'text-green-600' : 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">E14Z Admin Dashboard</h1>
              <p className="text-sm text-gray-500">System monitoring and management</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Live</span>
              </div>
              <button
                onClick={fetchDashboardData}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-6 mb-8 border-b border-gray-200">
          {[
            { id: 'overview', name: 'Overview', icon: ChartBarIcon },
            { id: 'analytics', name: 'Analytics', icon: CircleStackIcon },
            { id: 'users', name: 'Users', icon: UserGroupIcon },
            { id: 'mcps', name: 'MCPs', icon: CommandLineIcon },
            { id: 'performance', name: 'Performance', icon: CpuChipIcon },
            { id: 'alerts', name: 'Alerts', icon: BellIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg p-6 shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">System Uptime</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {systemStats?.uptime || '99.9%'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Requests (24h)</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatNumber(systemStats?.total_requests_24h || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className={`h-8 w-8 ${getStatusColor(systemStats?.error_rate_24h || 0, 5, true)}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Error Rate (24h)</p>
                    <p className={`text-2xl font-semibold ${getStatusColor(systemStats?.error_rate_24h || 0, 5, true)}`}>
                      {((systemStats?.error_rate_24h || 0) * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CpuChipIcon className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Avg Response Time</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {systemStats?.avg_response_time || 0}ms
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg p-6 shadow">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{formatNumber(systemStats?.active_users || 0)}</p>
                  <p className="text-sm text-gray-500">Active Users</p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{formatNumber(systemStats?.total_mcps || 0)}</p>
                  <p className="text-sm text-gray-500">Total MCPs</p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-600">{systemStats?.pending_reviews || 0}</p>
                  <p className="text-sm text-gray-500">Pending Reviews</p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">{systemStats?.critical_alerts || 0}</p>
                  <p className="text-sm text-gray-500">Critical Alerts</p>
                </div>
              </div>
            </div>

            {/* Top MCPs */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Top MCPs (24h)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        MCP
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Executions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Success Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {topMCPs.map((mcp) => (
                      <tr key={mcp.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{mcp.name}</div>
                            <div className="text-sm text-gray-500">{mcp.slug}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(mcp.executions_24h)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getStatusColor(mcp.success_rate, 0.95)}`}>
                            {(mcp.success_rate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {mcp.avg_execution_time}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder for other tabs */}
        {activeTab !== 'overview' && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-400">
              <CpuChipIcon className="h-16 w-16 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Dashboard
              </h3>
              <p className="text-gray-500">
                This section will contain detailed {activeTab} monitoring and management tools.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}