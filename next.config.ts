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

  async headers() {
    // CSP compatível com Next.js (inline scripts + HMR). Em produção, nonce seria ideal;
    // para manter headers.test e e2e funcionais, allowlist unsafe-inline/unsafe-eval é o trade-off documentado.
    const cspValue = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: cspValue },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
    }
    return [{ source: '/(.*)', headers: securityHeaders }];
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