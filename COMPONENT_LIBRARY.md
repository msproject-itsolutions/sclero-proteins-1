# SCLERO PROTEINS — COMPONENT LIBRARY & SPECIFICATIONS
**Version**: 1.0  
**Date**: 2026-06-17  
**Technology**: React (Next.js), Tailwind CSS, Lucide Icons

---

## OVERVIEW

This document specifies new and enhanced components required to implement the design improvements outlined in `DESIGN_SPECIFICATIONS.md`.

**Component Categories**:
1. **Discovery**: FilterPanel, SearchBar, SearchResults
2. **Product Display**: EnhancedProductCard, ProductGallery, SpecsTable
3. **Collections**: PaginationControl, SortDropdown, BreadcrumbNav
4. **Product Detail**: ReviewSummary, RelatedProducts, BundleCard, VariantSelector
5. **Trust & Conversion**: TrustBadges, GuaranteeCard, SubscriptionBanner
6. **Quiz & Personalization**: QuizComponent, QuizResults
7. **Navigation**: NavDropdown, MobileMenuDrawer
8. **Footer**: FooterLink, SocialIcons

---

## 1. DISCOVERY COMPONENTS

### 1.1 FilterPanel Component

**File**: `components/FilterPanel.jsx`

**Props**:
```typescript
interface FilterPanelProps {
  filters: {
    category?: string[];
    healthGoal?: string[];
    priceRange?: string;
    dietary?: string[];
    supplySize?: string[];
  };
  onFilterChange: (filters: FilterState) => void;
  onClearAll: () => void;
  isOpen?: boolean; // For mobile drawer
  onClose?: () => void;
}
```

**Data Structure** (from API/config):
```javascript
const FILTER_OPTIONS = {
  category: [
    { id: 'all', label: 'All Products' },
    { id: 'collagen', label: 'Collagen & Peptides' },
    { id: 'whey', label: 'Whey Protein' },
    { id: 'plant', label: 'Plant-Based Protein' },
  ],
  healthGoal: [
    { id: 'joint-mobility', label: 'Joint & Mobility' },
    { id: 'muscle-gain', label: 'Muscle Gain & Recovery' },
    { id: 'bone-health', label: 'Bone Health' },
  ],
  priceRange: [
    { id: 'all', label: 'All Prices' },
    { id: '0-25', label: '£0 - £25' },
    { id: '25-50', label: '£25 - £50' },
    { id: '50+', label: '£50+' },
  ],
  dietary: [
    { id: 'vegan', label: 'Vegan', icon: '🌱' },
    { id: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
    { id: 'dairy-free', label: 'Dairy-Free', icon: '🥛' },
  ],
  supplySize: [
    { id: 'under-1kg', label: 'Under 1kg' },
    { id: '1-2kg', label: '1-2kg' },
    { id: '2kg+', label: '2kg+' },
  ],
};
```

**Layout** (Desktop):
```
┌─────────────────────┐
│ Filters             │
├─────────────────────┤
│                     │
│ Category        ▼   │ (Collapsible)
│ ○ All Products      │
│ ○ Collagen          │
│ ○ Whey              │
│                     │
│ Health Goal     ▼   │
│ ○ Joint & Mobility  │
│ ○ Muscle Gain       │
│                     │
│ Price           ▼   │
│ ○ All Prices        │
│ ○ £0-25             │
│ ○ £25-50            │
│                     │
│ Dietary         ▼   │
│ ☑ Vegan             │
│ ☐ Gluten-Free       │
│ ☐ Dairy-Free        │
│                     │
│ [Clear all filters] │
│                     │
└─────────────────────┘
```

**Layout** (Mobile Drawer):
```
┌────────────────────────┐
│ Filters        [✕ Close]│
├────────────────────────┤
│ Category            ▼   │
│ ○ All ○ Collagen ○ Whey │
│                         │
│ Health Goal         ▼   │
│ ○ All ○ Joint ○ Muscle  │
│                         │
│ [Apply] [Clear All]     │
│                         │
└────────────────────────┘
```

**Key Features**:
- Collapsible sections (expand/collapse each filter group)
- Applied filter count badge on parent headers
- "Clear all filters" button at bottom
- Immediate results update (not button-triggered)
- Smooth animations between states

**CSS Classes**:
```css
.filter-panel { @apply w-64 space-y-4; /* Desktop */ }
.filter-section { @apply border-b border-slate-200 pb-4; }
.filter-option { @apply flex items-center gap-2 cursor-pointer; }
.filter-count { @apply inline-block bg-brand-purple/10 text-brand-purple rounded-full px-2 text-xs font-bold; }
```

