'use client';

import React, { useState } from 'react';
import StoreShell from '../../components/StoreShell';
import ProductCatalog from '../../components/ProductCatalog';

export default function ProductsPage() {
  const [cartOpenTrigger, setCartOpenTrigger] = useState(null);

  return (
    <StoreShell cartOpenSignal={cartOpenTrigger}>
      <title>All products | Sclero Proteins</title>
      <meta
        name="description"
        content="Browse the full Sclero Proteins catalog — BJC® bone & joint care, collagen, and active nutrition with regional pricing for the UK and India."
      />
      <meta property="og:title" content="All products | Sclero Proteins" />
      <meta property="og:type" content="website" />
      <div className="border-b border-slate-200/80 bg-white">
        <div className="container-page py-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-purple">
            Catalog
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">
            All products
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-brand-muted">
            BJC® bone & joint care, proteins, and active nutrition — priced and
            fulfilled for your region with transparent labelling.
          </p>
        </div>
      </div>

      <ProductCatalog
        title=""
        subtitle=""
        filterable
        onOpenCart={() => setCartOpenTrigger(Date.now())}
        className="pt-8"
      />
    </StoreShell>
  );
}
