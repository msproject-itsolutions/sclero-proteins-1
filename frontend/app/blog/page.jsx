import StoreShell from '../../components/StoreShell';
import BlogList from './BlogList';

export const metadata = {
  title: 'Science Library',
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
      <main className="container-page py-16 md:py-24">
        <div className="text-center">
          <p className="kicker mb-4">Science Library</p>
          <h1 className="text-display">Educational Center</h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.75] text-ink-secondary">
            Clinical explanations, formulation insights, and practical supplement guidance.
          </p>
        </div>
        <div className="mt-14">
          <BlogList />
        </div>
      </main>
    </StoreShell>
  );
}
