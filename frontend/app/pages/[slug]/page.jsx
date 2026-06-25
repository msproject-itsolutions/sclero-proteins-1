'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import StoreShell from '../../../components/StoreShell';
import { getApiUrl } from '../../../lib/api';

// Minimal markdown-ish renderer. Supports # headings, **bold**, *italic*,
// [text](url), and `- list item` lines. Each input line becomes a paragraph
// (or list item). We keep this dependency-free.
function renderMarkdownLine(line) {
  let html = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-purple underline" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

function MarkdownContent({ content }) {
  const lines = (content || '').split(/\r?\n/);
  const blocks = [];
  let listBuffer = [];
  const flushList = () => {
    if (listBuffer.length) {
      blocks.push({ type: 'ul', items: [...listBuffer] });
      listBuffer = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) { flushList(); blocks.push({ type: 'space', key: idx }); return; }
    if (line.startsWith('## ')) { flushList(); blocks.push({ type: 'h2', text: line.slice(3), key: idx }); return; }
    if (line.startsWith('# ')) { flushList(); blocks.push({ type: 'h1', text: line.slice(2), key: idx }); return; }
    if (line.startsWith('- ')) { listBuffer.push(line.slice(2)); return; }
    flushList();
    blocks.push({ type: 'p', text: line, key: idx });
  });
  flushList();

  return (
    <div className="prose-content space-y-4 text-sm leading-relaxed text-brand-navy">
      {blocks.map((b, i) => {
        if (b.type === 'h1') return <h2 key={i} className="text-2xl font-black text-brand-navy" dangerouslySetInnerHTML={{ __html: renderMarkdownLine(b.text) }} />;
        if (b.type === 'h2') return <h3 key={i} className="text-xl font-bold text-brand-navy" dangerouslySetInnerHTML={{ __html: renderMarkdownLine(b.text) }} />;
        if (b.type === 'ul') return (
          <ul key={i} className="list-disc space-y-1 pl-6">
            {b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: renderMarkdownLine(it) }} />)}
          </ul>
        );
        if (b.type === 'space') return null;
        return <p key={i} dangerouslySetInnerHTML={{ __html: renderMarkdownLine(b.text) }} />;
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
