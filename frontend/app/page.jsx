import React from 'react';
import { getApiUrl } from '../lib/api';
import HomePageClient from './HomePageClient';
import { normalizeHomepageSettings } from '../lib/homepageContent';

async function fetchHomepageSettings() {
  try {
    const res = await fetch(getApiUrl('/api/site-settings/HOMEPAGE_SETTINGS/'), {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return normalizeHomepageSettings();
    const data = await res.json();
    return normalizeHomepageSettings(data?.value);
  } catch (e) {
    return normalizeHomepageSettings();
  }
}

export async function generateMetadata() {
  const homepageSettings = await fetchHomepageSettings();
  const seo = homepageSettings?.seo || {};
  const title = seo.metaTitle || 'Premium Collagen, Joint Support & Wellness Supplements';
  const description = seo.metaDescription || 'Shop Sclero Proteins for premium collagen, bone and joint support, and science-led wellness supplements.';
  const keywords = seo.keywords || 'premium collagen supplements, joint support supplements, bone health supplements, Sclero Proteins';

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title,
      description,
      url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      type: 'website',
    },
  };
}

async function fetchBlogs() {
  try {
    const res = await fetch(getApiUrl('/api/blog-posts/'), {
      next: { revalidate: 3600 } // cache for 1 hour
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.results || []);
    return list.slice(0, 3);
  } catch (e) {
    return [];
  }
}

export default async function HomePage() {
  const [blogs, homepageSettings] = await Promise.all([
    fetchBlogs(),
    fetchHomepageSettings(),
  ]);

  return <HomePageClient initialBlogs={blogs} initialHomepageSettings={homepageSettings} />;
}
