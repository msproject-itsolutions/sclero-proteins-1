'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import StoreShell from '../../../components/StoreShell';
import { getApiUrl } from '../../../lib/api';
import { parseMarkdownBlocks, renderInlineMarkdown } from '../../../lib/markdown';

function MarkdownContent({ content }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="prose-content space-y-4 text-sm leading-relaxed text-brand-navy">
      {blocks.map((b, i) => {
        if (b.type === 'h1') return <h2 key={i} className="text-2xl font-black text-brand-navy">{renderInlineMarkdown(b.text, `h1-${i}`)}</h2>;
        if (b.type === 'h2') return <h3 key={i} className="text-xl font-bold text-brand-navy">{renderInlineMarkdown(b.text, `h2-${i}`)}</h3>;
        if (b.type === 'image' && b.src) return <img key={i} src={b.src} alt={b.alt} className="w-full rounded-2xl border border-slate-200 object-cover" />;
        if (b.type === 'ul') return (
          <ul key={i} className="list-disc space-y-1 pl-6">
            {b.items.map((it, j) => <li key={j}>{renderInlineMarkdown(it, `li-${i}-${j}`)}</li>)}
          </ul>
        );
        if (b.type === 'space') return null;
        return <p key={i}>{renderInlineMarkdown(b.text, `p-${i}`)}</p>;
      })}
    </div>
  );
}

export default function ContentPageView() {
  const params = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.slug) return;
    setLoading(true);
    fetch(getApiUrl(`/api/content-pages/${params.slug}/`))
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setPage)
      .catch(() => setPage(null))
      .finally(() => setLoading(false));
  }, [params?.slug]);

  if (loading) {
    return <StoreShell><div className="mx-auto max-w-3xl p-10 text-sm text-brand-muted">Loading…</div></StoreShell>;
  }
  if (!page) {
    return (
      <StoreShell>
        <div className="mx-auto max-w-3xl p-10 text-center">
          <h1 className="text-xl font-black text-brand-navy">Page not found</h1>
        </div>
      </StoreShell>
    );
  }
  return (
    <StoreShell>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">{page.title}</h1>
        {page.meta_description && (
          <p className="mt-3 text-sm text-brand-muted">{page.meta_description}</p>
        )}
        <div className="mt-8">
          <MarkdownContent content={page.content} />
        </div>
      </article>
    </StoreShell>
  );
}