---

### 1.2 SearchBar Component

**File**: `components/SearchBar.jsx`

**Props**:
```typescript
interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  suggestions?: SearchSuggestion[];
  isLoading?: boolean;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
}

interface SearchSuggestion {
  id: string;
  label: string;
  type: 'product' | 'category' | 'goal';
  sku?: string;
  thumbnail?: string;
}
```

**Layout**:
```
Navbar:
┌──────────────────────────────────────────────┐
│ [🔍 Search products, SKU, ingredients...]    │
└──────────────────────────────────────────────┘

Focused/With Results:
┌──────────────────────────────────────────────┐
│ [🔍 coll                              [✕]    │
├──────────────────────────────────────────────┤
│ Collagen Peptides (Product)                  │
│ [thumb] Collagen Peptides | £42.99           │
│                                              │
│ Collagen + Vitamin C Blend (Product)         │
│ [thumb] Collagen + Vit C | £52.99            │
│                                              │
│ Collagen → (Category)                        │
│ "View all collagen products"                 │
│                                              │
│ [See all results →]                          │
│                                              │
└──────────────────────────────────────────────┘
```

**Key Features**:
- Debounced input (300ms)
- Real-time autocomplete suggestions
- Search across: product names, SKUs, benefits, ingredients
- Keyboard navigation (arrow keys, enter to select)
- Click-outside to close suggestions
- Mobile-optimized (full-width modal on small screens)

**Integration Points**:
- Navbar: Always visible, opens results in modal or dedicated page
- Collection page: Quick search within category
- Results page: `/search?q=collagen` shows all matching products

---

### 1.3 SearchResults Component

**File**: `components/SearchResults.jsx`

**Props**:
```typescript
interface SearchResultsProps {
  query: string;
  results: {
    products: Product[];
    categories: Category[];
    goals: HealthGoal[];
  };
  isLoading: boolean;
}
```

**Layout**:
```
Search Results for "collagen"

Showing 24 products (156 total)

[Apply Filters]  Sort: Relevance ▼

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Product Card │ │ Product Card │ │ Product Card │
└──────────────┘ └──────────────┘ └──────────────┘

[Load more ▼]

Categories Matching "collagen":
• Collagen & Peptides (45 products)
• Collagen Blends (12 products)

Health Goals:
• Joint & Mobility
• Bone Health
```

---

## 2. PRODUCT DISPLAY COMPONENTS

### 2.1 EnhancedProductCard Component

**File**: `components/EnhancedProductCard.jsx`

**Update to existing ProductCard.jsx**

**Props**:
```typescript
interface EnhancedProductCardProps {
  product: {
    id: string;
    sku: string;
    name: string;
    price: number;
    promotional_price?: number;
    average_rating: number;
    review_count: number;
    thumbnail: string;
    stock_available: number;
    specifications: {
      protein_per_serving?: string;
      container_size?: string;
      benefits: string[];
      dietary_badges: string[];
      flavor_count?: number;
    };
    brief_benefit: string;
  };
  onAddToCart: (product: Product) => void;
  onViewDetails: (sku: string) => void;
  variant?: 'standard' | 'compact' | 'featured';
}
```

**Layout** (Standard):
```
┌──────────────────────────────┐
│ [Image - hover zoom]         │ Stock Badge
│                              │
├──────────────────────────────┤
│ ★★★★★ 4.85/5 (427)          │ ← Real review count
│                              │
│ BJC® Collagen Peptides       │ ← Product name
│                              │
│ 10g protein | 2.2kg | Vegan  │ ← NEW: Specs line
│                              │
│ "Type I collagen for joint   │ ← NEW: Brief benefit
│  mobility"                   │
│                              │
│ £42.99  ~~£54.99~~           │ ← Price
│ (inc. VAT)                   │ ← NEW: Tax clarity
│                              │
│ [+ Add to Cart]              │ ← CTA
│ [View Details]               │
│                              │
│ Flavors: Vanilla, Chocolate  │ ← NEW: Variants
│ [See all →]                  │
│                              │
└──────────────────────────────┘
```

**Layout** (Compact - for related products carousels):
```
┌──────────────┐
│ [Image]      │
├──────────────┤
│ Product Name │
│ ★4.85 (427)  │
│ £42.99       │
│              │
│ [Add to Cart]│
│              │
└──────────────┘
```

**Key Updates from Current**:
1. Add `review_count` display (real numbers, not generic "verified reviews")
2. Add `specification` line: protein, size, dietary tags
3. Add `brief_benefit` statement (1-2 lines)
4. Add `(inc. VAT)` or `(inc. GST)` below price
5. Add variant/flavor indicator at bottom
6. Multiple layout variants (standard, compact, featured)

**CSS Changes**:
```css
.enhanced-product-card {
  @apply glass-panel glass-panel-hover relative flex flex-col justify-between 
         overflow-hidden rounded-3xl p-5 group;
}

.spec-line {
  @apply text-xs text-brand-muted flex items-center gap-2 flex-wrap;
}

.brief-benefit {
  @apply text-xs leading-relaxed text-brand-navy italic;
}

.dietary-badges {
  @apply flex gap-1 flex-wrap;
}

.dietary-badge {
  @apply inline-block px-2 py-1 rounded-full text-[10px] font-semibold 
         border border-slate-200 bg-slate-50;
}
```

---

### 2.2 ProductGallery Component

**File**: `components/ProductGallery.jsx`

**Props**:
```typescript
interface ProductGalleryProps {
  images: Image[];
  productName: string;
  onImageSelect?: (imageIndex: number) => void;
}

interface Image {
  id: string;
  url: string;
  alt: string;
  type: 'product' | 'lifestyle' | 'clinical' | 'packaging';
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│         MAIN IMAGE                   │
│                                      │
│    [Product photo with zoom]         │
│    ┌─────────────────────────────┐   │
│    │                             │   │
│    │     [Large Image]           │   │
│    │     (hover to zoom)         │   │
│    │                             │   │
│    └─────────────────────────────┘   │
│                                      │
│ [◄] Slide counter [►]   [Fullscreen]│
│                                      │
├──────────────────────────────────────┤
│  THUMBNAILS                          │
│ [T1] [T2] [T3] [T4] [T5] [T6]       │
│   ↑ Selected                         │
│                                      │
└──────────────────────────────────────┘
```

**Key Features**:
- Primary image carousel with left/right navigation
- Thumbnail strip (scrollable on mobile)
- Hover zoom on main image
- Touch-friendly swipe navigation on mobile
- Fullscreen/lightbox view option
- Image counter ("5 of 6")
- Lazy loading for thumbnails

**CSS Classes**:
```css
.product-gallery { @apply flex flex-col gap-4; }
.gallery-main { @apply relative overflow-hidden rounded-2xl bg-slate-50 aspect-square; }
.gallery-thumbnail { @apply h-20 w-20 rounded-lg cursor-pointer border-2 border-transparent hover:border-brand-purple; }
.gallery-zoom { @apply transition-transform duration-300 hover:scale-110; }
```

---

### 2.3 SpecsTable Component

**File**: `components/SpecsTable.jsx`

**Props**:
```typescript
interface SpecsTableProps {
  product: {
    name: string;
    nutrition_facts: {
      serving_size: string;
      servings_per_container: number;
      calories?: number;
      protein: string;
      carbs?: string;
      fat?: string;
      fiber?: string;
      sugar?: string;
      sodium?: string;
    };
    ingredient_list: string[];
    amino_acid_profile?: AminoAcid[];
    allergen_warnings: string[];
  };
  expanded?: boolean;
}

interface AminoAcid {
  name: string;
  amount: string;
}
```

**Layout**:
```
┌─────────────────────────────────────┐
│ NUTRITION FACTS                     │
├─────────────────────────────────────┤
│                                     │
│ Serving Size: 5g (1 scoop)          │
│ Servings Per Container: 22          │
│                                     │
│ Amount Per Serving:                 │
│ Calories: 20                        │
│ Protein: 4.5g                       │
│ Fat: 0.1g                           │
│ Carbs: 0g                           │
│ Fiber: 0g                           │
│ Sugar: 0g                           │
│ Sodium: 120mg                       │
│                                     │
│ Amino Acid Profile (per 5g):        │
│ Glycine: 2.1g                       │
│ Proline: 1.2g                       │
│ Hydroxyproline: 0.9g                │
│ [... 16 more amino acids]           │
│                                     │
├─────────────────────────────────────┤
│ INGREDIENTS                         │
├─────────────────────────────────────┤
│                                     │
│ 100% Bovine Hydrolyzed Collagen     │
│ Peptides (Type I)                   │
│                                     │
│ Contains: No major allergens        │
│ May Contain: Traces of tree nuts    │
│ (processed in facility)             │
│                                     │
│ Manufactured in a GMP facility      │
│ Third-party tested for purity       │
│                                     │
└─────────────────────────────────────┘
```

