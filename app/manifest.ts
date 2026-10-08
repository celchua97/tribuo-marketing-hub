import type { MetadataRoute } from 'next'

// Lets people add the Hub to their phone's home screen so it opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tribuo Hub',
    short_name: 'Hub',
    description: 'The Tribuo marketing team’s tools in one place',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f3eb',
    theme_color: '#3750ab',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
