import './globals.css';
import { Inter, Cormorant_Garamond } from 'next/font/google';
import Providers from '../components/Providers';
import { jsonLdScriptProps } from '../lib/jsonLd';

// Self-host both fonts via next/font — Next downloads them at build time,
// inlines the font-face declarations, and serves them from same-origin.
// `display: 'swap'` shows the fallback immediately so text never invisibly
// blocks the first paint. `preload` is true by default.
// Cormorant Garamond is the display serif (headings, editorial accents);
// Inter carries all UI and body copy.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL('https://scleroproteins.co.uk'),
  title: {
    default: 'Sclero Proteins — clinically-formulated wellness',
    template: '%s | Sclero Proteins',
  },
  description:
    'BJC® Bone & Joint Care and premium active nutrition from Sclero Proteins. Lab-certified, label-transparent supplements for the UK and India.',
  keywords:
    'BJC bone joint care, sclero proteins, collagen, bone health, joint support, active nutrition, scleroproteins.co.uk',
  alternates: {
    languages: {
      'en-in': 'https://scleroproteins.in',
      'en-gb': 'https://scleroproteins.co.uk',
    },
  },
  openGraph: {
    siteName: 'Sclero Proteins',
    type: 'website',
    locale: 'en_GB',
    url: 'https://scleroproteins.co.uk',
    images: ['/og-default.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@scleroproteins',
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

// Organization JSON-LD — emitted once at the document root for site-wide knowledge
// graph recognition. Unverified social profiles are intentionally omitted.
const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Sclero Proteins Ltd',
  url: 'https://scleroproteins.co.uk',
  logo: 'https://scleroproteins.co.uk/logo-full.png',
  address: { '@type': 'PostalAddress', addressCountry: 'GB' },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'Customer Service',
    email: 'support@scleroproteins.co.uk',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScriptProps(ORG_SCHEMA)}
        />
      </head>
      <body>
        {/* Skip-to-content link — keyboard users land here first, can jump
            past Navbar + Promo banner straight to the main page region. */}
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
