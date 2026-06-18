import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Externalizar deps incompatíveis com Workers runtime (playwright é native module)
  serverExternalPackages: ['playwright', 'playwright-core', 'chromium-bidi'],

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
      // Externizar playwright e deps de browser para evitar falha de bundle no Workers
      config.externals = [
        ...config.externals,
        'playwright',
        'playwright-core',
        'chromium-bidi',
      ];
    }
    return config;
  },
}

export default nextConfig