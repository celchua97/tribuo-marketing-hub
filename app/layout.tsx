import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tribuo Hub',
  description: 'The Tribuo marketing team’s tools in one place',
  applicationName: 'Tribuo Hub',
  appleWebApp: { capable: true, title: 'Tribuo Hub', statusBarStyle: 'default' },
  icons: { apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3750ab',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
