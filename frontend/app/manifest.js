export default function manifest() {
  return {
    name: 'Sclero Proteins',
    short_name: 'Sclero Proteins',
    description: 'Shop Sclero Proteins products and manage your orders.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#101871',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
