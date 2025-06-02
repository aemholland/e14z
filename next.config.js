/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15+ has App Router enabled by default
  output: 'standalone',
  
  // Instrumentation is enabled by default in Next.js 15
  
  // Exclude server-only packages from client bundle
  serverExternalPackages: [
    'pino',
    'pino-pretty',
    'next-logger',
  ],
  
  // Webpack configuration for better package handling
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude server-only modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig