import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { X, Check, Star, Plus, ShieldCheck, HelpCircle } from 'lucide-react';
import { getApiUrl } from '../lib/api';

export default function ProductDetailModal({ sku, onClose, onAddToCart }) {
  const { currentRegion, currencySymbol } = useSelector((state) => state.region);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('specs'); // specs, nutrition, reviews, faq

  // Review Form state
  const [reviewName, setReviewName] = useState('');
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(getApiUrl(`/api/products/${sku}/?region=${currentRegion}`))
      .then((res) => {
        if (!res.ok) throw new Error('Product details fetch failed');
        return res.json();
      })
      .then((data) => {
        setProduct(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [sku, currentRegion]);

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    if (!reviewName || !reviewEmail || !reviewComment) return;

    fetch(getApiUrl(`/api/products/${sku}/reviews/`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: reviewName,
        user_email: reviewEmail,
        rating: reviewRating,
        comment: reviewComment
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setReviewMsg(data.message || 'Review submitted successfully!');
        setReviewName('');
        setReviewEmail('');
        setReviewComment('');
      })
      .catch((err) => console.error(err));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay backdrop-blur-sm">
        <div className="loader"></div>
      </div>
    );
  }

  if (!product) return null;

  const priceVal = product.price ? parseFloat(product.price) : 0;
  const promoPriceVal = product.promotional_price ? parseFloat(product.promotional_price) : null;
  const stock = product.stock_available || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-lg bg-surface border border-edge shadow-overlay overflow-hidden flex flex-col md:flex-row my-8">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-sm border border-edge bg-surface text-ink-secondary hover:border-edge-strong hover:text-ink-primary"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left column: image & core buy actions */}
        <div className="w-full md:w-1/2 bg-surface-subtle p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-edge">
          <div>
            <div className="relative h-64 w-full rounded-md border border-edge bg-surface-muted flex items-center justify-center overflow-hidden mb-6">
              {product.media && product.media.length > 0 ? (
                <img
                  src={product.media[0].file_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-ink-subtle text-xs">No media available</span>
              )}
            </div>

            <h2 className="font-display text-2xl font-medium text-ink-primary mb-1">{product.name}</h2>
            <p className="text-[10px] text-ink-subtle font-mono tracking-wider mb-4 uppercase">SKU: {product.sku} | HSN: {product.hsn_code || 'N/A'}</p>

            <div className="flex items-baseline gap-2 mb-6">
              {promoPriceVal ? (
                <>
                  <span className="font-display text-[24px] font-medium text-ink-primary">
                    {currencySymbol}{promoPriceVal.toFixed(2)}
                  </span>
                  <span className="text-sm text-ink-muted line-through">
                    {currencySymbol}{priceVal.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="font-display text-[24px] font-medium text-ink-primary">
                  {currencySymbol}{priceVal.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4 text-xs font-medium text-ink-secondary">
              <ShieldCheck className="h-4 w-4 text-brand-success" />
              <span>Free Shipping eligibility on orders over {currentRegion === 'IN' ? '₹3,000' : '£50'}</span>
            </div>
            
            <button
              onClick={() => {
                onAddToCart(product);
                onClose();
              }}
              disabled={stock === 0}
              className={`w-full btn-primary py-3.5 text-sm ${
                stock === 0 ? 'cursor-not-allowed' : ''
              }`}
            >
              {stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>

        {/* Right column: specifications tabs */}
        <div className="w-full md:w-1/2 p-6 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-edge mb-6 text-xs font-medium text-ink-muted">
            <button
              onClick={() => setActiveTab('specs')}
              className={`pb-3 pr-4 border-b-2 transition-colors ${
                activeTab === 'specs' ? 'border-ink-primary text-ink-primary' : 'border-transparent hover:text-ink-primary'
              }`}
            >
              Specs
            </button>
            <button
              onClick={() => setActiveTab('nutrition')}
              className={`pb-3 px-4 border-b-2 transition-colors ${
                activeTab === 'nutrition' ? 'border-ink-primary text-ink-primary' : 'border-transparent hover:text-ink-primary'
              }`}
            >
              Nutrition
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`pb-3 px-4 border-b-2 transition-colors ${
                activeTab === 'faq' ? 'border-ink-primary text-ink-primary' : 'border-transparent hover:text-ink-primary'
              }`}
            >
              FAQ
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`pb-3 pl-4 border-b-2 transition-colors ${
                activeTab === 'reviews' ? 'border-ink-primary text-ink-primary' : 'border-transparent hover:text-ink-primary'
              }`}
            >
              Reviews ({product.reviews ? product.reviews.length : 0})
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto max-h-96 pr-2">
            
            {/* Specs Tab */}
            {activeTab === 'specs' && (
              <div className="space-y-4 text-xs leading-relaxed text-ink-secondary">
                <div>
                  <h4 className="kicker !text-ink-primary mb-1 block">Product Description</h4>
                  <p>{product.description}</p>
                </div>
                <div>
                  <h4 className="kicker !text-ink-primary mb-1 block">Key Benefits</h4>
                  <p>{product.benefits}</p>
                </div>
                <div>
                  <h4 className="kicker !text-ink-primary mb-1 block">Ingredients</h4>
                  <p className="bg-surface-muted p-3 rounded-sm text-ink-secondary">{product.ingredients}</p>
                </div>
              </div>
            )}

            {/* Nutrition Tab */}
            {activeTab === 'nutrition' && (
              <div>
                <h4 className="kicker !text-ink-primary mb-3 block">Macro-Nutrient Profile</h4>
                <div className="border border-edge rounded-md overflow-hidden text-xs">
                  {Object.entries(product.nutrition_facts || {}).map(([key, val], idx) => (
                    <div
                      key={key}
                      className={`flex justify-between p-3 ${
                        idx % 2 === 0 ? 'bg-surface-muted/60' : 'bg-transparent'
                      }`}
                    >
                      <span className="text-ink-muted">{key}</span>
                      <span className="font-medium text-ink-primary">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ Tab */}
            {activeTab === 'faq' && (
              <div className="space-y-4">
                {(product.faq || []).map((faq, i) => (
                  <div key={i} className="bg-surface p-4 rounded-md border border-edge">
                    <div className="flex gap-2 items-start text-xs font-semibold text-ink-primary mb-1">
                      <HelpCircle className="h-4 w-4 text-brand-accent shrink-0" />
                      <span>{faq.q}</span>
                    </div>
                    <p className="text-xs text-ink-secondary pl-6">{faq.a}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                
                {/* Submit review */}
                <form onSubmit={handleReviewSubmit} className="bg-surface-subtle p-4 rounded-md border border-edge space-y-3">
                  <h5 className="kicker !text-ink-primary">Leave a Review</h5>
                  {reviewMsg && <p className="text-xs text-ink-success font-medium">{reviewMsg}</p>}
                  
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      className="bg-surface border border-edge rounded-sm p-2 text-xs text-ink-primary focus:outline-none focus:border-ink-primary"
                      required
                    />
                    <input
                      type="email"
                      placeholder="Your Email"
                      value={reviewEmail}
                      onChange={(e) => setReviewEmail(e.target.value)}
                      className="bg-surface border border-edge rounded-sm p-2 text-xs text-ink-primary focus:outline-none focus:border-ink-primary"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="kicker">Rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setReviewRating(star)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-4 w-4 ${
                              star <= reviewRating ? 'fill-brand-accent text-brand-accent' : 'text-edge'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    placeholder="Write your review experience..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={2}
                    className="w-full bg-surface border border-edge rounded-sm p-2 text-xs text-ink-primary focus:outline-none focus:border-ink-primary"
                    required
                  />

                  <button
                    type="submit"
                    className="btn-primary py-2 px-4 text-xs"
                  >
                    Submit Review
                  </button>
                </form>

                {/* Review lists */}
                <div className="space-y-4">
                  {(product.reviews || []).map((rev) => (
                    <div key={rev.id} className="border-b border-edge-subtle pb-4">
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <span className="text-xs font-semibold text-ink-primary block">{rev.user_name}</span>
                          <span className="text-[9px] text-ink-subtle">{new Date(rev.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < rev.rating ? 'fill-brand-accent text-brand-accent' : 'text-edge'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="font-display italic text-sm text-ink-secondary">"{rev.comment}"</p>
                      {rev.is_verified_purchase && (
                        <span className="inline-flex items-center gap-1 rounded-xs bg-brand-success/10 text-ink-success text-[8px] font-medium px-1.5 py-0.5 mt-2">
                          <Check className="h-2 w-2" /> Verified Purchase
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
