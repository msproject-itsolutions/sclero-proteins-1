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
      <div className="border-b border-edge bg-surface">
        <div className="reveal container-page py-12">
          <span className="kicker !text-ink-accent">
            Catalog
          </span>
          <h1 className="mt-3 text-heading-1 brand-heading-gradient">
            All products
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-secondary">
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
