'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getApiUrl } from '../../../lib/api';
import { jsonLdScriptProps } from '../../../lib/jsonLd';

export default function BlogArticle({ slug }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl(`/api/blog-posts/${slug}/`))
      .then((res) => res.json())
      .then((data) => setPost(data?.slug ? data : null))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <p className="text-sm text-ink-muted">Loading article...</p>;

  if (!post) {
    return (
      <div className="rounded-md border border-edge bg-surface p-8 text-center shadow-card">
        <h1 className="text-heading-3">Article not found</h1>
        <Link href="/blog" className="mt-4 inline-flex text-sm font-medium text-ink-accent">Back to Science Library</Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/blog" className="kicker mb-8 inline-flex items-center gap-2 !text-ink-accent">
        <ArrowLeft className="h-4 w-4" /> Science Library
      </Link>
      {post.cover_image_url && (
        <img src={post.cover_image_url} alt={post.title} className="mb-8 h-72 w-full rounded-md object-cover" />
      )}
      <p className="kicker !text-ink-accent">{post.author}</p>
      <h1 className="text-heading-1 mt-3">{post.title}</h1>
      {post.published_at && (
        <p className="mt-3 text-xs text-ink-subtle">Published {new Date(post.published_at).toLocaleDateString()}</p>
      )}
      <div className="mt-8 whitespace-pre-line text-[15px] leading-[1.8] text-ink-secondary">
        {post.content}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScriptProps({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          author: { '@type': 'Person', name: post.author },
          datePublished: post.published_at,
          description: post.meta_description,
        })}
      />
    </article>
  );
}
