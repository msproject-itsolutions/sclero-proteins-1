import './globals.css';
import { DM_Sans } from 'next/font/google';
import Providers from '../components/Providers';
import { jsonLdScriptProps } from '../lib/jsonLd';
import { getApiUrl } from '../lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-dm-sans',
  display: 'swap',
});

async function fetchSiteSetting(key) {
  try {
    const res = await fetch(getApiUrl(`/api/site-settings/${key}/`), {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data?.value && typeof data.value === 'object' ? data.value : {};
  } catch (e) {
    return {};
  }
}

const fetchSeoSettings = () => fetchSiteSetting('SEO_SETTINGS');

async function fetchRegions() {
  try {
    const response = await fetch(getApiUrl('/api/regions/'), { next: { revalidate: 3600 } });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : data.results || [];
  } catch {
    return [];
  }
}

const regionUrl = (domain) => {
  if (!domain) return null;
  return domain.startsWith('http') ? domain : `https://${domain}`;
};

export async function generateMetadata() {
  const [seoSettings, companyInfo, regions] = await Promise.all([
    fetchSeoSettings(), fetchSiteSetting('COMPANY_INFO'), fetchRegions(),
  ]);
  const companyName = companyInfo.name || 'Online store';
  const defaultTitle = seoSettings.metaTitle || companyName;
  const defaultDescription = seoSettings.metaDescription || undefined;
  const languages = Object.fromEntries(regions
    .map((region) => [`en-${String(region.code).toLowerCase()}`, regionUrl(region.domain)])
    .filter(([, url]) => url));

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: defaultTitle,
      template: `%s | ${companyName}`,
    },
    description: defaultDescription,
    keywords: seoSettings.metaKeywords || undefined,
    verification: seoSettings.googleSiteVerification
      ? { google: seoSettings.googleSiteVerification }
      : undefined,
    alternates: {
      languages,
    },
    openGraph: {
      siteName: companyName,
      type: 'website',
      locale: 'en_GB',
      url: SITE_URL,
      title: defaultTitle,
      description: defaultDescription,
      images: [seoSettings.ogImage || '/logo-full.png'],
    },
    twitter: {
      card: 'summary_large_image',
      site: seoSettings.twitterHandle || undefined,
      title: defaultTitle,
      description: defaultDescription,
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
        { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      ],
      apple: [{ url: '/icon-180.png', sizes: '180x180' }],
    },
  };
}

export default async function RootLayout({ children }) {
  const [seoSettings, companyInfo, socialLinks] = await Promise.all([
    fetchSeoSettings(), fetchSiteSetting('COMPANY_INFO'), fetchSiteSetting('SOCIAL_LINKS'),
  ]);
  let customSchema = null;
  if (seoSettings.schemaMarkup) {
    try {
      customSchema = JSON.parse(seoSettings.schemaMarkup);
    } catch (e) {
      customSchema = null;
    }
  }

  const companyName = companyInfo.name || 'Online store';
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: companyName,
    url: SITE_URL,
    logo: `${SITE_URL.replace(/\/$/, '')}/logo-full.png`,
    address: companyInfo.address ? { '@type': 'PostalAddress', streetAddress: companyInfo.address } : undefined,
    contactPoint: (companyInfo.support || companyInfo.email || companyInfo.phone) ? {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      email: companyInfo.support || companyInfo.email || undefined,
      telephone: companyInfo.phone || undefined,
    } : undefined,
    sameAs: Object.values(socialLinks).filter((value) => typeof value === 'string' && value.startsWith('http')),
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: companyName,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL.replace(/\/$/, '')}/products?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="en" className={dmSans.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScriptProps(organizationSchema)}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScriptProps(websiteSchema)}
        />
        {customSchema ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLdScriptProps(customSchema)}
          />
        ) : null}
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
