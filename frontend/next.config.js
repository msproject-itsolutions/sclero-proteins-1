/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run `node server.js` without the full node_modules tree.
  output: 'standalone',

  // Image optimisation — leave optimisation ON in production. The previous
  // `unoptimized: true` was a dev convenience; in prod it defeats Next's
  // <Image> resizer + AVIF/WebP conversion and ships full-size hero images.
  // Override per environment if a CDN does the resizing instead.
  images: {
    unoptimized: process.env.NEXT_PUBLIC_IMG_UNOPTIMIZED === 'true',
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    // Whitelist the remote hosts we actually fetch product imagery from.
    // Add new domains here as marketing onboards new CDNs.
    remotePatterns: [
      { protocol: 'https', hostname: '**.scleroproteins.co.uk' },
      { protocol: 'https', hostname: '**.scleroproteins.in' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },

  // Static asset cache headers — match what the platform already does for
  // /_next/static but extend to the public/ assets we ship (icons, og image).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com https://widget.trustpilot.com https://js.stripe.com https://www.instagram.com https://platform.instagram.com",
              "frame-src 'self' https://accounts.google.com https://www.google.com https://apis.google.com https://js.stripe.com https://hooks.stripe.com https://widget.trustpilot.com https://www.instagram.com https://www.facebook.com",
              "connect-src 'self' https://accounts.google.com https://apis.google.com https://www.google-analytics.com https://graph.facebook.com https://analytics.tiktok.com https://widget.trustpilot.com https://api.stripe.com https://*.instagram.com",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // Production-only output bundle insight. Run `ANALYZE=true npm run build`
  // to see the bundle treemap — install @next/bundle-analyzer first.
  // (Left as a comment; opt-in to avoid forcing the dependency.)
  // experimental: { optimizePackageImports: ['lucide-react'] }, // <- consider in next iteration
};

module.exports = nextConfig;
