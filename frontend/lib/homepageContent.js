export const DEFAULT_HOMEPAGE_SETTINGS = {
  seo: {
    metaTitle: 'Premium Collagen, Joint Support & Wellness Supplements',
    metaDescription:
      'Shop Sclero Proteins for premium collagen, bone and joint support, and science-led wellness supplements with transparent labels, trusted quality, and delivery across the UK and India.',
    keywords:
      'premium collagen supplements, joint support supplements, bone health supplements, wellness supplements UK, wellness supplements India, Sclero Proteins',
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
  },
  inquirySection: {
    enabled: true,
    kicker: 'Need Help Choosing?',
    title: 'Have a question before you order?',
    description:
      'Ask about products, ingredients, delivery, or general support and our team will point you in the right direction.',
    successMessage: 'Thanks for reaching out. Our team will get back to you shortly.',
    buttonLabel: 'Submit inquiry',
  },
};

function mergeObject(defaultValue, incomingValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(incomingValue) && incomingValue.length > 0 ? incomingValue : defaultValue;
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
