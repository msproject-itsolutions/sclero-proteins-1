# Sclero Proteins Website Audit Report

Audit date: 2026-06-24  
Scope: storefront routes, shared components, SEO metadata, UX/CRO, mobile responsiveness, accessibility, checkout/cart flows, notifications, error handling, and technical performance.

## Executive Summary

The website has a strong base: a coherent brand palette, product catalog, regional pricing, cart/checkout flow, policy center, account area, cookie consent, and admin-driven commerce features. The biggest opportunities are technical SEO, mobile navigation, accessibility, form UX, analytics consent, route hygiene, and conversion trust around product detail and checkout.

The most urgent issues are:

- Mobile customers do not get a proper mobile menu. Primary navigation is hidden by breakpoint but there is no hamburger/menu replacement.
- Expected routes such as `/contact`, `/about`, and `/blog` are missing or unstable. `/contact` returns 404; `/about` and `/blog` returned 500 in local dev because the `.next` server artifact is corrupted/locked.
- SEO metadata is mostly global/static. Product, policy, blog, category, and landing pages need canonical URLs, Open Graph, Twitter metadata, and page-specific server metadata.
- Tracking scripts are initialized with mock IDs and before consent is enforced, causing repeated Meta Pixel warnings and privacy/performance risk.
- Many public forms and search inputs lack labels and `autocomplete`, which affects accessibility, mobile autofill, and Chrome warnings.
- Several icon-only buttons lack accessible names.
- Footer category links use stale slugs that do not match API categories, creating empty collection experiences.
- Build verification is blocked by `EPERM` on `frontend/.next/trace`, indicating a locked or permissioned build artifact.

## Evidence Collected

- Live frontend: `http://localhost:3000/` returned 200.
- Live backend APIs: `/api/regions/` and `/api/products/` returned 200.
- Browser audit covered desktop and mobile for `/`, `/products`, `/products?category=bone-joint-care`, `/products/BJC-BONE-JOINT`, `/bulk`, `/account`, `/policies/privacy`, `/policies/about`, `/policies/contact`, `/policies/shipping`, and `/policies/accessibility`.
- Route status checks:
  - `/`, `/products`, `/products/BJC-BONE-JOINT`, `/bulk`, `/account`, `/policies/*` returned 200.
  - `/contact` returned 404.
  - `/about` and `/blog` returned 500 in dev with `Cannot find module './586.js'` from `.next/server/webpack-runtime`.
- `npm run build` failed with `EPERM: operation not permitted, open 'frontend/.next/trace'`.

## Critical Issues

### 1. Mobile Navigation Is Not Complete

Location: `frontend/components/Navbar.jsx`

Problem: Desktop nav links are hidden with `md:flex`, but there is no mobile menu button or drawer. On mobile, users primarily see logo, region, account, and cart. Products, Wholesale, and Insights are not discoverable as a clear navigation system.

Impact: High UX and conversion impact. Mobile users can miss the catalog and content routes, increasing bounce and reducing product discovery.

Recommended solution:

- Add a mobile menu button with `aria-label="Open menu"`.
- Use a full-height or sheet-style mobile nav with Products, categories, Wholesale, Insights, About, Contact, Account, and Policies.
- Close on route click and Escape.

Before:

```jsx
<div className="hidden items-center gap-6 text-sm font-medium md:flex">
  ...
</div>
```

After:

```jsx
<button type="button" aria-label="Open menu" className="md:hidden">
  <Menu className="h-5 w-5" />
</button>
{mobileOpen && (
  <nav aria-label="Mobile navigation" className="fixed inset-0 z-50 bg-white">
    <Link href="/products">Products</Link>
    <Link href="/bulk">Wholesale</Link>
    <Link href="/policies/about">About</Link>
    <Link href="/policies/contact">Contact</Link>
  </nav>
)}
```

### 2. Missing and Broken Public Routes

Location: `frontend/app`

Problem:

- `/contact` returns 404 even though Contact is a normal user expectation.
- `/about` returns 500 in local dev.
- `/blog` returns 500 in local dev.
- Blog cards link to `/policies/about` instead of real article URLs.

