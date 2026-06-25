# SCLERO PROTEINS — DESIGN SPECIFICATIONS & WIREFRAMES
**Version**: 1.0  
**Date**: 2026-06-17  
**Scope**: Homepage redesign, product cards, collection page, navbar, footer

---

## DESIGN SYSTEM OVERVIEW

### Color Palette (Current)
- Primary: `brand-purple` (#6B46C1)
- Secondary: `brand-navy` (#1E293B)
- Tertiary: `gold-gradient` (amber accent)
- Success: `brand-success` (#10B981)
- Danger: `brand-danger` (#EF4444)
- Muted: `brand-muted` (slate-500)
- Background: White / slate-50

### Typography
- Headings: Bold / Extrabold (h1-h3)
- Body: Regular / Medium (text-sm to text-base)
- Small text: XS/XXS for secondary info

### Spacing & Grid
- Max-width: 1280px (max-w-7xl)
- Padding: 4px, 8px, 16px, 24px, 32px, 48px units
- Gap: 6px, 12px, 16px, 24px between elements
- Breakpoints: Mobile (<640px), Tablet (640-1024px), Desktop (1024px+)

---

## 1. HOMEPAGE REDESIGN

### 1A. HERO SECTION (With Promotional Banner)

```
┌────────────────────────────────────────────────────────────┐
│ [Sticky Promo Banner]                                       │
│ "🎁 20% off your first subscription order — Shop now →"   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                         HERO SECTION                        │
├────────────────────────────────────────────────────────────┤
│ LEFT (60% on desktop, 100% mobile)        │ RIGHT (40%)    │
│                                            │                │
│ • BJC® Bone & Joint Care [chip]           │ [Product       │
│                                            │  Mockup Box]   │
│ Mobility support, backed by science.      │                │
│ [Hero headline - 60px bold]               │ • Image        │
│                                            │ • SKU          │
│ Sclero Proteins delivers clinically       │ • Price        │
│ informed bone and joint nutrition...      │ • CTA          │
│ [Supporting copy - 18px]                  │                │
│                                            │                │
│ [Buttons]                                  │                │
│ "Shop BJC® →" (primary)                   │                │
│ "Take our quiz →" (secondary - NEW)       │                │
│                                            │                │
│ Trust signals row:                         │                │
│ ✓ GMP  ✓ Lab tested  ✓ Transparent       │                │
└────────────────────────────────────────────────────────────┘
```

**Changes from Current**:
- Add promotional banner at top (sticky, dismissible)
- Add quiz CTA button (secondary to shop button)
- Keep product mockup (good UX)
- Enhance trust signals with icons (already done, keep as-is)

**Copy Adjustments**:
- Consider: "20% off first subscription order" or "Free shipping on orders over £50" (choose one)
- Quiz CTA: "Not sure which product? Take our quiz →" or "Find your ideal supplement →"

---

### 1B. FEATURED PRODUCTS SECTION (Enhanced)

```
┌────────────────────────────────────────────────────────────┐
│                 FEATURED RANGE                              │
│ "BJC® bone & joint care and active nutrition — transparent │
│  labels, regional pricing." [subtitle stays same]           │
├────────────────────────────────────────────────────────────┤
│ [Filter/Sort Bar - NEW]                                     │
│ Category: All ▼ | Price: All ▼ | Sort: Popularity ▼        │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Product  │  │ Product  │  │ Product  │  │ Product  │  │
│  │ Card 1   │  │ Card 2   │  │ Card 3   │  │ Card 4   │  │
│  │ (Enhanced)   │          │  │          │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Product  │  │ Product  │  │ Product  │  │ Product  │  │
│  │ Card 5   │  │ Card 6   │  │ Card 7   │  │ Card 8   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Product  │  │ Product  │  │ Product  │  │ Product  │  │
│  │ Card 9   │  │ Card 10  │  │ Card 11  │  │ Card 12  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                              │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                  "Browse full catalog →"                    │
│                     (centered button)                       │
└────────────────────────────────────────────────────────────┘
```

**Changes**:
- Increase featured count from 6 to 12
- Add filter/sort bar above grid (optional on homepage, required on /products)
- Product cards enhanced (see section 2)

---

### 1C. RECOMMENDATION / BUNDLES SECTION (NEW)

```
┌────────────────────────────────────────────────────────────┐
│              RECOMMENDED FOR YOU (or BUNDLES)               │
│ "Save with our curated supplement bundles and pairings"    │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Bundle Card      │  │ Bundle Card      │               │
│  │ • Product 1      │  │ • Product 1      │               │
│  │ • Product 2      │  │ • Product 2      │               │
│  │ • Product 3      │  │ • Product 3      │               │
│  │ Save 15%         │  │ Save 12%         │               │
│  │ £XX.XX [CTA]     │  │ £XX.XX [CTA]     │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ "Works well with"│  │ "Works well with"│               │
│  │ Cross-sell pair  │  │ Cross-sell pair  │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

**New Section**: 
- Insert between featured products and current "Science & Integrity" section
- Show 2-4 bundles or complementary product pairings
- Emphasizes multi-item value

---

### 1D. TRUST / AUTHORITY SECTION (Enhanced)

**Current State**: "Science & Integrity" + "Quality Standards" + "Certifications"

**Proposed Enhancement**:

```
┌────────────────────────────────────────────────────────────┐
│                    TRUST & AUTHORITY (NEW)                  │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  • Trusted by 50,000+ customers (or real #)                │
│  • [Trustpilot badge] 4.8/5 from 3,247 reviews            │
│  • 30-Day Money-Back Guarantee                             │
│  • Independently tested for purity & potency               │
│                                                              │
│  [Money-back guarantee icon visual with explanation]       │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

**Position**: Just above current "Science & Integrity" section  
**Impact**: Anchors trust before detailed product info

---

### 1E. INSIGHTS / BLOG SECTION (Rename & Enhance)

**Current**: 3 blog items  
**Proposed**: 
- Rename to "Latest Insights" or "Science & Learn"
- Consider 4 items instead of 3
- Each card shows: title, excerpt, author, read time

```
┌─────────────────────────────────────────────────────────┐
│              LATEST INSIGHTS & EDUCATION                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
│ │ Article 1      │ │ Article 2      │ │ Article 3      ││
│ │ Title...       │ │ Title...       │ │ Title...       ││
│ │ Excerpt...     │ │ Excerpt...     │ │ Excerpt...     ││
│ │ 5 min read     │ │ 6 min read     │ │ 4 min read     ││
│ │ [Read more →]  │ │ [Read more →]  │ │ [Read more →]  ││
│ └────────────────┘ └────────────────┘ └────────────────┘│
│                                                          │
│          ┌────────────────┐                              │
│          │ Article 4      │                              │
│          │ Title...       │                              │
│          │ Excerpt...     │                              │
│          │ 7 min read     │                              │
│          │ [Read more →]  │                              │
│          └────────────────┘                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### 1F. WHOLESALE SECTION (Keep Current)

Current design is strong. Minor enhancement:
- Consider adding: "Interested? Fill out the form below → "
- Keep current form

---

## 2. ENHANCED PRODUCT CARD SPECIFICATION

### Current Card (from ProductCard.jsx)
- Image (hover zoom)
- Stock badge (top-right)
- Rating (generic)
- Name
- SKU
- Price
- Add to cart + View details

### Enhanced Card Layout

```
┌──────────────────────────────┐
│ [Image - 16:9 aspect] ←──── │ Stock Badge
│                              │ (IN STOCK)
├──────────────────────────────┤
│ ★★★★★ 4.85/5 (427 reviews)  │ ← Enhanced rating
│ BJC® Collagen Peptides       │ ← Product name
│ (2-line clamp)               │
│                              │
│ 10g protein | 2.2kg | Vegan  │ ← NEW: Specs line
│                              │
│ "Type I hydrolyzed collagen  │ ← NEW: Benefit
│ for joint mobility"          │      statement
│                              │
│ £42.99  ~~£54.99~~           │ ← Price (current)
│ (inc. VAT)                   │ ← NEW: Tax clarity
│                              │
│ ┌──────────────────────────┐ │
│ │ + Add to Cart            │ │ ← CTA buttons
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ View Details             │ │
│ └──────────────────────────┘ │
│                              │
│ Flavors: Vanilla, Chocolate  │ ← NEW: Variant
│           [See all →]        │      indicator
│                              │
└──────────────────────────────┘
```

### Card Data Structure (Required from API)
```json
{
  "id": "abc123",
  "sku": "BJC-COLLAGEN-2.2KG",
  "name": "BJC® Collagen Peptides",
  "price": 54.99,
  "promotional_price": 42.99,
  "average_rating": 4.85,
  "review_count": 427,
  "thumbnail": "image_url",
  "stock_available": 45,
  "specification": {
    "protein_per_serving": "10g",
    "container_size": "2.2kg",
    "benefits": ["joint-mobility", "collagen"],
    "dietary_badges": ["vegan", "gluten-free"],
    "flavor_count": 2
  },
  "brief_benefit": "Type I hydrolyzed collagen for joint mobility"
}
```

### CSS Classes & Styles
- Keep current glass-panel, glass-panel-hover classes
- Font sizing: 
  - Name: text-base font-bold
  - Specs: text-xs text-brand-muted
  - Benefit: text-xs leading-relaxed
  - Rating: text-xs font-bold
  - Price: text-xl font-black (current)

---

## 3. COLLECTION PAGE REDESIGN (products/page.jsx)

### 3A. Page Layout (Desktop)

```
┌──────────────────────────────────────────────────────────────┐
│                        PAGE HEADER                            │
│ "All Products"                                               │
│ "BJC® bone & joint care, proteins, and active nutrition..." │
└──────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌────────────────────────────────────────────┐
│              │  │         SEARCH & FILTERS BAR               │
│  FILTER      │  │ ┌──────────────────────────────────────┐  │
│  SIDEBAR     │  │ │ [🔍 Search products, SKU, etc...]    │  │
│              │  │ └──────────────────────────────────────┘  │
│ Category ▼   │  │ [3 filters applied] [Clear all ✕]       │
│ ○ All        │  │                                         │
│ ○ Collagen   │  │ Sort: Popularity ▼                     │  │
│ ○ Whey       │  │                                         │  │
│ ○ Plant-based│  │ ┌───────────────┐ ┌───────────────┐ ... │
│              │  │ │ Product Card  │ │ Product Card  │     │
│ Health Goal ▼│  │ │               │ │               │     │
│ ○ All        │  │ └───────────────┘ └───────────────┘     │
│ ○ Joint Care │  │                                         │
│ ○ Mobility   │  │ ┌───────────────┐ ┌───────────────┐ ... │
│ ○ Recovery   │  │ │ Product Card  │ │ Product Card  │     │
│              │  │ │               │ │               │     │
│ Price ▼      │  │ └───────────────┘ └───────────────┘     │
│ ○ All        │  │                                         │
│ ○ £0-25      │  │ [Load more products ▼] or [Pagination] │
│ ○ £25-50     │  │                                         │
│ ○ £50+       │  └────────────────────────────────────────────┘
│              │
│ Dietary ▼    │
│ ☐ Vegan      │
│ ☐ Gluten-free│
│ ☐ Keto       │
│              │
│ Supply Size ▼│
│ ○ Under 1kg  │
│ ○ 1-2kg      │
│ ○ 2kg+       │
│              │
│ [Clear all] │
│              │
└──────────────┘
```

**Component Specs**:
- Sidebar: 250px wide on desktop, hidden on mobile (drawer on mobile)
- Filter count badge: "3 filters active" with clear button
- Search bar: Prominent, 500px+ width on desktop
- Grid: Responsive (4 cols desktop, 2 cols tablet, 1 col mobile)

---

### 3B. Mobile Collection Layout

```
┌────────────────────────────┐
│ [Filter drawer icon]       │ Sort: Popularity ▼
├────────────────────────────┤
│ [🔍 Search...]             │
├────────────────────────────┤
│                            │
│ ┌──────────────────────┐  │
│ │ Product Card (1 col) │  │
│ └──────────────────────┘  │
│                            │
│ ┌──────────────────────┐  │
│ │ Product Card         │  │
│ └──────────────────────┘  │
│                            │
│ ┌──────────────────────┐  │
│ │ Product Card         │  │
│ └──────────────────────┘  │
│                            │
│ [Load more products]       │
│                            │
└────────────────────────────┘

[Swipe left to open filter drawer]

┌────────────────────────────┐
│ Filters        [Close ✕]   │
├────────────────────────────┤
│ Category ▼                 │
│ ○ All ○ Collagen ○ Whey   │
│                            │
│ Health Goal ▼              │
│ ○ All ○ Joint ○ Mobility  │
│                            │
│ Price ▼                    │
│ ○ All ○ £0-25 ○ £25-50   │
│                            │
│ [Apply Filters] [Clear]    │
│                            │
└────────────────────────────┘
```

---

### 3C. Filter Panel Component Spec

**Filter Categories** (Priority Order):
1. **Category** (Ingredient-based)
   - All Products
   - Collagen & Collagen Peptides
   - Whey Protein
   - Plant-Based Protein
   - Casein / Slow-Release
   - Joint Support Blends
   - Amino Acids / BCAA

2. **Health Goal** (Benefit-based)
   - All Goals
   - Joint & Mobility
   - Muscle Gain & Recovery
   - Bone Health
   - Athletic Performance
   - General Wellness
   - Weight Management

3. **Price Range**
   - All Prices
   - £0-25
   - £25-50
   - £50-100
   - £100+

4. **Dietary**
   - Vegan
   - Gluten-Free
   - Dairy-Free
   - Keto-Friendly
   - Organic

5. **Supply Size**
   - All Sizes
   - Under 1kg
   - 1-2kg
   - 2-3kg
   - 3kg+

**UX Details**:
- Checkbox style (not radio) except Category (which could be radio)
- Show applied filter count in parent category header
- "Clear all filters" button at bottom
- Apply/Update results immediately (not on button click)

---

### 3D. Search Component Spec

**Search Bar Position**: 
- In collection page header (prominent)
- In navbar (persistent, site-wide)

**Search Behavior**:
- Real-time autocomplete with suggestions
- Search across: Product name, SKU, benefits, ingredients
- Results shown in dropdown or dedicated search results page

**Autocomplete Suggestions**:
```
Query: "coll"
Suggestions:
─────────────────────
Collagen Peptides (Product)
Collagen + Vitamin C Blend (Product)
View all collagen products → (Category)
```

---

### 3E. Pagination/Load More Spec

**Option A: "Load More" Button** (Recommended)
- Button at bottom of grid: "Load more products ▼"
- Loads 12-24 more products on click
- Simple, better UX for touch devices

**Option B: Pagination** (If high product count)
- "Showing 1-24 of 156 products"
- [← Previous] [1] [2] [3] [4] [Next →]
- Only show if 5+ pages

**Option C: Infinite Scroll** (Less common)
- Auto-load as user scrolls to bottom
- Compliance risk (GDPR, back button behavior)
- Not recommended

---

## 4. NAVBAR REDESIGN

### 4A. Desktop Navbar Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Sclero | Products ▼ | Learn ▼ | Wholesale | 🔍 | 🌐 | 🛒 | ⚙ │
│              Proteins       |          |           |   |    |    |    │
├─────────────────────────────────────────────────────────────┤
│ Products ▼ Dropdown:         Learn ▼ Dropdown:               │
│ ├─ All Products             ├─ Science & Standards          │
│ ├─ By Ingredient             ├─ Certifications              │
│ │  ├─ Collagen              ├─ Blog Insights                │
│ │  ├─ Whey                  ├─ FAQs                         │
│ │  ├─ Plant-based           └─ Testimonials                 │
│ │  └─ ...                                                    │
│ ├─ By Health Goal                                            │
│ │  ├─ Joint & Mobility                                      │
│ │  ├─ Muscle Gain                                           │
│ │  └─ ...                                                    │
│ └─ Bundles & Offers                                         │
│                                                              │
│ [Search icon] → [Search modal]                              │
│ [Globe icon] → Region selector (current, keep as-is)        │
│ [Cart icon] → Cart drawer (current, keep as-is)             │
│ [User icon] → Account/Login (NEW)                           │
│ [Gear icon] → Admin (keep, hide from public)                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Changes**:
1. Restructure nav into "Products" and "Learn" parent dropdowns
2. Add search icon (opens search modal)
3. Add user/account icon (links to login/my account)
4. Keep region selector and cart
5. Keep admin button but hide from public view

---

### 4B. Mobile Navbar Layout

```
┌──────────────────────────────────────────┐
│ [≡] Logo  Sclero Proteins  [🔍] [🛒] [🌐]│
└──────────────────────────────────────────┘

[Hamburger menu opened]

┌──────────────────────────────────────────┐
│ ✕ Sclero Proteins                        │
├──────────────────────────────────────────┤
│ [🔍 Search...]                           │
├──────────────────────────────────────────┤
│                                          │
│ Products                            ▼    │
│  ├─ All Products                        │
│  ├─ By Ingredient                       │
│  └─ By Health Goal                      │
│                                          │
│ Learn                               ▼    │
│  ├─ Science & Standards                 │
│  ├─ Blog Insights                       │
│  └─ FAQs                                │
│                                          │
│ Wholesale                                │
│ 🌐 United Kingdom  ✓                     │
│   India                                  │
│                                          │
│ 👤 My Account / Sign In                 │
│                                          │
└──────────────────────────────────────────┘
```

**Key Changes**:
- Hamburger menu with dropdown sections
- Search bar at top of menu
- Region selector within menu
- Account link in menu

---

## 5. FOOTER REDESIGN

### 5A. Enhanced Footer Layout (5-6 Columns)

```
┌──────────────────────────────────────────────────────────────────┐
│                          FOOTER                                   │
├──────────┬──────────────┬──────────────┬──────────────┬──────────┤
│ SHOP     │ LEARN        │ SUPPORT      │ COMPANY      │ LEGAL &  │
│          │              │              │              │ TRUST    │
│ • All    │ • Science &  │ • Contact    │ • About Us   │ • Privacy│
│   Prod.  │   Standards  │   Us         │              │   Policy │
│ • By     │ • Blog       │ • FAQs       │ • Careers    │ • Terms  │
│   Ingredi│   Insights   │ • Shipping & │ • Wholesale  │ • Cookie │
│   ent    │ • FAQ        │   Returns    │ • Media Kit  │   Policy │
│ • By     │ • Testimonials            │ • Sustain.   │ • Cookies│
│   Goal   │ • Education  │ • Warranty   │   Report     │          │
│ • Bundles│   Guides     │ • Bulk       │ • Affiliate  │ [Trust   │
│ • My     │              │   Orders     │   Program    │  Badges] │
│   Account│              │ • Tracking   │ • Wholesale  │          │
│          │              │   Orders     │   Inquiry    │ GMP      │
│          │              │              │              │ ✓ ISO    │
│          │              │              │              │ ✓ HACCP  │
│          │              │              │              │ ✓ Tested │
├──────────┴──────────────┴──────────────┴──────────────┴──────────┤
│                                                                    │
│ [Company Logo & Description - 2 lines]                           │
│                                                                   │
│ Regional Contact Info:                                            │
│ 🇮🇳 India: +91 84888 03622  |  🇬🇧 UK: +44 1293 901941          │
│ india@scleroproteins.co.uk  |  support@scleroproteins.co.uk      │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│ [Facebook] [Instagram] [TikTok] [LinkedIn]                      │
│                                                                   │
│ © 2026 Sclero Proteins Ltd. All rights reserved.                │
│ Built with science, trust & transparency.                        │
└──────────────────────────────────────────────────────────────────┘
```

**Key Changes**:
- 5 columns: Shop, Learn, Support, Company, Legal & Trust
- 40-50 total links (vs. current 12)
- Trust badges in footer (GMP, ISO, HACCP, Lab tested)
- Newsletter signup (optional, can be in separate section)
- Social media icons at bottom
- Regional contact info prominent

---

### 5B. Footer Content Structure

| SHOP | LEARN | SUPPORT | COMPANY | LEGAL & TRUST |
|------|-------|---------|---------|---------------|
| All Products | Science & Standards | Contact Us | About Us | Privacy Policy |
| By Ingredient | Blog Insights | FAQs | Careers | Terms & Conditions |
| By Health Goal | Education Guides | Shipping & Returns | Sustainability Report | Cookie Policy |
| Bundles & Offers | Testimonials | Order Tracking | Wholesale Inquiry | GDPR Compliance |
| My Account | Research & Studies | Bulk Orders | Affiliate Program | Accessibility |
| | Clinical Backing | Warranty & Guarantee | Media Kit | Security & Trust |
| | | Dietary Support | Partner with Us | | |

---

## 6. PRODUCT DETAIL PAGE SPEC (Enhanced)

### 6A. Product Detail Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumb: Home > Products > Collagen > BJC® Collagen...   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌──────────────────┐  ┌──────────────────────────────────┐  │
│ │                  │  │ Product Name                      │  │
│ │  Image Gallery   │  │ ★★★★★ 4.85/5 (427 reviews)      │  │
│ │  (Carousel)      │  │                                  │  │
│ │  5+ images       │  │ £42.99  ~~£54.99~~                │  │
│ │  with zoom       │  │ (inc. VAT)                       │  │
│ │                  │  │                                  │  │
│ │ [Thumbnails]     │  │ Specs:                           │  │
│ │ [img] [img] [img]│  │ • 10g protein per serving        │  │
│ │                  │  │ • 2.2kg container (22 servings)  │  │
│ │                  │  │ • Vegan-friendly                 │  │
│ │                  │  │ • Lab-tested for purity          │  │
│ │                  │  │                                  │  │
│ │                  │  │ Flavor: Vanilla ▼                │  │
│ │                  │  │ Size: 2.2kg ▼                    │  │
│ │                  │  │                                  │  │
│ │                  │  │ Quantity: [-] 1 [+]              │  │
│ │                  │  │                                  │  │
│ │                  │  │ [🔔 Subscribe & Save 20%]        │  │
│ │                  │  │ [🛒 One-time Purchase]           │  │
│ │                  │  │                                  │  │
│ │                  │  │ ✓ 30-Day Money-Back Guarantee    │  │
│ │                  │  │ ✓ Free Shipping on Orders £50+   │  │
│ │                  │  │ ✓ Lab-Verified Authenticity      │  │
│ │                  │  │                                  │  │
│ └──────────────────┘  └──────────────────────────────────┘  │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ DETAILED DESCRIPTION                                          │
│                                                               │
│ What Is It:                                                  │
│ "Type I hydrolyzed bovine collagen peptides, easily..."     │
│                                                               │
│ Why Take It:                                                │
│ • Joint mobility support                                    │
│ • Bone strength promotion                                  │
│ • Connective tissue health                                 │
│                                                               │
│ Best For:                                                    │
│ [Badge: Joint Health] [Badge: Recovery] [Badge: Age 40+]   │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ INGREDIENTS & SPECIFICATIONS                                 │
│                                                               │
│ Nutrition Facts (per 5g serving):                           │
│ • Protein: 4.5g                                             │
│ • Collagen Peptides: 5g (100%)                              │
│ • Amino Acids: [breakdown table]                            │
│                                                               │
│ Ingredients:                                                 │
│ 100% Bovine Hydrolyzed Collagen Peptides (Type I)           │
│ No fillers, no additives                                    │
│                                                               │
│ Allergen Info: May contain traces of... [etc]               │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ REVIEWS & RATINGS                                            │
│                                                               │
│ Overall Rating: 4.85/5 from 427 verified reviews            │
│                                                               │
│ Rating Breakdown:                                            │
│ ★★★★★ 5 stars (250 reviews) ████████████░░ 59%             │
│ ★★★★☆ 4 stars (120 reviews) ███████░░░░░░░ 28%             │
│ ★★★☆☆ 3 stars (35 reviews)  ██░░░░░░░░░░░░ 8%              │
│ ★★☆☆☆ 2 stars (15 reviews)  █░░░░░░░░░░░░░ 4%              │
│ ★☆☆☆☆ 1 star (7 reviews)    ░░░░░░░░░░░░░░ 2%              │
│                                                               │
│ Topic Breakdown:                                             │
│ Taste & Mixability: 4.7/5   Effectiveness: 4.9/5            │
│ Value: 4.6/5  Packaging: 4.8/5                              │
│                                                               │
│ Top Review:                                                  │
│ "Excellent collagen powder. Mixes well, noticeable..."     │
│ ★★★★★ John D. — Verified Purchase — 2 weeks ago           │
│                                                               │
│ [Load more reviews ▼]                                        │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ RELATED PRODUCTS & CROSS-SELLS                               │
│                                                               │
│ Works Well Together:                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │ Product Card │ │ Product Card │ │ Product Card │          │
│ │ (compact)    │ │ (compact)    │ │ (compact)    │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                               │
│ Customers Also Bought:                                       │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │ Product Card │ │ Product Card │ │ Product Card │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Key Elements**:
- Large image gallery (5+ images)
- Clear variant/size selectors
- Prominent CTA buttons (subscribe + one-time)
- Trust signals at purchase point (30-day guarantee, free shipping, lab-verified)
- Detailed specs and ingredient table
- Aggregated reviews with topic breakdown
- Related products and cross-sells

---

## 7. COMPONENT LIBRARY REFERENCE

See `COMPONENT_LIBRARY.md` for detailed component specs.

**Key Components to Implement**:
1. FilterPanel (sidebar or drawer)
2. SearchBar (navbar + modal results)
3. ProductCard (enhanced)
4. Quiz (personalization)
5. RelatedProducts (carousel)
6. ReviewSummary (rating breakdown)
7. TrustBadges (guarantee, certifications, validator)
8. BundleCard (multi-product)
9. BreadcrumbNav (category context)
10. PaginationControl (or LoadMoreButton)

---

## DESIGN SYSTEM UPDATES REQUIRED

### New CSS Classes
```css
.filter-panel { /* sidebar */ }
.search-modal { /* modal overlay */ }
.product-gallery { /* carousel */ }
.specs-table { /* ingredient table */ }
.review-breakdown { /* rating bars */ }
.related-products-carousel { /* carousel */ }
.trust-badge { /* cert badges */ }
.variant-selector { /* flavor/size dropdown */ }
.bundle-card { /* multi-product */ }
```

### New Tailwind Utilities (If Needed)
- `group-hover:` for card animations
- `line-clamp-` variants (already in use)
- `snap-scroll` for carousels
- `space-y-` and `gap-` utilities (already in use)

---

## ACCESSIBILITY CONSIDERATIONS

- All interactive elements should be keyboard-navigable
- Filter sidebar must be accessible via keyboard (Tab, Enter, Escape)
- Search modal should support keyboard (Enter to select, Escape to close)
- Image carousel should have aria-labels and keyboard controls
- Rating breakdown should use proper semantic HTML (<progress> or ARIA)
- Trust badges should have aria-labels explaining what they mean
- Links in footer should have clear, descriptive text (avoid "click here")

---

## RESPONSIVE BREAKPOINTS

- **Mobile**: <640px (1-column grids, full-width modals, hamburger menu)
- **Tablet**: 640px-1024px (2-column grids, sidebar optional)
- **Desktop**: 1024px+ (3-4 column grids, full sidebar, full navbar)

All designs should be mobile-first and progressively enhanced for larger screens.

---

## SUMMARY OF CHANGES

| Section | Current | Enhanced | Priority |
|---------|---------|----------|----------|
| Hero | 6 products + content | + quiz CTA + promo banner | P0 |
| Featured Grid | 6 products | 12 products + filters | P0 |
| Product Card | Basic | + specs + reviews + benefits | P0 |
| Collections | Flat grid | Sidebar filters + search + sort | P0 |
| Navbar | Flat links | Dropdowns + search + account | P0 |
| Product Detail | (Not reviewed) | Full specs + gallery + reviews | P1 |
| Footer | 12 links | 40-50 links, 5 columns | P2 |
| Bundles | None | New section (homepage) | P1 |
| Trust Signals | Generic | Guarantee + Trustpilot + customer count | P0 |
| Mobile | Basic responsive | Filter drawer + optimized menus | P1 |

---

**Wireframes created**: 7 major sections  
**Component specifications**: 10 new/enhanced components  
**Layout changes**: 5 pages redesigned  
**Priority distribution**: 13 P0, 7 P1, 4 P2 items
