export const DEFAULT_HOMEPAGE_SETTINGS = {
  seo: {
    metaTitle: 'Premium Collagen, Joint Support & Wellness Supplements',
    metaDescription:
      'Shop Sclero Proteins for premium collagen, bone and joint support, and science-led wellness supplements with transparent labels, trusted quality, and delivery across the UK and India.',
    keywords:
      'premium collagen supplements, joint support supplements, bone health supplements, wellness supplements UK, wellness supplements India, Sclero Proteins',
  },
  highlightStrip: {
    enabled: true,
    items: [
      { label: 'Science-led formulations', icon: 'FlaskConical' },
      { label: 'Naturally sourced actives', icon: 'Leaf' },
      { label: 'Transparent quality standards', icon: 'ShieldCheck' },
      { label: 'Built for everyday vitality', icon: 'Sparkles' },
    ],
  },
  trustSection: {
    enabled: true,
    kicker: 'Why shoppers choose Sclero',
    title: 'Simple wellness support you can trust.',
    description:
      'Clear products, honest information, and a smoother way to shop.',
    cards: [
      {
        title: 'Lab tested',
        description: 'Quality you can understand quickly.',
        icon: 'FlaskConical',
      },
      {
        title: 'Premium quality',
        description: 'Clean, thoughtful formulations.',
        icon: 'ShieldCheck',
      },
      {
        title: 'Fast regional fulfilment',
        description: 'Easy delivery in the UK and India.',
        icon: 'Truck',
      },
    ],
  },
  productShowcase: {
    enabled: true,
    kicker: 'Product Highlights',
    title: 'Shop bestsellers and new arrivals with ease.',
    description:
      'Everything important is grouped into one simple product area.',
    highlights: [
      {
        title: 'Focused',
        description: 'Less clutter, clearer browsing.',
      },
      {
        title: 'Faster',
        description: 'Switch between key product groups quickly.',
      },
      {
        title: 'Product-first',
        description: 'A smoother path to purchase.',
      },
    ],
    tabs: [
      {
        key: 'bestsellers',
        label: 'Explore Our Bestsellers',
        subtitle: 'Our most-loved products, chosen again and again for everyday wellness support.',
        apiSort: 'bestseller',
        limit: 4,
      },
      {
        key: 'latest',
        label: 'Check Our Latest Arrivals',
        subtitle: 'Fresh additions to the collection with the same premium, easy-to-understand presentation.',
        apiSort: 'newest',
        limit: 4,
      },
    ],
    ctaLabel: 'Shop the full collection',
    ctaUrl: '/products',
  },
  quizSection: {
    enabled: true,
    kicker: 'Product Match Quiz',
    title: 'Need help choosing the right product?',
    description:
      'Answer a few simple questions and we will guide you toward the product that best fits your goals, routine, and preferences.',
    cardDescription: 'A quick, friendly way for first-time shoppers to narrow down the best fit.',
    buttonLabel: 'Start Quiz',
    icon: 'HeartHandshake',
    content: {
      questionLabel: 'Question',
      ofLabel: 'of',
      backLabel: 'Back',
      nextLabel: 'Next',
      recommendationLabel: 'Get Recommendation',
      resultTitle: 'Perfect Match Found!',
      resultDescription: 'Based on your answers, we found the ideal product for you',
      matchLabel: 'Match',
      addToCartLabel: 'Add to Cart',
      startOverLabel: 'Start Over',
      preferencesLabel: 'Your Preferences',
      steps: [
        {
          id: 'goal',
          title: "What's your primary health goal?",
          subtitle: 'Help us recommend the best products for you',
          options: [
            { value: 'beauty', label: 'Skin, Hair & Nails', icon: '✨', description: 'Glow, strength & elasticity' },
            { value: 'joints', label: 'Joints & Mobility', icon: '💪', description: 'Comfort & flexibility' },
            { value: 'overall', label: 'Overall Health', icon: '❤️', description: 'General wellness & vitality' },
            { value: 'recovery', label: 'Active Recovery', icon: '🏃', description: 'Post-workout support' },
          ],
        },
        {
          id: 'timeframe',
          title: 'When do you want to see results?',
          subtitle: 'Collagen works best with consistency',
          options: [
            { value: '4-8weeks', label: '4-8 weeks', icon: '⚡', description: 'Fast-track results' },
            { value: '8-12weeks', label: '8-12 weeks', icon: '📅', description: 'Standard timeline (recommended)' },
            { value: '12+weeks', label: '12+ weeks', icon: '🌱', description: 'Long-term commitment' },
          ],
        },
        {
          id: 'lifestyle',
          title: "What's your lifestyle like?",
          subtitle: 'This helps us match the right product format',
          options: [
            { value: 'active', label: 'Very Active', icon: '🏋️', description: 'Regular exercise & training' },
            { value: 'moderate', label: 'Moderately Active', icon: '🚴', description: 'Some movement & exercise' },
            { value: 'sedentary', label: 'Mostly Sedentary', icon: '🪑', description: 'Limited physical activity' },
          ],
        },
        {
          id: 'preferences',
          title: 'Any dietary preferences?',
          subtitle: "We'll find products that match your needs",
          options: [
            { value: 'vegan', label: 'Vegan', icon: '🌱', description: 'Plant-based only' },
            { value: 'gluten-free', label: 'Gluten-Free', icon: '🌾', description: 'No gluten' },
            { value: 'none', label: 'No Restrictions', icon: '✅', description: 'Open to all products' },
          ],
        },
      ],
      recommendations: [
        { key: 'beauty-8-active-none', sku: 'COMBO-COLLAGEN-60', name: 'Combo Collagen®', match: '95%', reason: 'Perfect for active beauty seekers on a standard timeline' },
        { key: 'beauty-8-active-vegan', sku: 'COMBO-COLLAGEN-60', name: 'Combo Collagen® (Vegan-Friendly)', match: '92%', reason: 'Best vegan option for beauty and activity' },
        { key: 'joints-8-active-none', sku: 'BJC-BONE-JOINT', name: 'BJC® Bone & Joint Care', match: '98%', reason: 'Specifically designed for active joint support' },
        { key: 'overall-8-moderate-none', sku: 'OVOSHELL-COLLAGEN-60', name: 'OvoShell Collagen™', match: '88%', reason: 'Comprehensive wellness formula for all-around health' },
        { key: 'recovery-8-active-none', sku: 'BJC-BONE-JOINT', name: 'BJC® Bone & Joint Care', match: '96%', reason: 'Ideal for post-workout recovery and muscle support' },
      ],
      fallbackRecommendation: {
        sku: 'COMBO-COLLAGEN-60',
        name: 'Combo Collagen®',
        match: '85%',
        reason: 'Great all-around collagen supplement',
      },
    },
  },
  chooseSection: {
    enabled: true,
    kicker: 'Why Choose Us',
    title: 'A shopping experience built to turn interest into confident purchases.',
    description:
      'Every part of the site is designed to help customers understand the benefits faster, compare products more confidently, and move to checkout with less hesitation.',
    cards: [
      {
        title: 'Science-led formulas',
        description: 'Products presented with clear benefits, practical explanations, and a more trustworthy buying journey.',
        icon: 'FlaskConical',
      },
      {
        title: 'Transparent labels',
        description: 'Simple product information helps customers compare options quickly and make better decisions.',
        icon: 'ShieldCheck',
      },
      {
        title: 'Everyday wellness support',
        description: 'Premium routines for joints, collagen, recovery, and daily support in one polished storefront.',
        icon: 'HeartHandshake',
      },
    ],
  },
  comparisonSection: {
    enabled: true,
    kicker: 'Sclero vs Others',
    title: 'A clearer, more trustworthy way to shop for wellness support.',
    description:
      'This comparison section helps shoppers understand why the Sclero experience feels more premium, more transparent, and easier to buy from.',
    headers: {
      left: 'What matters',
      middle: 'Sclero Proteins',
      right: 'Typical alternatives',
    },
    rows: [
      {
        label: 'Ingredient transparency',
        sclero: 'Clear benefit-led product positioning and easier-to-scan label guidance.',
        others: 'Labels often feel harder to compare across products and formats.',
      },
      {
        label: 'Shopping clarity',
        sclero: 'Simple navigation, focused product discovery, and guided choices.',
        others: 'Cluttered pages and less obvious product differentiation.',
      },
      {
        label: 'Regional support',
        sclero: 'Localized support for UK and India storefronts and buying flows.',
        others: 'More generic shopping experiences with less regional context.',
      },
      {
        label: 'Trust signals',
        sclero: 'Quality-led messaging, clearer reassurance, and stronger pre-purchase confidence.',
        others: 'Less consistent reassurance across the buying journey.',
      },
    ],
  },
  ingredientsSection: {
    enabled: true,
    kicker: 'Ingredient Highlights',
    title: 'Focused ingredients with benefits customers can actually understand.',
    description:
      'Key ingredient groups are presented in a simpler, friendlier format so shoppers can see the value faster and feel more confident about what they are buying.',
    imageUrl: '/home/ingredients-ovoshell.jpg',
    imageAlt:
      'OvoShell Collagen bottle and carton, showing the naturally formulated ingredient list: collagen types I, V and X, elastin, hyaluronic acid, chondroitin sulfate, glycosaminoglycans, peptides and amino acids',
    cards: [
      {
        title: 'Eggshell membrane',
        benefit: 'Supports cartilage comfort and joint mobility with clinically familiar actives.',
      },
      {
        title: 'Collagen peptides',
        benefit: 'Helps support connective tissue, skin structure, and daily recovery routines.',
      },
      {
        title: 'Targeted cofactors',
        benefit: 'Minerals and nutrient support chosen to complement structural wellness goals.',
      },
    ],
  },
  conversionSection: {
    enabled: true,
    kicker: 'Why Customers Convert',
    title: 'Premium support without the confusion or the clutter.',
    description:
      'The experience is designed to feel cleaner, easier to compare, and more reassuring from first impression to checkout.',
    primaryCtaLabel: 'Shop premium products',
    primaryCtaUrl: '/products',
    secondaryCtaLabel: 'Ask before you buy',
    secondaryCtaUrl: '/contact',
    badges: [
      { title: 'Quality-led', icon: 'ShieldCheck' },
      { title: 'Risk-aware support', icon: 'Shield' },
      { title: 'Trusted routines', icon: 'BadgeCheck' },
    ],
    proofLabel: 'Customer-style proof',
    quoteTitle: '“It feels like my wellness routine got an upgrade.”',
    quoteBody:
      'Clearer labels, easier comparison, and a more premium product story help turn curiosity into action.',
    proofSummary: 'Cleaner labels. Easier comparison. Stronger buying confidence.',
    proofHighlights: [
      { value: 'UK', label: 'Regional store support' },
      { value: 'IN', label: 'Localized checkout flow' },
      { value: 'Care', label: 'Pre-purchase guidance' },
    ],
  },
  faqSection: {
    enabled: true,
    kicker: 'Q&A',
    title: 'Questions shoppers ask before they buy.',
    description: 'Everything you need to know before you order.',
    items: [
      {
        question: 'How do I choose the right Sclero product for my goals?',
        answer:
          'Use the product quiz for a quick recommendation, or browse by benefit category if you already know whether you want joint support, collagen, or general recovery support.',
      },
      {
        question: 'Do you ship to both the UK and India?',
        answer:
          'Yes. The storefront supports both regions with localized pricing, taxes, and fulfilment rules so shoppers can browse and checkout with the correct regional settings.',
      },
      {
        question: 'Are your formulas third-party tested?',
        answer:
          'Our products are positioned around transparent, quality-led formulations with clear labeling and trust-building quality signals throughout the buying journey.',
      },
      {
        question: 'Can I contact someone before placing an order?',
        answer:
          'Yes. Use the inquiry form near the bottom of the page or reach out through the contact page if you want help choosing a product or understanding delivery details.',
      },
    ],
  },
  educationSection: {
    enabled: true,
    kicker: 'Education Center',
    title: 'Useful guides for better buying decisions.',
    description:
      'Explore practical content on ingredients, formulation standards, and supplement literacy so customers can shop with more confidence.',
    ctaLabel: 'Visit Learn',
    ctaUrl: '/blog',
    readLabel: 'Read guide',
    fallbackEntries: [
      {
        title: 'Understanding joint mobility nutrition',
        author: 'Sclero Advisory',
        description: 'A practical guide to collagen, cartilage support, and the cofactors that help them work together.',
      },
      {
        title: 'How to read supplement labels with confidence',
        author: 'Clinical Education',
        description: 'Learn how to spot filler-heavy formulas and compare active ingredient levels in minutes.',
      },
      {
        title: 'Why low-heat processing matters',
        author: 'Product Research',
        description: 'See how ingredient handling can affect the integrity of delicate protein structures.',
      },
    ],
  },
  instagramReels: {
    enabled: true,
    kicker: 'Follow our journey',
    title: 'Sclero Proteins on Instagram',
    description: 'Product stories, science-led wellness notes, and everyday routines from @scleroproteins.',
    profileUrl: 'https://www.instagram.com/scleroproteins/',
    reels: [],
  },
  inquirySection: {
    enabled: true,
    kicker: 'Need Help Choosing?',
    title: 'Have a question before you order?',
    description:
      'Ask about products, ingredients, delivery, or general support and our team will point you in the right direction.',
    successMessage: 'Thanks for reaching out. Our team will get back to you shortly.',
    buttonLabel: 'Submit inquiry',
    namePlaceholder: 'Your name',
    emailPlaceholder: 'Email address',
    messagePlaceholder: 'How can we help?',
    sendingLabel: 'Sending…',
    whatsappLabel: 'Chat with us',
  },
};

function mergeObject(defaultValue, incomingValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(incomingValue) ? incomingValue : defaultValue;
  }

  if (defaultValue && typeof defaultValue === 'object') {
    const next = { ...defaultValue };
    const source = incomingValue && typeof incomingValue === 'object' ? incomingValue : {};
    Object.keys(defaultValue).forEach((key) => {
      next[key] = mergeObject(defaultValue[key], source[key]);
    });
    return next;
  }

  return incomingValue ?? defaultValue;
}

export function normalizeHomepageSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  return mergeObject(DEFAULT_HOMEPAGE_SETTINGS, source);
}