Impact: Critical SEO and UX issue. Search engines and users expect clean about/contact/blog routes. 500s also harm crawl quality and trust.

Recommended solution:

- Create route aliases:
  - `frontend/app/about/page.jsx` redirecting or rendering `/policies/about`.
  - `frontend/app/contact/page.jsx` rendering contact form content or redirecting to `/policies/contact`.
  - `frontend/app/blog/page.jsx` listing published posts.
  - `frontend/app/blog/[slug]/page.jsx` for article detail.
- Add `not-found.jsx` and `error.jsx`.
- Clear/regenerate `.next` after stopping dev server to fix corrupted dev artifacts.

Before:

```jsx
<Link href={`/policies/about`}>Read Article</Link>
```

After:

```jsx
<Link href={`/blog/${b.slug}`}>Read Article</Link>
```

### 3. Tracking Scripts Use Mock IDs And Ignore Consent

Location: `frontend/hooks/useStoreBootstrap.js`, `frontend/utils/analytics.js`, `frontend/components/CookieConsent.jsx`

Problem: Tracking initializes with hardcoded mock IDs:

```js
google_analytics_id: 'G-12345MOCK',
meta_pixel_id: '123456789MOCK',
tiktok_pixel_id: '987654321MOCK',
```

The browser logs repeated `[Meta Pixel] - Invalid PixelID: null.` warnings. Tracking loads before cookie consent choices are used as a gate.

Impact: Performance, privacy, trust, and analytics quality risk. It creates noisy console warnings and can trigger third-party scripts unnecessarily.

Recommended solution:

- Move pixel IDs to environment/admin settings.
- Do not initialize analytics until consent allows analytics/marketing.
- Listen for `cookie-consent-updated` and initialize only matching trackers.
- Remove all `console.log` analytics noise in production.

Before:

```js
initTrackingScripts({
  google_analytics_id: 'G-12345MOCK',
  meta_pixel_id: '123456789MOCK',
  tiktok_pixel_id: '987654321MOCK',
});
```

After:

```js
const consent = getCookieConsent();
if (consent.analytics || consent.marketing) {
  initTrackingScripts(runtimeTrackingSettings, consent);
}
```

### 4. Production Build Blocked By Locked `.next/trace`

Location: `frontend/.next/trace`

Problem: `npm run build` fails with:

```text
EPERM: operation not permitted, open 'frontend/.next/trace'
```

Impact: Critical release reliability issue. Builds cannot be trusted until the stale/locked artifact is cleared.

Recommended solution:

- Stop running Next/Node processes that hold `.next`.
- Delete `.next` after confirming no dev server is using it.
- Re-run `npm run build`.
- Add clean build workflow to deployment scripts.

## High Priority Issues

### 5. Page-Specific SEO Metadata Is Incomplete

Location: `frontend/app/layout.jsx`, `frontend/app/products/layout.jsx`, client pages under `frontend/app`

Problem: Most pages are client components and rely on one global metadata object. Product detail injects JSON-LD but does not generate server-side metadata. Policy pages insert `<title>` and `<meta>` inside a client component body, which is not the correct App Router metadata pattern.

Impact: SEO ranking and share-preview impact. Product and policy pages need unique titles, descriptions, canonical URLs, and social cards.

Recommended solution:

- Convert route metadata to `generateMetadata` where possible.
- Add canonical URLs and `openGraph`/`twitter`.
- Generate product detail metadata from backend product data.
- Add `robots.js` and `sitemap.js`.

Before:

```jsx
<title>{policy.metaTitle}</title>
<meta name="description" content={policy.metaDesc} />
```

After:

```jsx
export async function generateMetadata({ params }) {
  const policy = POLICIES[params.slug] ?? POLICIES.privacy;
  return {
    title: policy.metaTitle,
    description: policy.metaDesc,
    alternates: { canonical: `/policies/${params.slug}` },
    openGraph: { title: policy.metaTitle, description: policy.metaDesc },
  };
}
```

### 6. No Canonical URLs Or Social Metadata

