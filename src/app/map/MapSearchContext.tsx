'use client'

import {
  createContext, useContext, useState, useMemo,
  useCallback, useRef, type ReactNode,
} from 'react'
import { CATEGORIES, type CategoryId, type Category } from './mapSearch'
import type { SlimFarm } from './FarmMap'

interface FlyTarget { pos: [number, number]; key: number }

interface MapSearchCtx {
  farms:              SlimFarm[]
  query:              string
  setQuery:           (q: string) => void
  selected:           Set<CategoryId>
  setSelected:        (s: Set<CategoryId>) => void
  toggleCategory:     (id: CategoryId) => void
  clearCategories:    () => void
  filterOpenToday:    boolean
  setFilterOpenToday: React.Dispatch<React.SetStateAction<boolean>>
  filterHasPhotos:    boolean
  setFilterHasPhotos: React.Dispatch<React.SetStateAction<boolean>>
  view:               'map' | 'list'
  setView:            React.Dispatch<React.SetStateAction<'map' | 'list'>>
  flyTarget:          FlyTarget | null
  setFlyTarget:       (t: FlyTarget) => void
  availableCategories: Category[]
  totalFarms:         number
}

const Ctx = createContext<MapSearchCtx | null>(null)

export function useMapSearch() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMapSearch must be inside MapSearchProvider')
  return ctx
}

export function MapSearchProvider({
  farms,
  children,
}: {
  farms: SlimFarm[]
  children: ReactNode
}) {
  const [query,           setQuery]           = useState('')
  const [selected,        setSelected]        = useState<Set<CategoryId>>(new Set())
  const [filterOpenToday, setFilterOpenToday] = useState(false)
  const [filterHasPhotos, setFilterHasPhotos] = useState(false)
  const [view,            setView]            = useState<'map' | 'list'>('map')
  const [flyTarget,       setFlyTarget_]      = useState<FlyTarget | null>(null)
  const flyKeyRef = useRef(0)

  const toggleCategory = useCallback((id: CategoryId) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearCategories = useCallback(() => setSelected(new Set()), [])

  const setFlyTarget = useCallback((t: FlyTarget) => {
    flyKeyRef.current += 1
    setFlyTarget_({ pos: t.pos, key: flyKeyRef.current })
  }, [])

  const availableCategories = useMemo<Category[]>(() => {
    const inFarms = new Set<string>()
    for (const farm of farms) {
      for (const t of farm.farm_type ?? []) inFarms.add(t)
    }
    return CATEGORIES.filter(c => inFarms.has(c.id)) as unknown as Category[]
  }, [farms])

  return (
    <Ctx.Provider value={{
      farms,
      query, setQuery,
      selected, setSelected, toggleCategory, clearCategories,
      filterOpenToday, setFilterOpenToday,
      filterHasPhotos, setFilterHasPhotos,
      view, setView,
      flyTarget, setFlyTarget,
      availableCategories,
      totalFarms: farms.length,
    }}>
      {children}
    </Ctx.Provider>
  )
}