**Key Features**:
- Expandable nutrition facts table
- Amino acid profile breakdown
- Allergen warnings (prominent)
- Manufacturing notes
- Clean, scannable format

---

## 3. COLLECTION COMPONENTS

### 3.1 SortDropdown Component

**File**: `components/SortDropdown.jsx`

**Props**:
```typescript
interface SortDropdownProps {
  currentSort: string;
  onSortChange: (sortType: string) => void;
  options?: SortOption[];
}

interface SortOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}
```

**Default Options**:
```javascript
const DEFAULT_SORT_OPTIONS = [
  { id: 'popularity', label: 'Popularity', icon: '⭐' },
  { id: 'newest', label: 'Newest', icon: '✨' },
  { id: 'price-low', label: 'Price: Low to High', icon: '💰' },
  { id: 'price-high', label: 'Price: High to Low', icon: '💸' },
  { id: 'rating', label: 'Highest Rated', icon: '⭐⭐⭐⭐⭐' },
];
```

**Layout**:
```
Sort: [Popularity ▼]

Dropdown:
───────────────────
⭐ Popularity
✨ Newest
💰 Price: Low → High
💸 Price: High → Low
⭐⭐⭐ Highest Rated
```

---

### 3.2 PaginationControl Component

**File**: `components/PaginationControl.jsx`

**Props** (Two patterns supported):
```typescript
// Pattern A: "Load More" Button
interface LoadMoreProps {
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  pageSize: number;
  totalCount: number;
}

// Pattern B: Traditional Pagination
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalCount: number;
}
```

**Layout A** (Load More - Recommended):
```
Showing 24 of 156 products

     [Load more products ▼]
```

**Layout B** (Pagination):
```
Showing 1-24 of 156 products

[← Previous] [1] [2] [3] [4] [5] ... [Next →]
```

**Key Features**:
- Load more is simpler and mobile-friendly
- Pagination needed only if 5+ pages
- Show product count feedback
- Disable buttons appropriately

---

### 3.3 BreadcrumbNav Component

**File**: `components/BreadcrumbNav.jsx`

**Props**:
```typescript
interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
}

interface BreadcrumbItem {
  label: string;
  href?: string;
  isActive?: boolean;
}
```

**Layout**:
```
Home > Products > Collagen > All Collagen Products

or if on detail:

Home > Products > Collagen > BJC® Collagen Peptides
```

**Key Features**:
- Mobile: collapse to "Home > Current page"
- Desktop: show full path
- Last item not clickable (current page)
- Use "/" or ">" as separator
- Schema markup for SEO

---

## 4. PRODUCT DETAIL COMPONENTS

### 4.1 ReviewSummary Component

**File**: `components/ReviewSummary.jsx`

**Props**:
```typescript
interface ReviewSummaryProps {
  product: {
    average_rating: number;
    total_reviews: number;
    rating_breakdown: RatingBreakdown[];
    topic_breakdown: TopicBreakdown[];
    sample_reviews: Review[];
  };
}

interface RatingBreakdown {
  stars: number;
  count: number;
  percentage: number;
}

interface TopicBreakdown {
  topic: string;
  rating: number;
  percentage: number;
}

interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  title?: string;
  content: string;
  verified_purchase: boolean;
  helpful_count?: number;
}
```

**Layout**:
```
┌─────────────────────────────────────┐
│ CUSTOMER REVIEWS                    │
├─────────────────────────────────────┤
│                                     │
│ Overall Rating                      │
│ ★★★★★ 4.85/5 from 427 reviews      │
│                                     │
│ Rating Breakdown:                   │
│ ★★★★★ (250) ███████░░░░ 59%        │
│ ★★★★☆ (120) ████░░░░░░░ 28%        │
│ ★★★☆☆ (35)  █░░░░░░░░░░ 8%         │
│ ★★☆☆☆ (15)  ░░░░░░░░░░░ 4%         │
│ ★☆☆☆☆ (7)   ░░░░░░░░░░░ 2%         │
│                                     │
│ Topic Breakdown:                    │
│ Taste & Mixability: 4.7/5 ██████░░  │
│ Effectiveness: 4.9/5 ███████░░░░░   │
│ Value: 4.6/5 ██████░░░░░░           │
│ Packaging: 4.8/5 ███████░░░░░░      │
│                                     │
├─────────────────────────────────────┤
│ TOP REVIEW                          │
│                                     │
│ ★★★★★ John D.                      │
│ "Excellent collagen. Mixes well,    │
│  noticeable improvements in joint   │
│  comfort."                          │
│ ✓ Verified Purchase • 2 weeks ago   │
│ Helpful (12)                        │
│                                     │
│ [Load more reviews ▼]               │
│                                     │
└─────────────────────────────────────┘
```

