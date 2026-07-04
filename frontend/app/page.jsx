import React from 'react';
import { getApiUrl } from '../lib/api';
import HomePageClient from './HomePageClient';

export const metadata = {
  title: 'Home',
  description: 'Sclero Proteins — clinically-formulated bone, joint, and active-nutrition supplements. Lab-certified, label-transparent, shipped across the UK and India.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Sclero Proteins — clinically-formulated wellness',
    description: 'Sclero Proteins — clinically-formulated bone, joint, and active-nutrition supplements.',
    url: 'https://scleroproteins.co.uk',
    type: 'website',
  },
};

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
  const blogs = await fetchBlogs();

  return <HomePageClient initialBlogs={blogs} />;
}