Location: all audited routes

Problem: Browser audit found `canonical`, `og:title`, and `og:description` missing on audited pages.

Impact: Search engines may treat regional/query pages poorly; shares on WhatsApp, LinkedIn, Facebook, and X will be less compelling.

Recommended solution:

- Add canonical URLs for root pages.
- For collection filters, canonicalize to `/products?category=slug` only for indexable categories.
- Use `noindex` for thin search/filter combinations where appropriate.

### 7. Footer Category Slugs Are Stale

Location: `frontend/components/Footer.jsx`, `frontend/components/ProductCatalog.jsx`

Problem: Footer links include category slugs like `bjcr-bone-joint-care`, `active-protein`, and `minerals-actives`, while the backend API returns `bone-joint-care`, `protein`, `creatine`, `recovery`, `collagen`, `calcium`, `skin-beauty`, and `soil-turf`.

Impact: Users land on empty or irrelevant category pages. SEO internal links point to weak URLs.

Recommended solution:

- Drive footer category links from `/api/products/categories/`.
- Or hardcode only actual slugs.
- Update `CATEGORY_DETAILS` keys to match API slugs.

Before:

```js
{ name: 'Bone & Joint Care', slug: 'bjcr-bone-joint-care' }
```

After:

```js
{ name: 'Bone & Joint Care', slug: 'bone-joint-care' }
```

### 8. Forms Lack Labels And Autocomplete

Location:

- `frontend/app/account/page.jsx`
- `frontend/app/page.jsx`
- `frontend/app/bulk/page.jsx`
- `frontend/app/policies/[slug]/page.jsx`
- `frontend/components/Navbar.jsx`
- `frontend/components/CartDrawer.jsx`
- `frontend/components/CheckoutModal.jsx`

Problem: Many inputs use placeholder-only labels and do not specify autocomplete. Chrome warned about missing autocomplete on account forms.

Impact: Accessibility, mobile UX, checkout conversion, and browser autofill. Screen readers do not get stable field names when placeholders disappear.

Recommended solution:

- Add visible or screen-reader labels for every form control.
- Add autocomplete values:
  - `email`
  - `name`
  - `given-name`
  - `family-name`
  - `tel`
  - `street-address`
  - `address-line1`
  - `address-line2`
  - `address-level2`
  - `address-level1`
  - `postal-code`
  - `country`
  - `current-password`
  - `new-password`
  - `one-time-code`

Before:

```jsx
<input type="email" required placeholder="Email" value={form.email} />
```

After:

```jsx
<label htmlFor="login-email">Email</label>
<input id="login-email" type="email" autoComplete="email" required value={form.email} />
```

### 9. Icon-Only Buttons Missing Accessible Names

Location:

- `frontend/components/ProductCard.jsx`
- `frontend/components/CartDrawer.jsx`
- `frontend/components/CheckoutModal.jsx`
- `frontend/app/products/[sku]/page.jsx`
- `frontend/components/ProductCatalog.jsx`

Problem: Browser audit found visible icon-only buttons with no text, `aria-label`, or title.

Impact: Screen reader and voice control users cannot understand controls. WCAG Name, Role, Value risk.

Recommended solution:

- Add `aria-label` to close, wishlist, remove, quantity, thumbnail, clear search, and drawer buttons.

Before:

```jsx
<button onClick={() => setIsWishlisted(!isWishlisted)}>
  <Heart className="h-5 w-5" />
</button>
```

After:

```jsx
<button
  type="button"
  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
  onClick={() => setIsWishlisted(!isWishlisted)}
>
  <Heart className="h-5 w-5" />
</button>
```

### 10. Cart And Checkout Error Handling Is Inconsistent

Location: `frontend/store/cartSlice.js`, `frontend/components/CartDrawer.jsx`, `frontend/components/CheckoutModal.jsx`

Problem: Cart async thunks store errors, but the cart drawer does not surface add/update/remove failures. Checkout shows errors, but payment gateway empty state leaves a disabled CTA without a stronger recovery path.

Impact: Users may click Add to cart and see nothing if the API fails. Checkout failures can feel like dead ends.

