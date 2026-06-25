import Link from 'next/link';
import StoreShell from '../components/StoreShell';

export default function NotFound() {
  return (
    <StoreShell>
      <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-black uppercase tracking-widest text-brand-purple">404</p>
        <h1 className="mt-3 text-3xl font-black text-brand-navy">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
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
