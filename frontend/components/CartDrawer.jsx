import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateCartItem, removeFromCart, addToCart } from '../store/cartSlice';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Percent, Sparkles } from 'lucide-react';
import { getApiUrl } from '../lib/api';

export default function CartDrawer({ onClose, onOpenCheckout }) {
  const dispatch = useDispatch();
  const { currentRegion, currencySymbol, taxName, taxRate, taxMode, session_id } = useSelector((state) => state.region);
  const { items, isLoading } = useSelector((state) => state.cart);
  const cartError = useSelector((state) => state.cart.error);

  // Promo code states
  const [promoInput, setPromoInput] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [appliedPromo, setAppliedPromo] = useState('');
  const [promoError, setPromoError] = useState('');

  // Cross-sell products list
  const [crossSells, setCrossSells] = useState([]);

  // Fetch some products for cross-sell
  useEffect(() => {
    if (!currentRegion) return;
    fetch(getApiUrl(`/api/products/?region=${currentRegion}`))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Filter out products already in cart
          const cartProductIds = new Set(items.map((it) => it.product.id));
          const available = data.filter((p) => !cartProductIds.has(p.id) && p.stock_available > 0);
          setCrossSells(available.slice(0, 2));
        }
      })
      .catch(() => {});
  }, [currentRegion, items]);

  // NaN-safe unit price (a product with no price for the region returns null).
  const unitPrice = (p) => {
    const v = p.promotional_price ? parseFloat(p.promotional_price) : parseFloat(p.price);
    return Number.isFinite(v) ? v : 0;
  };

  const subtotal = items.reduce((acc, item) => acc + unitPrice(item.product) * item.quantity, 0);

  // Regional shipping thresholds
  const shippingThreshold = currentRegion === 'IN' ? 3000 : 50;
  const progressPercent = subtotal > 0 ? Math.min(100, Math.round((subtotal / shippingThreshold) * 100)) : 0;
  const diffToFree = Math.max(0, shippingThreshold - subtotal);

  // Apply discount
  const discountAmount = subtotal * (discountPercent / 100);
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

  // Tax respects the store mode: inclusive => already inside the price (don't add
  // it to the total); exclusive => add it on top. Mirrors checkout.
  const rateFactor = (taxRate || 0) / 100;
  const taxInclusive = taxMode !== 'exclusive';
  const taxAmount = taxInclusive
    ? subtotalAfterDiscount - (rateFactor ? subtotalAfterDiscount / (1 + rateFactor) : subtotalAfterDiscount)
    : subtotalAfterDiscount * rateFactor;
  const total = taxInclusive ? subtotalAfterDiscount : subtotalAfterDiscount + taxAmount;

  const handleQtyChange = (product_id, newQty) => {
    if (newQty < 1) return;
    dispatch(updateCartItem({ session_id, region: currentRegion, product_id, quantity: newQty }));
  };

  const handleRemove = (product_id) => {
    dispatch(removeFromCart({ session_id, region: currentRegion, product_id }));
  };

  const handleApplyPromo = (e) => {
    e.preventDefault();
    setPromoError('');
    const code = promoInput.trim().toUpperCase();
    if (code === 'SCLERO10' || code === 'WELCOME10') {
      setDiscountPercent(10);
      setAppliedPromo(code);
      setPromoInput('');
    } else {
      setPromoError('Invalid discount code');
    }
  };

  const handleQuickAdd = (product) => {
    dispatch(
      addToCart({
        session_id,
        region: currentRegion,
        product_id: product.id,
        quantity: 1,
      })
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-navy/20 backdrop-blur-sm">
      <div className="w-full max-w-md bg-brand-bg border-l border-slate-200 h-full flex flex-col justify-between p-6 shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-brand-purple" />
            <h2 className="text-base font-black text-brand-navy">Your Cart</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-brand-text hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          
          {/* Shipping Progress Bar */}
          {items.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-brand-navy">
                {diffToFree > 0 ? (
                  <span>
                    Add <span className="text-brand-purple font-black">{currencySymbol}{diffToFree.toFixed(2)}</span> more for free shipping!
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-brand-success font-black">
                    <Sparkles className="h-3.5 w-3.5" />
                    You qualify for FREE shipping!
                  </span>
                )}
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-gradient transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          <div className="bg-brand-purple/5 border border-brand-purple/10 rounded-xl p-3 text-[10px] text-brand-purple font-semibold">
            🛍️ Shopping Region: <span className="underline uppercase">{currentRegion} ({currencySymbol})</span>
          </div>

          {cartError && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
              {cartError}
            </p>
          )}

          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-brand-muted gap-2">
              <ShoppingBag className="h-12 w-12 text-slate-200" />
              <p className="text-xs">Your cart is empty.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const p = item.product;
                const price = unitPrice(p);
                return (
                  <div key={item.id} className="flex gap-4 bg-white border border-slate-200/60 p-3 rounded-2xl items-center shadow-xs">
                    <div className="h-16 w-16 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                      {p.thumbnail && <img src={p.thumbnail} alt={p.name} className="h-full w-full object-cover" />}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-brand-navy line-clamp-1">{p.name}</h4>
                      <span className="text-[10px] text-brand-muted block uppercase mb-1 font-mono">SKU: {p.sku}</span>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-brand-purple">{currencySymbol}{price.toFixed(2)}</span>
                        
                        {/* Quantity modifiers */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-brand-bg">
                          <button
                            onClick={() => handleQtyChange(p.id, item.quantity - 1)}
                            aria-label={`Decrease quantity for ${p.name}`}
                            className="px-2 py-1 text-brand-muted hover:text-brand-text hover:bg-slate-100"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2 py-0.5 text-xs text-brand-navy font-bold">{item.quantity}</span>
                          <button
                            onClick={() => handleQtyChange(p.id, item.quantity + 1)}
                            aria-label={`Increase quantity for ${p.name}`}
                            className="px-2 py-1 text-brand-muted hover:text-brand-text hover:bg-slate-100"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(p.id)}
                      aria-label={`Remove ${p.name} from cart`}
                      className="text-brand-muted hover:text-brand-danger shrink-0 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cross-Sells Section */}
          {items.length > 0 && crossSells.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-extrabold text-brand-navy uppercase tracking-wider mb-2.5">
                Frequently Bought Together
              </h3>
              <div className="space-y-2">
                {crossSells.map((p) => {
                  const price = unitPrice(p);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0">
                          {p.thumbnail && <img src={p.thumbnail} alt={p.name} className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-brand-navy truncate max-w-[180px]">{p.name}</p>
                          <p className="text-[10px] text-brand-purple font-black">{currencySymbol}{price.toFixed(2)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuickAdd(p)}
                        className="rounded-lg bg-brand-purple px-3 py-1.5 text-[10px] font-bold text-white hover:bg-brand-purple/90 shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        {items.length > 0 && (
          <div className="border-t border-slate-100 pt-4 space-y-4">
            
            {/* Promo code form */}
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <input
                type="text"
                placeholder="Discount code (e.g. SCLERO10)"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-brand-navy focus:border-brand-purple focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-brand-navy hover:bg-slate-100"
              >
                Apply
              </button>
            </form>
            {promoError && <p className="text-[10px] font-bold text-brand-danger">{promoError}</p>}
            {appliedPromo && (
              <div className="flex items-center justify-between rounded-xl bg-brand-success/5 border border-brand-success/20 px-3 py-2 text-xs">
                <span className="flex items-center gap-1 font-bold text-brand-success">
                  <Percent className="h-3.5 w-3.5" />
                  Code Applied: {appliedPromo}
                </span>
                <button
                  onClick={() => { setDiscountPercent(0); setAppliedPromo(''); }}
                  className="text-brand-muted hover:text-brand-navy"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Price Calculations */}
            <div className="space-y-1.5 text-xs text-brand-muted">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-brand-navy font-semibold">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-brand-success font-semibold">
                  <span>Discount ({discountPercent}%)</span>
                  <span>-{currencySymbol}{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{taxInclusive ? `Incl. ${taxName} (${taxRate}%)` : `Estimated ${taxName} (${taxRate}%)`}</span>
                <span className="text-brand-navy font-semibold">{currencySymbol}{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-sm text-brand-navy">
                <span>Subtotal{taxInclusive ? '' : ' + tax'}</span>
                <span className="text-brand-purple text-base font-black">{currencySymbol}{total.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-brand-muted pt-0.5">Shipping calculated at checkout.</p>
            </div>

            <button
              onClick={() => {
                onOpenCheckout();
                onClose();
              }}
              className="w-full bg-brand-gradient text-white rounded-2xl py-3.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 flex items-center justify-center gap-1.5 shadow-md shadow-brand-purple/15"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