**Key Features**:
- Aggregate rating with review count
- Visual rating breakdown (progress bars)
- Topic-based breakdown (if data available)
- Sample reviews with verification badge
- Helpful vote tracking
- Link to full reviews page

---

### 4.2 RelatedProducts Component

**File**: `components/RelatedProducts.jsx`

**Props**:
```typescript
interface RelatedProductsProps {
  currentProduct: Product;
  products: Product[];
  relation_type: 'works_well_with' | 'customers_also_bought' | 'same_category';
  maxProducts?: number;
}
```

**Layout**:
```
┌──────────────────────────────────────────┐
│ WORKS WELL TOGETHER                      │
│ "Pair with other complementary products" │
├──────────────────────────────────────────┤
│                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Product  │ │ Product  │ │ Product  │ │
│ │ Card     │ │ Card     │ │ Card     │ │
│ │ (compact)│ │ (compact)│ │ (compact)│ │
│ └──────────┘ └──────────┘ └──────────┘ │
│                                          │
│       [◄] Carousel [►]                   │
│                                          │
└──────────────────────────────────────────┘
```

**Key Features**:
- Horizontal carousel (scrollable on mobile)
- 3-4 product cards per view
- Related product algorithm (configured per product)
- Touch-swipe navigation on mobile
- Keyboard navigation (arrow keys)

---

### 4.3 VariantSelector Component

**File**: `components/VariantSelector.jsx`

**Props**:
```typescript
interface VariantSelectorProps {
  product: Product;
  available_variants: Variant[];
  selected_variant: string;
  onVariantSelect: (variant: Variant) => void;
}

interface Variant {
  id: string;
  type: 'flavor' | 'size' | 'format';
  label: string;
  option: string;
  available: boolean;
  price_adjustment?: number;
}
```

**Layout** (Flavor Dropdown):
```
Flavor: [Vanilla ▼]

Dropdown:
───────────────────
Vanilla (£42.99)
Chocolate (£42.99)
Strawberry (£42.99) [Out of stock]
```

**Layout** (Size Selector):
```
Size:
[1kg] [2.2kg] [5kg]
 ○    ●      ○

Price: £42.99
(Select size for price update)
```

**Key Features**:
- Dropdown or button-group UI (configurable)
- Show stock status per variant
- Price adjustments if different sizes cost more
- Visual feedback (highlight selected)

---

### 4.4 BundleCard Component

**File**: `components/BundleCard.jsx`

**Props**:
```typescript
interface BundleCardProps {
  bundle: {
    id: string;
    name: string;
    description: string;
    products: Product[];
    regular_price: number;
    bundle_price: number;
    discount_percentage: number;
    image: string;
  };
  onAddToCart: (bundle: Bundle) => void;
}
```

**Layout** (Homepage):
```
┌──────────────────────────────┐
│ [Bundle Image]               │
├──────────────────────────────┤
│ Complete Joint Care Bundle   │
│                              │
│ Includes:                    │
│ • BJC® Collagen (2.2kg)      │
│ • Joint Mobility Blend (1kg) │
│ • Vitamin D3 (120 softgels)  │
│                              │
│ Regular: £134.99             │
│ Bundle:  £99.99              │
│ Save 26%                     │
│                              │
│ [+ Add Bundle to Cart]       │
│                              │
└──────────────────────────────┘
```

**Layout** (Compact - Featured section):
```
┌──────────┐
│ Bundle   │
│ Image    │
├──────────┤
│ Bundle   │
│ Name     │
│ 3 items  │
│ Save 26% │
│ £99.99   │
│ [Add]    │
└──────────┘
```

---

## 5. TRUST & CONVERSION COMPONENTS

### 5.1 TrustBadges Component

**File**: `components/TrustBadges.jsx`

