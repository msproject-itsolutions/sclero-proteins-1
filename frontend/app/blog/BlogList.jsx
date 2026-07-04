'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getApiUrl } from '../../lib/api';

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/blog-posts/'))
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setPosts(list);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-ink-muted">Loading insights...</p>;

  if (posts.length === 0) {
    return (
      <div className="rounded-md border border-edge bg-surface p-8 text-center shadow-card">
        <p className="text-sm font-semibold text-ink-primary">No articles are published yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {posts.map((post) => (
        <article key={post.slug} className="reveal flex flex-col overflow-hidden rounded-md border border-edge bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-edge-strong hover:shadow-elevated">
          {post.cover_image_url && (
            <img src={post.cover_image_url} alt={post.title} className="h-44 w-full object-cover" loading="lazy" />
          )}
          <div className="flex flex-1 flex-col justify-between p-5">
            <div>
              <p className="kicker !text-ink-accent">{post.author}</p>
              <h2 className="mt-2 font-display text-lg font-semibold text-ink-primary">{post.title}</h2>
              <p className="mt-2 line-clamp-3 text-xs leading-6 text-ink-secondary">{post.meta_description || post.content}</p>
            </div>
            <Link href={`/blog/${post.slug}`} className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-ink-accent hover:underline">
              Read article <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
