import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateCartItem, removeFromCart, addToCart } from '../store/cartSlice';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { getApiUrl } from '../lib/api';

export default function CartDrawer({ onClose, onOpenCheckout }) {
  const dispatch = useDispatch();
  const { currentRegion, currencySymbol, taxName, taxRate, taxMode } = useSelector((state) => state.region);
  const { items } = useSelector((state) => state.cart);
  const cartError = useSelector((state) => state.cart.error);

  const [crossSells, setCrossSells] = useState([]);

  useEffect(() => {
    if (!currentRegion) return;
    fetch(getApiUrl(`/api/products/?region=${currentRegion}`))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const cartProductIds = new Set(items.map((item) => item.product.id));
          const available = data.filter((product) => !cartProductIds.has(product.id) && product.stock_available > 0);
          setCrossSells(available.slice(0, 2));
        }
      })
      .catch(() => {});
  }, [currentRegion, items]);

  const unitPrice = (product) => {
    const value = product.promotional_price ? parseFloat(product.promotional_price) : parseFloat(product.price);
    return Number.isFinite(value) ? value : 0;
  };

  const itemUnitPrice = (item) => {
    const variant = item.variant_sku
      ? item.product.variants?.find((candidate) => candidate.sku === item.variant_sku)
      : null;
    const value = variant?.price ?? (
      item.product.promotional_price || item.product.price
    );
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const subtotal = items.reduce((acc, item) => acc + itemUnitPrice(item) * item.quantity, 0);
  const rateFactor = (taxRate || 0) / 100;
  const taxInclusive = taxMode !== 'exclusive';
  const taxAmount = taxInclusive
    ? subtotal - (rateFactor ? subtotal / (1 + rateFactor) : subtotal)
    : subtotal * rateFactor;
  const total = taxInclusive ? subtotal : subtotal + taxAmount;

  const handleQtyChange = (item, newQty) => {
    if (newQty < 1) return;
    dispatch(updateCartItem({
      region: currentRegion,
      cart_item_id: item.id,
      quantity: newQty,
    }));
  };

  const handleRemove = (item) => {
    dispatch(removeFromCart({
      region: currentRegion,
      cart_item_id: item.id,
    }));
  };

  const handleQuickAdd = (product) => {
    dispatch(
      addToCart({
        region: currentRegion,
        product_id: product.id,
        quantity: 1,
      })
    );
  };

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-surface-overlay backdrop-blur-sm">
      <button type="button" aria-label="Close cart" className="absolute inset-0 cursor-default" onClick={onClose} />

      <aside className="relative flex h-dvh w-full max-w-md flex-col border-l border-edge bg-surface shadow-overlay">
        <div className="flex items-center justify-between border-b border-edge px-5 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-ink-accent">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-luxe text-ink-muted">Your cart</p>
              <h2 className="font-display text-[26px] leading-none text-ink-primary">Ready when you are</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-surface-muted text-ink-secondary transition-colors hover:border-edge-strong hover:text-ink-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 md:px-6">
          <div className="rounded-[20px] border border-edge bg-brand-bg px-4 py-3 text-xs font-medium text-ink-secondary">
            Shopping region: <span className="text-ink-primary">{currentRegion} ({currencySymbol})</span>
          </div>

          {cartError && (
            <p className="rounded-[20px] border border-brand-danger/20 bg-brand-danger/5 p-4 text-sm leading-[1.7] text-ink-danger">
              {cartError}
            </p>
          )}

          {items.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-[28px] border border-edge bg-brand-bg text-center">
              <ShoppingBag className="h-12 w-12 text-edge-strong" />
              <p className="text-sm font-medium text-ink-primary">Your cart is empty.</p>
              <p className="max-w-[220px] text-xs leading-[1.7] text-ink-muted">Add a product to see your order summary and checkout options.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const product = item.product;
                const price = itemUnitPrice(item);
                return (
                  <div key={item.id} className="rounded-[24px] border border-edge bg-brand-bg p-4">
                    <div className="flex gap-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-edge bg-surface-muted">
                        {product.thumbnail && (
                          <img src={product.thumbnail} alt={product.name} className="h-full w-full object-cover" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-medium leading-[1.5] text-ink-primary">{product.name}</h4>
                            {item.variant_name && (
                              <p className="mt-1 text-xs text-ink-muted">{item.variant_name}</p>
                            )}
                            <p className="mt-1 text-sm font-semibold text-ink-primary">{currencySymbol}{price.toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => handleRemove(item)}
                            aria-label={`Remove ${product.name}${item.variant_name ? ` ${item.variant_name}` : ''} from cart`}
                            className="shrink-0 rounded-full border border-edge bg-surface p-2 text-ink-muted transition-colors hover:border-edge-strong hover:text-ink-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-full border border-edge bg-surface">
                            <button
                              onClick={() => handleQtyChange(item, item.quantity - 1)}
                              aria-label={`Decrease quantity for ${product.name}`}
                              className="flex h-9 w-9 items-center justify-center text-ink-muted transition-colors hover:text-ink-primary"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[2.25rem] text-center text-sm font-medium text-ink-primary">{item.quantity}</span>
                            <button
                              onClick={() => handleQtyChange(item, item.quantity + 1)}
                              aria-label={`Increase quantity for ${product.name}`}
                              className="flex h-9 w-9 items-center justify-center text-ink-muted transition-colors hover:text-ink-primary"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-ink-muted">Line total: <span className="font-medium text-ink-primary">{currencySymbol}{(price * item.quantity).toFixed(2)}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {items.length > 0 && crossSells.length > 0 && (
            <div className="rounded-[24px] border border-edge bg-brand-bg p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-luxe text-ink-muted">Frequently bought together</h3>
              <div className="mt-4 space-y-3">
                {crossSells.map((product) => {
                  const price = unitPrice(product);
                  return (
                    <div key={product.id} className="flex items-center gap-3 rounded-[18px] border border-edge bg-surface p-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[14px] border border-edge bg-surface-muted">
                        {product.thumbnail && <img src={product.thumbnail} alt={product.name} className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-primary">{product.name}</p>
                        <p className="mt-1 text-xs font-medium text-ink-accent">{currencySymbol}{price.toFixed(2)}</p>
                      </div>
                      <button onClick={() => handleQuickAdd(product)} className="btn-primary rounded-full px-4 py-2 text-xs">
                        Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-edge bg-surface px-5 py-5 md:px-6">
            <div className="mt-4 space-y-2 rounded-[24px] border border-edge bg-brand-bg p-4 text-sm text-ink-secondary">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-ink-primary">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{taxInclusive ? `Incl. ${taxName} (${taxRate}%)` : `Estimated ${taxName} (${taxRate}%)`}</span>
                <span className="font-medium text-ink-primary">{currencySymbol}{taxAmount.toFixed(2)}</span>
              </div>
              <div className="mt-3 flex items-end justify-between border-t border-edge pt-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Order total</p>
                  <p className="mt-1 text-xs text-ink-muted">Shipping calculated at checkout.</p>
                </div>
                <span className="font-display text-[24px] text-ink-primary">{currencySymbol}{total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                onOpenCheckout();
                onClose();
              }}
              className="btn-primary mt-4 w-full gap-2 rounded-full py-3.5 text-sm"
            >
              <span>Proceed to checkout</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