Recommended solution:

- Add toast/inline notification system for cart operations.
- Show cart `error` in drawer.
- Add retry CTA for payment gateway loading failure.
- Track failed checkout attempts for diagnostics.

### 11. Product Detail Uses Fallback Mock Reviews

Location: `frontend/app/products/[sku]/page.jsx`

Problem: If a product has no reviews, the UI shows hardcoded fallback reviews as if verified.

Impact: Legal/trust risk and conversion trust issue. Social proof must be authentic.

Recommended solution:

- Replace fallback reviews with an empty state or editorial testimonials clearly labeled as brand examples.
- Only show "Verified Purchase" for actual verified reviews.

## Medium Priority Issues

### 12. Product Images Are Remote `<img>` Tags Instead Of Optimized Next Images

Location: product cards, homepage category cards, product detail gallery

Problem: Most product imagery uses raw external Unsplash URLs with `<img>`.

Impact: Core Web Vitals risk, layout shift risk, image payload inefficiency, and weak product authenticity.

Recommended solution:

- Use `next/image` with configured remote patterns.
- Provide width/height or `fill` with stable aspect ratio.
- Replace generic Unsplash lifestyle images with actual product packshots, lab/warehouse visuals, or generated brand-consistent assets.

### 13. Header Search Is Hidden On Mobile

Location: `frontend/components/Navbar.jsx`

Problem: Search form is `hidden lg:block`. Mobile users lack global search.

Impact: Product discovery friction.

Recommended solution:

- Include search in the mobile menu or add a search icon that opens a full-width search panel.

### 14. Product Listing Has Filter UX Gaps

Location: `frontend/components/ProductCatalog.jsx`

Problem:

- Advanced filters are client-side text heuristics and can create surprising results.
- `priceMax` defaults differ by region but search/filter URL state is not fully synchronized.
- Empty states do not explain which filter caused the issue.

Impact: Lower collection conversion and user trust.

Recommended solution:

- Move structured filters to backend fields.
- Reflect filter state in the URL.
- Add active filter chips and better empty-state recovery.

### 15. Policy And Contact Forms Are Not Fully Integrated

Location: `frontend/app/policies/[slug]/page.jsx`

Problem: Contact form only sets `sent` locally and does not submit to `/api/enquiries/`.

Impact: Users think they contacted support, but the backend receives nothing.

Recommended solution:

- Submit contact form to backend.
- Show loading, success, and error states.
- Include email notifications if supported.

### 16. Cookie Consent Is Always Visible In Browser Audit And Uses Strong Visual Weight

Location: `frontend/components/CookieConsent.jsx`

Problem: Cookie banner takes prominent space and adds an h3 to every page until accepted. It also uses an emoji in heading.

Impact: Visual distraction, heading-noise for accessibility/SEO audits, and conversion friction.

Recommended solution:

- Use a more compact banner on mobile.
- Avoid heading levels or use `role="dialog"` with accessible labelling.
- Provide "Reject optional" as a clear third action.

### 17. About, Standards, Certifications Content Is Fragmented

Location: homepage and policy center

Problem: Trust proof exists as badges and policy text, but there is no dedicated science/standards/certifications page. Header links were removed because anchors were dead.

Impact: Missed SEO and conversion opportunity for supplement trust queries.

Recommended solution:

- Add `/science`, `/quality-standards`, and `/certifications` pages or sections.
- Link them from product pages and footer.
- Include evidence references, lab verification process, GMP explanation, and certificate previews.

### 18. Blog Content Exists But No Blog Route

Location: `frontend/app/page.jsx`, backend `/api/admin/blog-posts/`

Problem: Homepage fetches blog posts but article links go to `/policies/about`.

Impact: SEO content strategy is blocked. Blog posts cannot rank individually.

Recommended solution:

- Create `/blog` and `/blog/[slug]`.
- Render title, author, publish date, meta description, article body, and Article schema.

### 19. Product Schema Is Incomplete

Location: `frontend/app/products/[sku]/page.jsx`

