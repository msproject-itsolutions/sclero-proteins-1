import React from 'react';
import { getApiUrl } from '../../../lib/api';
import ProductDetailClient from './ProductDetailClient';

export async function generateMetadata({ params }) {
  const { sku } = await params;
  try {
    const res = await fetch(getApiUrl(`/api/products/${sku}/`));
    if (!res.ok) return { title: 'Product Not Found | Sclero Proteins' };
    const product = await res.json();
    return {
      title: `${product.name} | Sclero Proteins`,
      description: product.description?.substring(0, 160) || `${product.name} from Sclero Proteins.`,
      alternates: {
        canonical: `/products/${sku}`,
      },
      openGraph: {
        title: `${product.name} | Sclero Proteins`,
        description: product.description,
        images: product.media?.[0]?.file_url ? [product.media[0].file_url] : [],
      },
    };
  } catch (e) {
    return { title: 'Product | Sclero Proteins' };
  }
}

export default async function ProductDetailPage({ params }) {
  const { sku } = await params;
  return <ProductDetailClient sku={sku} />;
}
