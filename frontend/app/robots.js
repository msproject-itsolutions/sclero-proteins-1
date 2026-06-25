export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://scleroproteins.co.uk';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/account', '/api'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
