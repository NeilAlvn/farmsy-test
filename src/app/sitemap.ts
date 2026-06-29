import type { MetadataRoute } from 'next'

const BASE_URL = 'https://farmsy.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // Public, indexable pages only — excludes auth, admin, dashboard,
  // account, and other gated/transactional routes.
  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/',         priority: 1.0, changeFrequency: 'weekly'  },
    { path: '/map',      priority: 0.9, changeFrequency: 'daily'   },
    { path: '/pricing',  priority: 0.8, changeFrequency: 'monthly' },
    { path: '/farmers',  priority: 0.7, changeFrequency: 'monthly' },
    { path: '/about',    priority: 0.6, changeFrequency: 'monthly' },
    { path: '/faq',      priority: 0.6, changeFrequency: 'monthly' },
    { path: '/messages', priority: 0.4, changeFrequency: 'yearly'  },
    { path: '/terms',    priority: 0.3, changeFrequency: 'yearly'  },
    { path: '/privacy',  priority: 0.3, changeFrequency: 'yearly'  },
  ]

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))
}