**Props**:
```typescript
interface TrustBadgesProps {
  badges: Badge[];
  layout?: 'horizontal' | 'vertical' | 'grid';
  showTooltips?: boolean;
}

interface Badge {
  id: string;
  type: 'certification' | 'validator' | 'guarantee' | 'award';
  label: string;
  icon: string | React.ReactNode;
  description?: string;
  verified_url?: string;
}
```

**Default Badges for Sclero**:
```javascript
const TRUST_BADGES = [
  {
    id: 'gmp',
    type: 'certification',
    label: 'GMP Certified',
    icon: '✓',
    description: 'Manufactured in GMP-compliant facilities',
  },
  {
    id: 'iso22000',
    type: 'certification',
    label: 'ISO 22000',
    icon: '✓',
    description: 'Food safety management system',
  },
  {
    id: 'lab-tested',
    type: 'certification',
    label: 'Lab Tested',
    icon: '🔬',
    description: 'Third-party verified for purity & potency',
  },
  {
    id: 'trustpilot',
    type: 'validator',
    label: 'Trustpilot',
    icon: '[Trustpilot logo]',
    description: '4.8/5 from 3,247 reviews',
    verified_url: 'https://trustpilot.com/...',
  },
  {
    id: 'money-back',
    type: 'guarantee',
    label: '30-Day Guarantee',
    icon: '💰',
    description: 'Full refund if not satisfied',
  },
];
```

**Layout** (Horizontal):
```
┌─────────────────────────────────────────┐
│ ✓ GMP | ✓ ISO 22000 | 🔬 Lab Tested | 💰 Guarantee │
└─────────────────────────────────────────┘
```

**Layout** (Vertical - Homepage Trust Section):
```
┌──────────────────────────────────────┐
│ TRUST & AUTHORITY                    │
├──────────────────────────────────────┤
│ • Trusted by 50,000+ customers       │
│ • [Trustpilot] 4.8/5 from 3,247 reviews │
│ • 30-Day Money-Back Guarantee        │
│ • Lab verified for purity & potency  │
└──────────────────────────────────────┘
```

**Key Features**:
- Clickable badges show tooltips/explanations
- Verified URLs for certifications
- Icons + text for accessibility
- Multiple layout options (horizontal, vertical, grid)
- Trustpilot integration (if applicable)

---

### 5.2 GuaranteeCard Component

**File**: `components/GuaranteeCard.jsx`

**Props**:
```typescript
interface GuaranteeCardProps {
  guarantee_type: 'money_back' | 'satisfaction' | 'quality';
  days: number;
  description: string;
  terms_url?: string;
}
```

**Layout** (Banner):
```
┌────────────────────────────────────────┐
│ 💰 30-Day Money-Back Guarantee         │
│ Not satisfied? Full refund, no         │
│ questions asked.                       │
│ [Full Terms] [Easy Returns]            │
└────────────────────────────────────────┘
```

**Layout** (Product Detail):
```
┌────────────────────────────────────────┐
│ RISK-FREE PURCHASE                     │
│                                        │
│ ✓ 30-Day Money-Back Guarantee          │
│   If you're not completely satisfied,  │
│   we'll refund your entire purchase.   │
│                                        │
│ ✓ Free Returns                         │
│   Prepaid return label included        │
│                                        │
│ ✓ No Questions Asked                   │
│   We stand behind our products.        │
│                                        │
│ [View Full Terms & Conditions]         │
│                                        │
└────────────────────────────────────────┘
```

---

### 5.3 SubscriptionBanner Component

**File**: `components/SubscriptionBanner.jsx`

**Props**:
```typescript
interface SubscriptionBannerProps {
  discount_percentage: number;
  recurrence_frequency: string[];
  description?: string;
  onEnable: (frequency: string) => void;
}
```

**Layout**:
```
┌──────────────────────────────────────┐
│ 🔔 Subscribe & Save 20%              │
│                                      │
│ Get 20% off this order + all future  │
│ deliveries. Cancel anytime.          │
│                                      │
│ Delivery every:                      │
│ ( ) 2 weeks  ( ) 4 weeks ( ) 8 weeks │
│                                      │
│ [Enable Subscription] [More info]    │
│                                      │
└──────────────────────────────────────┘
```

**Key Features**:
- Only show if subscription model enabled
- Clear frequency options
- Cancellation assurance messaging
- Toggle between subscription and one-time

---

## 6. QUIZ & PERSONALIZATION COMPONENTS

### 6.1 QuizComponent

