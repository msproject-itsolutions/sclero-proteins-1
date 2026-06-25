const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://scleroproteins.co.uk';
// Server-side fetch: prefer the in-cluster backend URL, then any explicit public
// API URL (dev), then localhost.
const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

async function fetchPublishedPages() {
  try {
    const res = await fetch(`${API_URL}/api/content-pages/published-slugs/`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/api/products/?region=UK`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.results || []);
    return list.filter((p) => p && p.sku);
  } catch {
    return [];
  }
}

export default async function sitemap() {
  const routes = [
    '',
    '/products',
    '/bundles',
    '/bulk',
    '/about',
    '/contact',
    '/blog',
    '/policies/privacy',
    '/policies/terms',
    '/policies/shipping',
    '/policies/refund',
    '/policies/cookie',
    '/policies/accessibility',
  ];

  const base = routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/products' ? 'daily' : 'monthly',
    priority: route === '' ? 1 : route === '/products' ? 0.9 : 0.6,
  }));

  // Dynamic entries — fetched in parallel. If the backend is unreachable at
  // build time, each helper returns [] so the sitemap still ships static routes.
  const [pages, products] = await Promise.all([
    fetchPublishedPages(),
    fetchProducts(),
  ]);

  const pageEntries = pages.map((p) => ({
    url: `${BASE_URL}/pages/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  const productEntries = products.map((p) => ({
    url: `${BASE_URL}/products/${p.sku}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...base, ...productEntries, ...pageEntries];
}
