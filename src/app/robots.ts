import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/account/',
        '/dashboard/',
        '/auth/',
        '/subscription/',
      ],
    },
    sitemap: 'https://farmsy.app/sitemap.xml',
    host: 'https://farmsy.app',
  }
}
