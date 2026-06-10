import SiteNav from './SiteNav'
import SiteFooter from './SiteFooter'

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
