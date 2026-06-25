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
