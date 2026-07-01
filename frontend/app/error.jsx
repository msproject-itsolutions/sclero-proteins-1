'use client';

import Link from 'next/link';
import StoreShell from '../components/StoreShell';

export default function ErrorPage({ error, reset }) {
  return (
    <StoreShell>
      <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-black uppercase tracking-widest text-brand-purple">Something went wrong</p>
        <h1 className="mt-3 text-3xl font-black text-brand-navy">We could not load this page.</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          Try again, or continue shopping while we sort this out.
        </p>
        {process.env.NODE_ENV !== 'production' && error?.message && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-left text-xs text-red-700">{error.message}</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary px-6 py-3 text-sm">Try again</button>
          <Link href="/products" className="btn-ghost px-6 py-3 text-sm">Shop products</Link>
        </div>
      </main>
    </StoreShell>
  );
}
