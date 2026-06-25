import StoreShell from '../../components/StoreShell';
import BlogList from './BlogList';

export const metadata = {
  title: 'Science Library | Sclero Proteins',
  description: 'Read clinical explanations, formulation insights, and transparent supplement education from Sclero Proteins.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Sclero Proteins Science Library',
    description: 'Evidence-led supplement education and formulation insights.',
  },
};

export default function BlogPage() {
  return (
    <StoreShell>
      <main className="container-page py-14">
        <p className="text-xs font-black uppercase tracking-widest text-brand-purple">Science Library</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-navy">Educational Center</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-brand-muted">
          Clinical explanations, formulation insights, and practical supplement guidance.
        </p>
        <div className="mt-10">
          <BlogList />
        </div>
      </main>
    </StoreShell>
  );
}
