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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/25 backdrop-blur-sm">
        <div className="loader"></div>
      </div>
    );
  }

  if (!product) return null;

  const priceVal = product.price ? parseFloat(product.price) : 0;
  const promoPriceVal = product.promotional_price ? parseFloat(product.promotional_price) : null;
  const stock = product.stock_available || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/30 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="glass-panel relative w-full max-w-4xl rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 text-brand-text hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left column: image & core buy actions */}
        <div className="w-full md:w-1/2 bg-white/5 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5">
          <div>
            <div className="relative h-64 w-full rounded-2xl bg-brand-bg flex items-center justify-center overflow-hidden mb-6">
              {product.media && product.media.length > 0 ? (
                <img
                  src={product.media[0].file_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-white/20 text-xs">No media available</span>
              )}
            </div>

            <h2 className="text-2xl font-black text-brand-text mb-1">{product.name}</h2>
            <p className="text-[10px] text-brand-muted font-mono tracking-wider mb-4 uppercase">SKU: {product.sku} | HSN: {product.hsn_code || 'N/A'}</p>

            <div className="flex items-baseline gap-2 mb-6">
              {promoPriceVal ? (
                <>
                  <span className="text-3xl font-black text-brand-accent">
                    {currencySymbol}{promoPriceVal.toFixed(2)}
                  </span>
                  <span className="text-sm text-brand-muted line-through">
                    {currencySymbol}{priceVal.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-3xl font-black text-brand-text">
                  {currencySymbol}{priceVal.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-brand-muted">
              <ShieldCheck className="h-4 w-4 text-brand-success" />
              <span>Free Shipping eligibility on orders over {currentRegion === 'IN' ? '₹3,000' : '£50'}</span>
            </div>
            
            <button
              onClick={() => {
                onAddToCart(product);
                onClose();
              }}
              disabled={stock === 0}
              className={`w-full rounded-2xl py-3.5 text-xs font-bold text-brand-bg uppercase tracking-wider transition-opacity ${
                stock === 0
                  ? 'bg-brand-muted/20 text-white/30 cursor-not-allowed'
                  : 'bg-brand-gradient hover:opacity-95'
              }`}
            >
              {stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>

        {/* Right column: specifications tabs */}
        <div className="w-full md:w-1/2 p-6 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-white/5 mb-6 text-xs font-semibold text-brand-muted">
            <button
              onClick={() => setActiveTab('specs')}
              className={`pb-3 pr-4 border-b-2 transition-colors ${
                activeTab === 'specs' ? 'border-brand-accent text-brand-text' : 'border-transparent hover:text-brand-text'
              }`}
            >
              Specs
            </button>
            <button
              onClick={() => setActiveTab('nutrition')}
              className={`pb-3 px-4 border-b-2 transition-colors ${
                activeTab === 'nutrition' ? 'border-brand-accent text-brand-text' : 'border-transparent hover:text-brand-text'
              }`}
            >
              Nutrition
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`pb-3 px-4 border-b-2 transition-colors ${
                activeTab === 'faq' ? 'border-brand-accent text-brand-text' : 'border-transparent hover:text-brand-text'
              }`}
            >
              FAQ
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`pb-3 pl-4 border-b-2 transition-colors ${
                activeTab === 'reviews' ? 'border-brand-accent text-brand-text' : 'border-transparent hover:text-brand-text'
              }`}
            >
              Reviews ({product.reviews ? product.reviews.length : 0})
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto max-h-96 pr-2">
            
            {/* Specs Tab */}
            {activeTab === 'specs' && (
              <div className="space-y-4 text-xs leading-relaxed text-brand-muted">
                <div>
                  <h4 className="font-bold text-brand-text mb-1 uppercase tracking-wider text-[10px]">Product Description</h4>
                  <p>{product.description}</p>
                </div>
                <div>
                  <h4 className="font-bold text-brand-text mb-1 uppercase tracking-wider text-[10px]">Key Benefits</h4>
                  <p>{product.benefits}</p>
                </div>
                <div>
                  <h4 className="font-bold text-brand-text mb-1 uppercase tracking-wider text-[10px]">Ingredients</h4>
                  <p className="bg-white/5 p-2 rounded-lg text-brand-text">{product.ingredients}</p>
                </div>
              </div>
            )}

            {/* Nutrition Tab */}
            {activeTab === 'nutrition' && (
              <div>
                <h4 className="text-xs font-bold text-brand-text mb-3 uppercase tracking-wider text-[10px]">Macro-Nutrient Profile</h4>
                <div className="border border-white/10 rounded-xl overflow-hidden text-xs">
                  {Object.entries(product.nutrition_facts || {}).map(([key, val], idx) => (
                    <div
                      key={key}
                      className={`flex justify-between p-3 ${
                        idx % 2 === 0 ? 'bg-white/5' : 'bg-transparent'
                      }`}
                    >
                      <span className="text-brand-muted">{key}</span>
                      <span className="font-bold text-brand-text">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ Tab */}
            {activeTab === 'faq' && (
              <div className="space-y-4">
                {(product.faq || []).map((faq, i) => (
                  <div key={i} className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                    <div className="flex gap-2 items-start text-xs font-bold text-brand-text mb-1">
                      <HelpCircle className="h-4 w-4 text-brand-accent shrink-0" />
                      <span>{faq.q}</span>
                    </div>
                    <p className="text-xs text-brand-muted pl-6">{faq.a}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                
                {/* Submit review */}
                <form onSubmit={handleReviewSubmit} className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                  <h5 className="text-xs font-extrabold text-brand-text uppercase tracking-wider">Leave a Review</h5>
                  {reviewMsg && <p className="text-xs text-brand-success font-semibold">{reviewMsg}</p>}
                  
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      className="bg-brand-bg border border-white/10 rounded-lg p-2 text-xs text-brand-text focus:outline-none focus:border-brand-accent"
                      required
                    />
                    <input
                      type="email"
                      placeholder="Your Email"
                      value={reviewEmail}
                      onChange={(e) => setReviewEmail(e.target.value)}
                      className="bg-brand-bg border border-white/10 rounded-lg p-2 text-xs text-brand-text focus:outline-none focus:border-brand-accent"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-brand-muted uppercase font-bold">Rating:</span>
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
                              star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-white/20'
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
                    className="w-full bg-brand-bg border border-white/10 rounded-lg p-2 text-xs text-brand-text focus:outline-none focus:border-brand-accent"
                    required
                  />

                  <button
                    type="submit"
                    className="bg-brand-gradient text-brand-bg rounded-lg py-1.5 px-4 text-xs font-bold uppercase tracking-wider hover:opacity-90"
                  >
                    Submit Review
                  </button>
                </form>

                {/* Review lists */}
                <div className="space-y-4">
                  {(product.reviews || []).map((rev) => (
                    <div key={rev.id} className="border-b border-white/5 pb-4">
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <span className="text-xs font-bold text-brand-text block">{rev.user_name}</span>
                          <span className="text-[9px] text-brand-muted">{new Date(rev.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-white/10'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-brand-muted italic">"{rev.comment}"</p>
                      {rev.is_verified_purchase && (
                        <span className="inline-flex items-center gap-1 rounded bg-brand-success/10 text-brand-success text-[8px] font-bold px-1.5 py-0.5 mt-2">
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
