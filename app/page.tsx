/**
 * E14Z MCP Registry - Redirect to GitHub
 */

'use client'

import { useEffect } from 'react'

export default function HomePage() {
  useEffect(() => {
    // Redirect to GitHub repository
    window.location.href = 'https://github.com/aemholland/e14z'
  }, [])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">E14Z MCP Registry</h1>
        <p className="text-xl text-gray-600 mb-8">Redirecting to GitHub...</p>
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-4">
          If you are not redirected, <a href="https://github.com/aemholland/e14z" className="text-blue-600 underline">click here</a>
        </p>
      </div>
    </div>
  )
}