import SiteNav from './SiteNav'
import SiteFooter from './SiteFooter'
import PageTransition from './PageTransition'

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <SiteNav />
      <PageTransition>
        <main className="flex-1">{children}</main>
      </PageTransition>
      <SiteFooter />
    </div>
  )
}
