import StoreShell from '../../../components/StoreShell';
import BlogArticle from './BlogArticle';

export const metadata = {
  title: 'Science Article | Sclero Proteins',
  description: 'Read supplement science and formulation insights from Sclero Proteins.',
};

export default function BlogArticlePage({ params }) {
  return (
    <StoreShell>
      <main className="px-4 py-14 sm:px-6 lg:px-8">
        <BlogArticle slug={params.slug} />
      </main>
    </StoreShell>
  );
}
