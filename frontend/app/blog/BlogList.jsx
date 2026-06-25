'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getApiUrl } from '../../lib/api';

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/admin/blog-posts/'))
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setPosts(list.filter((post) => post.is_published));
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-brand-muted">Loading insights...</p>;

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-brand-navy">No articles are published yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {posts.map((post) => (
        <article key={post.slug} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {post.cover_image_url && (
            <img src={post.cover_image_url} alt={post.title} className="h-44 w-full object-cover" loading="lazy" />
          )}
          <div className="flex flex-1 flex-col justify-between p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">{post.author}</p>
              <h2 className="mt-2 text-base font-black text-brand-navy">{post.title}</h2>
              <p className="mt-2 line-clamp-3 text-xs leading-6 text-brand-muted">{post.meta_description || post.content}</p>
            </div>
            <Link href={`/blog/${post.slug}`} className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-brand-purple hover:underline">
              Read article <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
