import StoreShell from '../../../components/StoreShell';
import BlogArticle from './BlogArticle';

export const metadata = {
  title: 'Science Article',
  description: 'Read supplement science and formulation insights from Sclero Proteins.',
};

export default async function BlogArticlePage({ params }) {
  const { slug } = await params;
  return (
    <StoreShell>
      <main className="px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <BlogArticle slug={slug} />
      </main>
    </StoreShell>
  );
}
