import { authenticatedFetch } from './authFetch';

// One shared wishlist fetch per (region, token) instead of one per product
// card — a catalog page with 12 cards used to fire 12 identical requests
// (and 12 identical 401s when the stored token had expired).
let cache = { key: null, promise: null };

export function fetchWishlistOnce(region, accessToken) {
  if (!accessToken) {
    return Promise.resolve([]);
  }
  const key = `${region}:${accessToken}`;
  if (cache.key !== key || !cache.promise) {
    cache = {
      key,
      promise: authenticatedFetch(`/api/wishlist/?region=${region}`, {}, accessToken)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => (Array.isArray(data) ? data : data.results || []))
        .catch(() => []),
    };
  }
  return cache.promise;
}

// Call after any add/remove so the next reader refetches fresh state.
export function invalidateWishlistCache() {
  cache = { key: null, promise: null };
}
