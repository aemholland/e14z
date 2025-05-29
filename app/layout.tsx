import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'E14Z - AI Tool Discovery',
  description: 'The npm for AI agents. Discover and connect to MCP servers.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold">E14Z</h1>
                <span className="ml-2 text-sm text-gray-500">AI Tool Discovery</span>
              </div>
              <nav className="flex space-x-4">
                <a href="/" className="text-gray-700 hover:text-gray-900">Home</a>
                <a href="/browse" className="text-gray-700 hover:text-gray-900">Browse</a>
                <a href="/submit" className="text-gray-700 hover:text-gray-900">Submit</a>
                <a href="/docs" className="text-gray-700 hover:text-gray-900">Docs</a>
              </nav>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  E14Z - The npm for AI agents
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Discover and connect to MCP servers
                </p>
              </div>
              <div className="flex space-x-4">
                <a href="https://github.com/e14z/e14z" className="text-gray-400 hover:text-gray-500">
                  GitHub
                </a>
                <a href="https://e14z.com" className="text-gray-400 hover:text-gray-500">
                  e14z.com
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}