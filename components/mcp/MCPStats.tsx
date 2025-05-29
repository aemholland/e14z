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
    // No fake data - will be populated by E14Z Pulse when implemented
    setLoading(false)
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
      
      <div className="text-center py-8">
        <div className="text-gray-400 mb-3">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h4 className="text-sm font-medium text-gray-700 mb-1">Performance Stats</h4>
        <p className="text-xs text-gray-500 mb-3">Coming with E14Z Pulse</p>
        <div className="space-y-2 text-xs text-gray-400">
          <div>• Real-time latency monitoring</div>
          <div>• Success rate tracking</div>
          <div>• Uptime percentages</div>
          <div>• Usage analytics</div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-400">
          Stats collected by E14Z Pulse monitoring
        </p>
      </div>
    </div>
  )
}