**File**: `components/QuizComponent.jsx`

**Props**:
```typescript
interface QuizComponentProps {
  onComplete: (results: QuizResults) => void;
  theme?: 'modal' | 'page' | 'hero';
}

interface QuizResults {
  primaryGoal: string;
  secondaryGoals: string[];
  dietary_preferences: string[];
  budget_range: string;
  recommended_products: Product[];
}
```

**Quiz Flow** (Example):
```
Step 1 of 4
───────────────────────
"What's your primary goal?"

( ) Joint & Mobility
( ) Muscle Gain & Recovery
( ) Bone Health
( ) Athletic Performance
( ) General Wellness

[Next →]


Step 2 of 4
───────────────────────
"Any dietary preferences?"

☑ Vegan
☐ Gluten-Free
☐ Dairy-Free
☐ Keto-Friendly

[Back] [Next →]


Step 3 of 4
───────────────────────
"What's your typical monthly budget?"

( ) Under £25
( ) £25-50
( ) £50-100
( ) £100+
( ) No budget limit

[Back] [Next →]


Step 4 of 4
───────────────────────
"Secondary goals?" (Optional)

☑ Better Sleep
☐ Clearer Skin
☐ More Energy
☐ Gut Health

[Back] [Show My Results →]


RESULTS
───────────────────────
"Based on your preferences, we recommend:"

[Recommended products grid]

[Browse All] [Save My Preferences]
```

**Key Features**:
- Progress indicator (Step X of Y)
- Progress bar showing completion
- Back/Next navigation
- Optional questions (can skip)
- Results show recommended products
- Save preferences to user account
- Pre-populate filters based on quiz results
- Mobile-optimized (full-screen on small screens)

---

## 7. NAVIGATION COMPONENTS

### 7.1 NavDropdown Component

**File**: `components/NavDropdown.jsx`

**Props**:
```typescript
interface NavDropdownProps {
  label: string;
  items: NavItem[];
  featured_items?: NavFeaturedItem[];
  columns?: number;
}

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string;
}

interface NavFeaturedItem {
  label: string;
  items: NavItem[];
  icon?: React.ReactNode;
}
```

**Layout** (Products Dropdown):
```
Products ▼

┌─────────────────────────────────────┐
│                                     │
│ All Products                        │
│ By Ingredient                       │
│   ├─ Collagen & Peptides           │
│   ├─ Whey Protein                  │
│   ├─ Plant-Based                   │
│   └─ ...                           │
│                                     │
│ By Health Goal                      │
│   ├─ Joint & Mobility              │
│   ├─ Muscle Gain                   │
│   ├─ Bone Health                   │
│   └─ ...                           │
│                                     │
│ Bundles & Offers                    │
│                                     │
└─────────────────────────────────────┘
```

**Key Features**:
- Multi-column layout for large menus
- Keyboard navigation (arrow keys, enter, escape)
- Mouse hover to show/hide
- Mobile-friendly (becomes drawer on small screens)
- Category icons (optional)
- Badges for "New," "Popular," etc.

---

### 7.2 MobileMenuDrawer Component

**File**: `components/MobileMenuDrawer.jsx`

**Props**:
```typescript
interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
}
```

**Layout**:
```
┌────────────────────────┐
│ ✕ Sclero Proteins      │
├────────────────────────┤
│ [🔍 Search...]         │
├────────────────────────┤
│ Products           ▼   │
│  ├─ All Products       │
│  ├─ By Ingredient      │
│  └─ By Health Goal     │
│                        │
│ Learn              ▼   │
│  ├─ Science & Standards│
│  ├─ Blog Insights      │
│  └─ FAQs               │
│                        │
│ Wholesale              │
│                        │
│ 🌐 United Kingdom ✓    │
│   India                │
│                        │
│ 👤 My Account / Login  │
│                        │
└────────────────────────┘
```

**Key Features**:
- Slide-in drawer from left
- Search bar at top
- Collapsible menu sections
- Region selector
- Account/login link
- Close button or swipe-to-close
- Focus trap (keyboard nav stays within drawer)

---

## 8. FOOTER COMPONENTS

### 8.1 FooterSection Component

**File**: `components/FooterSection.jsx`

**Props**:
```typescript
interface FooterSectionProps {
  title: string;
  items: FooterLink[];
  columns?: number;
}

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
  icon?: React.ReactNode;
}
```

