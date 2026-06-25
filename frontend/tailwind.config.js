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
        /* ----- PRIMITIVE: brand palette (raw logo colours) ----- */
        brand: {
          bg: "#FAFAFB",
          card: "#FFFFFF",
          purple: "#6B46C1",
          plum: "#7A1F6E",
          indigo: "#1E2A78",
          navy: "#1D3557",
          orange: "#F59E0B",
          gold: "#D4A017",
          accent: "#6B46C1",
          success: "#10B981",
          danger: "#EF4444",
          warning: "#F59E0B",
          info: "#3B82F6",
          text: "#0F172A",
          muted: "#475569",
          hairline: "#ECECEF",
        },
        amber: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D4A017",
        },
        /* ----- SEMANTIC: surface tiers ----- */
        surface: {
          DEFAULT: "#FFFFFF",       // primary card / app body
          subtle:  "#FAFAFB",       // page canvas
          muted:   "#F4F6FB",       // input + form chips
          inverse: "#1D3557",       // dark band header / footer
          overlay: "rgba(15,23,42,0.55)", // modal / drawer backdrop
        },
        /* ----- SEMANTIC: text tiers (AA-compliant on white) ----- */
        ink: {
          primary:   "#0F172A",     // body — 17.5:1 on white (AAA)
          secondary: "#334155",     // 12.6:1 on white (AAA)
          muted:     "#475569",     // 7.5:1 on white (AAA)
          subtle:    "#64748B",     // 4.6:1 on white (AA for >=14px)
          inverse:   "#FFFFFF",     // text on dark surfaces
          accent:    "#6B46C1",     // 5.74:1 on white (AA for >=14px)
          danger:    "#B91C1C",     // 7.1:1 on white
          success:   "#047857",     // 6.5:1 on white
        },
        /* ----- SEMANTIC: borders & dividers ----- */
        edge: {
          subtle:  "#ECECEF",
          DEFAULT: "#E6EAF2",
          strong:  "#CBD5E1",
          focus:   "#6B46C1",
        },
      },
      fontFamily: {
        sans:    ["Outfit", "Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "system-ui", "sans-serif"],
        body:    ["Inter", "Outfit", "system-ui", "sans-serif"],
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
        luxe: "0.18em",
      },
      borderRadius: {
        /* Named radius scale — components reference these names instead of magic px. */
        xs:   "4px",    // tags, mini-pills
        sm:   "6px",    // inputs, small buttons
        md:   "10px",   // cards, buttons
        lg:   "14px",   // larger cards / modals
        xl:   "18px",   // hero cards
        '2xl': "22px",  // panels
        '3xl': "28px",  // splash modals
        pill: "9999px",
      },
      boxShadow: {
        /* Soft, purple-tinted elevation. Use only `card`/`elevated`/`overlay`
           in components — the others are legacy. */
        card:     "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px -4px rgba(31,42,68,0.08)",
        elevated: "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -12px rgba(107,70,193,0.14)",
        overlay:  "0 8px 28px -8px rgba(15,23,42,0.18), 0 24px 60px -28px rgba(15,23,42,0.32)",
        focus:    "0 0 0 3px rgba(107,70,193,0.32)",
        luxe:     "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -12px rgba(107,70,193,0.14)",
        "luxe-lg":"0 2px 4px rgba(15,23,42,0.04), 0 28px 60px -24px rgba(107,70,193,0.22)",
        "amber-glow":"0 8px 24px -8px rgba(245,158,11,0.45)",
        "purple-glow":"0 10px 30px -10px rgba(107,70,193,0.45)",
      },
      backgroundImage: {
        'brand-gradient':      'linear-gradient(135deg, #7A1F6E 0%, #6B46C1 45%, #1E2A78 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #6B46C1 0%, #1D3557 100%)',
        'gold-gradient':       'linear-gradient(135deg, #FBBF24 0%, #D4A017 100%)',
        'light-gradient':      'linear-gradient(180deg, #FAFAFB 0%, #FFFFFF 100%)',
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
      },
      keyframes: {
        fadeIn:        { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp:       { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        slideInRight:  { '0%': { opacity: 0, transform: 'translateX(24px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
        slideInLeft:   { '0%': { opacity: 0, transform: 'translateX(-24px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}
