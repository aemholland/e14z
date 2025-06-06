/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel deployment optimization
  output: process.env.VERCEL ? undefined : 'standalone',
  
  // Performance optimizations  
  compress: true,
  
  // Image optimization for Vercel
  images: {
    domains: ['githubusercontent.com', 'gravatar.com', 'avatars.githubusercontent.com'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Server external packages (moved from experimental)
  serverExternalPackages: [
    'pino',
    'pino-pretty',
    'next-logger',
  ],
  
  // Experimental features for better performance
  experimental: {
    // Enable modern bundling
    esmExternals: true,
    // Enable optimistic client cache
    optimisticClientCache: true,
  },
  
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
        ],
      },
    ];
  },
  
  // Redirects for clean URLs
  async redirects() {
    return [
      {
        source: '/mcp/:slug',
        destination: '/mcp/:slug',
        permanent: true,
      },
    ];
  },
  
  // Webpack configuration optimized for Vercel
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimize bundle for serverless
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: require.resolve('buffer'),
      };
      
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }
    
    // Optimize for production builds
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
    }
    
    return config;
  },
  
  // Environment variables configuration
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_REGION: process.env.VERCEL_REGION,
  },
  
  // PoweredByHeader disabled for security
  poweredByHeader: false,
  
  
  // Generate ETags for caching
  generateEtags: true,
  
  // Page extensions for better organization
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  
  // TypeScript configuration
  typescript: {
    // Dangerously allow production builds to successfully complete even if your project has TypeScript errors
    ignoreBuildErrors: false,
  },
  
  // ESLint configuration
  eslint: {
    // Warning: This allows production builds to successfully complete even if your project has ESLint errors
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig