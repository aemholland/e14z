export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-6xl">
            E14Z
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            The npm for AI agents. Discover, evaluate, and connect to MCP servers.
          </p>
          
          {/* Search Bar */}
          <div className="mt-10 flex justify-center">
            <div className="w-full max-w-2xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for MCP servers... (e.g., 'invoice processing')"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button className="absolute right-2 top-2 px-4 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Search
                </button>
              </div>
            </div>
          </div>
          
          {/* Quick Categories */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {['Search & Web', 'File Systems', 'Databases', 'Communication', 'AI Models', 'Productivity'].map((category) => (
              <button
                key={category}
                className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-50"
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-gray-900">50+</div>
            <div className="text-sm text-gray-500">MCP Servers</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-gray-900">98.5%</div>
            <div className="text-sm text-gray-500">Operational</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-gray-900">1M+</div>
            <div className="text-sm text-gray-500">API Calls</div>
          </div>
        </div>

        {/* Trending MCPs */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Trending Today</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Placeholder MCP Cards */}
            {[
              { name: 'Brave Search', description: 'Web search using Brave Search API', category: 'Search', status: 'healthy' },
              { name: 'PostgreSQL', description: 'Query PostgreSQL databases', category: 'Database', status: 'healthy' },
              { name: 'GitHub', description: 'Interact with GitHub repositories', category: 'Development', status: 'healthy' },
            ].map((mcp) => (
              <div key={mcp.name} className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{mcp.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{mcp.description}</p>
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-2">
                      {mcp.category}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}