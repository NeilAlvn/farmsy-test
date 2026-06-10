import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'nl', 'fr', 'de', 'es'] as const,
  defaultLocale: 'en',
  localePrefix: 'never',
})

export type Locale = (typeof routing.locales)[number]