Problem: Product JSON-LD lacks brand, aggregateRating, reviews, URL, priceValidUntil, seller, and image fallback. It also renders client-side after product fetch.

Impact: Lower rich-result eligibility.

Recommended solution:

- Generate server-rendered Product schema.
- Add `aggregateRating` only from real reviews.
- Add BreadcrumbList schema.

### 20. Notifications Need A Unified System

Location: site-wide

Problem: Feedback is fragmented: inline messages, alerts in admin, console logs, local success states, and silent catches.

Impact: Inconsistent UX and poor recovery.

Recommended solution:

- Add a toast/notification provider.
- Standardize success/error/loading states.
- Replace `alert()` with styled non-blocking confirmations.
- Log API errors to a central diagnostic layer.

## Low Priority Issues

### 21. Visual System Is Over-Reliant On Cards And Glass Panels

Location: homepage, product listing, account, checkout, policy center

Problem: The brand looks clean, but many surfaces use similar rounded cards, borders, and glass treatment.

Impact: Visual hierarchy can feel repetitive; premium differentiation is reduced.

Recommended solution:

- Use stronger editorial sections for science/trust content.
- Reserve cards for products, drawers, and repeated items.
- Use more actual product/lab imagery and full-width bands.

### 22. Typography And Microcopy Need Tightening

Location: homepage, footer, product pages

Problem examples:

- "haywards Heath" should be "Haywards Heath".
- Hero text lacks spacing: "Mobility support,backed by science."
- Some claims are broad: "Trusted by Thousands" while local seeded data may not support it.

Impact: Trust and professionalism.

Recommended solution:

- Run copy QA.
- Use evidence-backed claims.
- Fix capitalization, punctuation, and spacing.

Before:

```text
Mobility support,backed by science.
```

After:

```text
Mobility support, backed by science.
```

### 23. External Social Link Uses HTTP

Location: `frontend/components/Footer.jsx`

Problem: TikTok link uses `http://tiktok.com/@scleroproteins`.

Impact: Minor trust/security issue.

Recommended solution:

```jsx
href="https://www.tiktok.com/@scleroproteins"
```

### 24. Wishlist Is Local Mock Data

Location: `frontend/app/account/page.jsx`

Problem: Wishlist tab contains a hardcoded sample product and local state.

Impact: Users may see a fake wishlist item.

Recommended solution:

- Connect wishlist to backend.
- Empty state should be real until items are added.

### 25. Product Page "Buy It Now" Does Not Start Checkout

Location: `frontend/app/products/[sku]/page.jsx`

Problem: `handleBuyNow` only adds to cart and opens cart, based on current implementation.

Impact: CTA promise does not match user expectation.

Recommended solution:

- Rename to "Add and review cart" or open checkout directly after successful add.

## Page-By-Page Notes

### Homepage

Strengths:

- Clear hero, product discovery, trust badges, quiz, testimonials, newsletter, and wholesale lead capture.

Issues:

- Needs page-specific Open Graph/canonical metadata.
- Newsletter and wholesale forms lack labels/autocomplete.
- Blog cards point to About policy page, not articles.
- Copy has minor punctuation/capitalization issues.
- Cookie banner competes with first visit conversion.

### Product Listing And Collections

Strengths:

- Useful filters, search, sorting, product cards, buying guide, FAQ section.

Issues:

- Footer/category slug mismatch creates empty collections.
- Filter semantics are partly heuristic.
- No FAQ schema despite "FAQ Schema" label.
- Search input lacks label/autocomplete.
- Empty category pages can remain indexable unless noindex/canonical is handled.

### Product Detail

Strengths:

- Good above-the-fold product layout, trust badges, quantity, add-to-cart, related products, tabs, and schema start.

Issues:

- Client-only SEO metadata.
- Mock fallback reviews.
- Wishlist and thumbnail buttons lack accessible names.
- Buy It Now behavior is not true immediate checkout.
- Product image optimization and real packshot quality need improvement.

### Cart And Checkout

Strengths:

- Cart drawer includes free-shipping progress, cross-sells, promo code, and checkout modal.
- Checkout has visible inline error message.

