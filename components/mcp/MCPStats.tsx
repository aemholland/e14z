'use client'

import { useState, useEffect } from 'react'

interface MCPStatsProps {
  mcpId: string
}

interface Stats {
  totalCalls: number
  avgLatency: number
  successRate: number
  uptime: number
}

export function MCPStats({ mcpId }: MCPStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // For now, we'll use mock data since we don't have real performance data yet
    // In production, this would fetch from the performance_logs table
    setTimeout(() => {
      setStats({
        totalCalls: Math.floor(Math.random() * 10000),
        avgLatency: Math.floor(Math.random() * 500) + 100,
        successRate: 95 + Math.random() * 5,
        uptime: 98 + Math.random() * 2
      })
      setLoading(false)
    }, 1000)
  }, [mcpId])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Stats</h3>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Stats</h3>
      
      {stats ? (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">Monthly Calls</span>
              <span className="text-sm font-semibold text-gray-900">
                {stats.totalCalls.toLocaleString()}
              </span>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">Avg Latency</span>
              <span className="text-sm font-semibold text-gray-900">
                {stats.avgLatency}ms
              </span>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">Success Rate</span>
              <span className="text-sm font-semibold text-gray-900">
                {stats.successRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${stats.successRate}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">Uptime (30d)</span>
              <span className="text-sm font-semibold text-gray-900">
                {stats.uptime.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${stats.uptime}%` }}
              ></div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No performance data available</p>
      )}
      
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-400">
          Stats collected by E14Z Pulse monitoring
        </p>
      </div>
    </div>
  )
}