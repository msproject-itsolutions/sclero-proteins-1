'use client';

import Link from 'next/link';
import StoreShell from '../components/StoreShell';

export default function ErrorPage({ error, reset }) {
  return (
    <StoreShell>
      <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6 md:py-24 lg:px-8">
        <p className="kicker mb-4">Something went wrong</p>
        <h1 className="text-display">We could not load this page.</h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.75] text-ink-secondary">
          Try again, or continue shopping while we sort this out.
        </p>
        {process.env.NODE_ENV !== 'production' && error?.message && (
          <p className="mt-4 rounded-sm bg-red-50 p-3 text-left text-xs text-red-700">{error.message}</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary px-6 py-3 text-sm">Try again</button>
          <Link href="/products" className="btn-ghost px-6 py-3 text-sm">Shop products</Link>
        </div>
      </main>
    </StoreShell>
  );
}