**Layout**:
```
┌─────────────────────────────────────┐
│ SHOP                                │
├─────────────────────────────────────┤
│ • All Products                      │
│ • By Ingredient                     │
│ • By Health Goal                    │
│ • Bundles & Offers                  │
│ • My Account                        │
└─────────────────────────────────────┘
```

---

### 8.2 SocialIcons Component

**File**: `components/SocialIcons.jsx`

**Props**:
```typescript
interface SocialIconsProps {
  platforms: SocialPlatform[];
  variant?: 'icon-only' | 'icon-text' | 'text-only';
  size?: 'sm' | 'md' | 'lg';
}

interface SocialPlatform {
  name: string;
  url: string;
  icon: React.ReactNode;
}
```

**Layout** (Icon Only):
```
[f] [📷] [♪] [in]
```

**Layout** (With Text):
```
Follow us:
[f] Facebook  [📷] Instagram  [♪] TikTok  [in] LinkedIn
```

---

## COMPONENT INTEGRATION GUIDE

### Import Example (ProductCard Enhanced)
```tsx
import EnhancedProductCard from '@/components/EnhancedProductCard';

<EnhancedProductCard
  product={product}
  onAddToCart={handleAddToCart}
  onViewDetails={handleViewDetails}
  variant="standard"
/>
```

### State Management (Redux)
```typescript
// slices/filterSlice.js
export const filterSlice = createSlice({
  name: 'filters',
  initialState: {
    category: [],
    healthGoal: [],
    priceRange: 'all',
    dietary: [],
    supplySize: [],
  },
  reducers: {
    updateFilters: (state, action) => {
      return { ...state, ...action.payload };
    },
    clearFilters: () => filterSlice.initialState,
  },
});
```

### API Integration (Search)
```typescript
// lib/api.js
export async function searchProducts(query: string) {
  const res = await fetch(
    `${API_BASE}/api/products/search?q=${encodeURIComponent(query)}`
  );
  return res.json();
}
```

---

## COMPONENT DEPENDENCY TREE

```
HomePage
├── HeroSection (existing, enhance)
├── PromotionalBanner (new)
├── QuizComponent (new)
├── ProductCatalog
│   └── FilterPanel (new)
│   └── SortDropdown (new)
│   └── EnhancedProductCard (update)
│       └── ProductGallery (for detail page)
├── RecommendedBundles (new)
│   └── BundleCard (new)
├── TrustBadges (new)
├── Navbar
│   └── SearchBar (new)
│   └── NavDropdown (new)
│   └── MobileMenuDrawer (new)
└── Footer (existing, enhance)
    └── FooterSection (new)
    └── SocialIcons (new)

ProductDetailPage
├── BreadcrumbNav (new)
├── ProductGallery (new)
├── VariantSelector (new)
├── SubscriptionBanner (new)
├── SpecsTable (new)
├── ReviewSummary (new)
├── RelatedProducts (new)
└── GuaranteeCard (new)

CollectionPage
├── BreadcrumbNav (new)
├── SearchBar (new)
├── FilterPanel (new)
├── SortDropdown (new)
├── EnhancedProductCard (update)
├── PaginationControl (new)
└── BreadcrumbNav (new)
```

---

## STYLING NOTES

- Use existing Tailwind classes where possible
- Add custom CSS classes for complex animations
- Follow current color scheme (brand-purple, brand-navy, etc.)
- Ensure WCAG 2.1 AA accessibility compliance
- Test on mobile (375px), tablet (768px), desktop (1440px)
- Use relative font sizes (rem, em) not fixed pixels
- Implement focus states for keyboard navigation
- Test with screen readers (NVDA, JAWS, VoiceOver)

---

## SUMMARY

**Total Components to Create/Enhance**: 24
- **Create**: 18 new components
- **Enhance**: 6 existing components

**Estimated Implementation Time**: 15-20 days (full team)
- FilterPanel & SearchBar: 3-4 days
- ProductCard enhancements: 1-2 days
- Product Detail components: 4-5 days
- Trust/Conversion components: 2-3 days
- Quiz Component: 2-3 days
- Navigation & Footer: 2-3 days
- Integration & Testing: 3-5 days

**Priority Order**:
1. FilterPanel, SearchBar, SortDropdown
2. EnhancedProductCard, ProductGallery
3. TrustBadges, GuaranteeCard
4. QuizComponent, RelatedProducts
5. VariantSelector, ReviewSummary
6. NavDropdown, MobileMenuDrawer
7. Footer enhancements

