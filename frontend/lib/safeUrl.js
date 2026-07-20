/**
 * Accept only navigation schemes that are safe to render in shopper-facing
 * links. Admin-managed content must never be able to inject a javascript: URL.
 */
export function safePublicHref(value) {
  const href = String(value || '').trim();
  if (!href) return '';
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  if (href.startsWith('#')) return href;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  return '';
}
