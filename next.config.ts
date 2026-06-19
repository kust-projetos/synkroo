import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Externalizar deps com APIs Node (fs/path/stream) — Workers fornece polyfills via nodejs_compat
  serverExternalPackages: ['playwright', 'playwright-core', 'chromium-bidi', 'pg', 'pg-connection-string', 'pgpass'],

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externizar deps com APIs Node — Workers fornece polyfills via nodejs_compat
      config.externals = [
        ...config.externals,
        'playwright',
        'playwright-core',
        'chromium-bidi',
        'pg',
        'pg-connection-string',
        'pgpass',
      ];
    }
    return config;
  },
}

export default nextConfig