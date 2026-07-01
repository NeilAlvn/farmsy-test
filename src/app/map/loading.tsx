export default function MapLoading() {
  return (
    <div className="flex flex-col h-dvh" style={{ backgroundColor: 'var(--background)' }}>
      {/* Nav skeleton */}
      <div className="h-14 border-b shrink-0 animate-pulse" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }} />

      {/* Map area skeleton */}
      <div className="flex flex-1 items-center justify-center relative">
        <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: 'var(--muted)' }} />
        <div className="relative flex flex-col items-center gap-3 z-10">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
            Loading map…
          </p>
        </div>
      </div>
    </div>
  )
}
