import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Lets the Slides import accept a PowerPoint file (Vercel's own limit is 4.5 MB)
    serverActions: { bodySizeLimit: '4mb' },
  },
}

export default nextConfig
