/**
 * Sclero Proteins design tokens.
 *
 * Two-tier token system:
 *   1. PRIMITIVE (brand.*)     — raw brand colours from the logo, never use directly
 *                                  except for hero/marketing surfaces.
 *   2. SEMANTIC  (surface/text/border/state/accent) — what components reference.
 *
 * When a component needs a new visual treatment, ADD a semantic token here
 * rather than reaching for a raw brand-* class. Keeps cross-page consistency.
 *
 * Spacing follows Tailwind's default 4px scale + named container widths.
 * Typography follows a modular 1.125 ratio scale with the `.text-display/heading/body/caption` utilities defined in globals.css.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ----- PRIMITIVE: brand palette (essence — warm neutrals + ink + bronze) -----
           The legacy purple/indigo names are kept as ALIASES so existing
           components keep compiling, but they now resolve to the essence
           palette. New code should use the semantic tiers below. */
        brand: {
          bg: "#FAFAF7",           // warm off-white canvas
          card: "#FFFFFF",
          purple: "#6E4F13",       // legacy alias → bronze ink (accent text)
          plum: "#A8791E",         // legacy alias → bronze
          indigo: "#1A1A1A",       // legacy alias → ink
          navy: "#1A1A1A",         // legacy alias → ink
          orange: "#A8791E",
          gold: "#A8791E",
          accent: "#A8791E",       // bronze accent
          success: "#10B981",
          danger: "#EF4444",
          warning: "#B45309",
          info: "#3B82F6",
          text: "#1A1A1A",
          muted: "#4A4A4A",
          hairline: "#E8E6E1",
        },
        amber: {
          50: "#FBF7EE",
          100: "#F3EAD5",
          400: "#C89838",
          500: "#A8791E",
          600: "#8A6318",
        },
        /* ----- SEMANTIC: surface tiers ----- */
        surface: {
          DEFAULT: "#FFFFFF",       // primary card / app body
          subtle:  "#FAFAF7",       // page canvas (warm off-white)
          muted:   "#F3F1EA",       // input + form chips / secondary bands
          inverse: "#1A1A1A",       // dark band header / footer
          overlay: "rgba(20,20,20,0.5)", // modal / drawer backdrop
        },
        /* ----- SEMANTIC: text tiers (AA-compliant on white) ----- */
        ink: {
          primary:   "#1A1A1A",     // body — near-black ink
          secondary: "#4A4A4A",     // supporting copy
          muted:     "#6E6A61",     // warm grey — captions, kickers
          subtle:    "#8A857A",     // faint meta text
          inverse:   "#FFFFFF",     // text on dark surfaces
          accent:    "#6E4F13",     // bronze ink — 7:1 on white
          danger:    "#B91C1C",     // 7.1:1 on white
          success:   "#047857",     // 6.5:1 on white
        },
        /* ----- SEMANTIC: borders & dividers ----- */
        edge: {
          subtle:  "#EFEDE8",
          DEFAULT: "#E8E6E1",
          strong:  "#D6D2C7",
          focus:   "#A8791E",
        },
      },
      fontFamily: {
        sans:    ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Cormorant Garamond", "Georgia", "serif"],
        body:    ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      /* Modular type scale — 1.125 ratio anchored at 16px (1rem).
         Use the `.text-display/heading-N/body/caption` utilities in globals.css
         rather than these raw sizes for consistent line-height + tracking. */
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],      // 11px
        xs:    ['0.75rem',  { lineHeight: '1.125rem' }],   // 12px
        sm:    ['0.875rem', { lineHeight: '1.375rem' }],   // 14px
        base:  ['1rem',     { lineHeight: '1.625rem' }],   // 16px
        lg:    ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
        xl:    ['1.25rem',  { lineHeight: '1.875rem' }],   // 20px
        '2xl': ['1.5rem',   { lineHeight: '2rem', letterSpacing: '-0.01em' }],     // 24px
        '3xl': ['1.875rem', { lineHeight: '2.375rem', letterSpacing: '-0.015em' }],// 30px
        '4xl': ['2.25rem',  { lineHeight: '2.625rem', letterSpacing: '-0.02em' }], // 36px
        '5xl': ['3rem',     { lineHeight: '3.25rem', letterSpacing: '-0.025em' }], // 48px
        '6xl': ['3.75rem',  { lineHeight: '3.875rem', letterSpacing: '-0.03em' }], // 60px
      },
      letterSpacing: {
        luxe: "0.22em",
      },
      borderRadius: {
        /* Named radius scale — essence favours crisp, quiet corners. */
        xs:   "3px",    // tags, mini-pills
        sm:   "4px",    // inputs, small buttons
        md:   "6px",    // cards, buttons
        lg:   "8px",    // larger cards / modals
        xl:   "10px",   // hero cards
        '2xl': "12px",  // panels
        '3xl': "16px",  // splash modals
        pill: "9999px",
      },
      boxShadow: {
        /* Soft, neutral elevation — no colour cast. Use only
           `card`/`elevated`/`overlay` in components. */
        card:     "0 1px 2px rgba(20,20,20,0.04), 0 8px 24px -12px rgba(20,20,20,0.08)",
        elevated: "0 1px 2px rgba(20,20,20,0.04), 0 16px 40px -16px rgba(20,20,20,0.12)",
        overlay:  "0 8px 28px -8px rgba(20,20,20,0.16), 0 24px 60px -28px rgba(20,20,20,0.3)",
        focus:    "0 0 0 3px rgba(168,121,30,0.28)",
        luxe:     "0 1px 2px rgba(20,20,20,0.04), 0 16px 40px -16px rgba(20,20,20,0.12)",
        "luxe-lg":"0 2px 4px rgba(20,20,20,0.04), 0 28px 60px -24px rgba(20,20,20,0.16)",
        "amber-glow":"0 8px 24px -8px rgba(168,121,30,0.3)",
        "purple-glow":"0 10px 30px -10px rgba(20,20,20,0.2)",
      },
      backgroundImage: {
        'brand-gradient':      'linear-gradient(135deg, #2A2A28 0%, #1A1A1A 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #33312C 0%, #1A1A1A 100%)',
        'gold-gradient':       'linear-gradient(135deg, #C89838 0%, #A8791E 100%)',
        'light-gradient':      'linear-gradient(180deg, #FAFAF7 0%, #FFFFFF 100%)',
      },
      maxWidth: {
        /* Named container widths so every page wraps at the same column. */
        container:        "80rem",   // 1280px
        'container-wide': "90rem",   // 1440px — admin, dashboards
        'container-narrow': "48rem", // 768px — article body
        prose:             "65ch",
      },
      transitionTimingFunction: {
        'out-quint':  'cubic-bezier(0.22, 1, 0.36, 1)',
        'out-back':   'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in':     'fadeIn 0.25s ease-out',
        'slide-up':    'slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-right':'slideInRight 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        /* Full-width drawer entrances (panels sliding from fully off-screen) */
        'drawer-in-left':  'drawerInLeft 0.25s ease-out',
        'drawer-in-right': 'drawerInRight 0.25s ease-out',
      },
      keyframes: {
        fadeIn:        { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp:       { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        slideInRight:  { '0%': { opacity: 0, transform: 'translateX(24px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
        slideInLeft:   { '0%': { opacity: 0, transform: 'translateX(-24px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
        drawerInLeft:  { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
        drawerInRight: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}
