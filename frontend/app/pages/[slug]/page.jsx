import React from 'react';
import { redirect } from 'next/navigation';
import StoreShell from '../../../components/StoreShell';
import { getApiUrl } from '../../../lib/api';
import { parseMarkdownBlocks, renderInlineMarkdown } from '../../../lib/markdown';

// Server-rendered CMS page: crawlers get the real <title>, meta description,
// and the full article HTML without executing JS — important for pages like
// /pages/ovomatrix that carry SEO weight.

async function fetchPage(slug) {
  try {
    const res = await fetch(getApiUrl(`/api/content-pages/${slug}/`), {
      next: { revalidate: 300 }, // pick up CMS edits within 5 minutes
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) return { title: 'Page not found' };
  return {
    title: page.meta_title || page.title,
    description: page.meta_description || undefined,
    alternates: { canonical: `/pages/${slug}` },
    openGraph: {
      title: page.meta_title || page.title,
      description: page.meta_description || undefined,
      type: 'article',
    },
  };
}

function MarkdownContent({ content }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="prose-content space-y-4 text-[15px] leading-[1.8] text-ink-secondary">
      {blocks.map((b, i) => {
        if (b.type === 'h1') return <h2 key={i} className="text-heading-2">{renderInlineMarkdown(b.text, `h1-${i}`)}</h2>;
        if (b.type === 'h2') return <h3 key={i} className="text-heading-3">{renderInlineMarkdown(b.text, `h2-${i}`)}</h3>;
        if (b.type === 'image' && b.src) return <img key={i} src={b.src} alt={b.alt} className="w-full rounded-md border border-edge object-cover" />;
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

export default async function ContentPageView({ params }) {
  const { slug } = await params;
  // Policy pages live in the CMS as `policy-<slug>` rows but render with the
  // dedicated policy layout at /policies/<slug>.
  if (slug?.startsWith('policy-')) {
    redirect(`/policies/${slug.slice('policy-'.length)}`);
  }
  const page = await fetchPage(slug);

  if (!page) {
    return (
      <StoreShell>
        <div className="mx-auto max-w-3xl p-10 text-center">
          <h1 className="text-heading-2">Page not found</h1>
        </div>
      </StoreShell>
    );
  }
  return (
    <StoreShell>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <h1 className="text-display">{page.title}</h1>
        {page.meta_description && (
          <p className="mt-5 text-[15px] leading-[1.75] text-ink-secondary">{page.meta_description}</p>
        )}
        <div className="mt-8">
          <MarkdownContent content={page.content} />
        </div>
      </article>
    </StoreShell>
  );
}
