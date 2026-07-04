import Link from 'next/link';
import StoreShell from '../components/StoreShell';

export default function NotFound() {
  return (
    <StoreShell>
      <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6 md:py-24 lg:px-8">
        <p className="kicker mb-4">404</p>
        <h1 className="text-display">Page <em className="text-italic-accent">not found</em></h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.75] text-ink-secondary">
          The page you are looking for is not available. Continue shopping or contact our support team.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/products" className="btn-primary px-6 py-3 text-sm">Shop products</Link>
          <Link href="/contact" className="btn-ghost px-6 py-3 text-sm">Contact support</Link>
        </div>
      </main>
    </StoreShell>
  );
}