Issues:

- Cart API failures are not surfaced.
- Checkout address fields need autocomplete.
- Payment gateway empty state needs stronger recovery.
- Shipping cost is duplicated/hardcoded in frontend; should come from shipping API/rates.
- Modal accessibility should include dialog role, labelledby, focus trap, Escape close, and focus return.

### Account

Strengths:

- Login/register, OTP, profile, addresses, orders, preferences.

Issues:

- Chrome autocomplete warning.
- Placeholder-only fields in auth and address forms.
- Wishlist is mock local data.
- Address save/delete lacks visible error handling.

### Bulk

Strengths:

- Focused lead generation page with meaningful wholesale fields.

Issues:

- No dedicated SEO metadata.
- Form lacks autocomplete and labels.
- Should capture company, phone, country with backend validation and stronger success/error state.

### Policies, About, Contact

Strengths:

- Good policy center coverage, including about, contact, accessibility, privacy, terms, shipping, refund, cookie.

Issues:

- `/about` and `/contact` top-level route expectations are not met.
- Contact form is local-only and does not submit to backend.
- Metadata is injected from a client component rather than proper App Router metadata.

### Admin

Strengths:

- Broad operational surface for catalog, orders, shipping, regions, content, marketing, staff, approvals, audit.

Issues:

- Many admin inputs lack labels/autocomplete.
- Uses `alert()` in several places.
- A prior runtime error was caused by missing imports, so add lint/build CI coverage.
- Admin file is very large and should be split by module for maintainability.

## SEO Roadmap

Critical:

- Add `robots.js` and `sitemap.js`.
- Add canonical URLs and per-page metadata.
- Add top-level `/about`, `/contact`, `/blog`.
- Fix category slugs and article links.
- Generate product, breadcrumb, FAQ, and article schema server-side.

High:

- Add collection landing copy for each real category.
- Add real science/standards/certification content pages.
- Add image alt strategy and optimized image delivery.
- Add internal links from homepage trust badges to proof pages.

Medium:

- Add hreflang handling for UK/IN regions once production domains are final.
- Add noindex for internal admin, cart, account, filtered search pages.

## CRO Roadmap

Critical:

- Mobile menu and mobile search.
- Real cart/checkout notifications and failure recovery.
- Remove fake reviews.

High:

- Make Buy It Now open checkout directly.
- Add trust links near checkout: shipping, returns, secure payment, support.
- Add product page proof: lab tests, certificate PDFs/images, dosage transparency.

Medium:

- Add abandoned checkout capture.
- Add review submission and verified review flow.
- Add bundle/quantity discounts on product detail.

## Accessibility Roadmap

Critical:

- Add accessible names for icon buttons.
- Add labels and autocomplete to forms.
- Add modal roles, focus trap, Escape close, and focus restore.

High:

- Add skip link.
- Add `aria-current` for active nav/policy links.
- Ensure color contrast for tiny muted text and badge text.

Medium:

- Reduce heading pollution from cookie banner.
- Improve keyboard flow for product gallery and tabs.

## Performance Roadmap

Critical:

- Fix `.next/trace` build blocker.
- Remove mock/invalid tracking scripts and consent-gate third parties.

High:

- Use `next/image`.
- Avoid remote Unsplash for production product imagery.
- Add build/lint CI.

Medium:

- Reduce client-side page weight by moving SEO/content pages to server components where practical.
- Split large admin page into lazy-loaded sections.

## Recommended Implementation Order

1. Fix build artifact and add lint/build CI.
2. Add mobile menu/search and accessible icon labels.
3. Add route aliases for `/about`, `/contact`, `/blog`, plus error/not-found pages.
4. Fix SEO metadata, sitemap, robots, canonical, OG/Twitter.
5. Consent-gate analytics and remove mock IDs.
6. Add labels/autocomplete to public forms and checkout.
7. Fix footer/category slugs and blog article URLs.
8. Replace mock reviews and wire contact form to backend.
9. Add notification/toast provider and cart/checkout error handling.
10. Optimize images and add richer proof pages for science, standards, and certifications.

