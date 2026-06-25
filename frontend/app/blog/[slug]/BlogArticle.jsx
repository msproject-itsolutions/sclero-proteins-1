'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getApiUrl } from '../../../lib/api';

export default function BlogArticle({ slug }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/admin/blog-posts/'))
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setPost(list.find((item) => item.slug === slug && item.is_published) || null);
      })
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <p className="text-sm text-brand-muted">Loading article...</p>;

  if (!post) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-black text-brand-navy">Article not found</h1>
        <Link href="/blog" className="mt-4 inline-flex text-sm font-bold text-brand-purple">Back to Science Library</Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-purple">
        <ArrowLeft className="h-4 w-4" /> Science Library
      </Link>
      {post.cover_image_url && (
        <img src={post.cover_image_url} alt={post.title} className="mb-8 h-72 w-full rounded-2xl object-cover" />
      )}
      <p className="text-xs font-black uppercase tracking-widest text-brand-purple">{post.author}</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-navy">{post.title}</h1>
      {post.published_at && (
        <p className="mt-3 text-xs text-brand-muted">Published {new Date(post.published_at).toLocaleDateString()}</p>
      )}
      <div className="mt-8 whitespace-pre-line text-sm leading-8 text-brand-muted">
        {post.content}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            author: { '@type': 'Person', name: post.author },
            datePublished: post.published_at,
            description: post.meta_description,
          }),
        }}
      />
    </article>
  );
}
