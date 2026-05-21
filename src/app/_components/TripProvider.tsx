'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface TripFarm {
  osmId: string
  name: string
  lat: number
  lng: number
  city: string | null
  image: string | null
  farmType: string[] | null
}

interface TripCtx {
  pendingFarms: TripFarm[]
  addFarm: (farm: TripFarm) => void
  removeFarm: (osmId: string) => void
  reorder: (from: number, to: number) => void
  clear: () => void
  hasFarm: (osmId: string) => boolean
}

const TripContext = createContext<TripCtx>({
  pendingFarms: [],
  addFarm: () => {},
  removeFarm: () => {},
  reorder: () => {},
  clear: () => {},
  hasFarm: () => false,
})

export function useTrip() { return useContext(TripContext) }

const STORAGE_KEY = 'dlb_pending_trip'

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [pendingFarms, setPendingFarms] = useState<TripFarm[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPendingFarms(JSON.parse(raw))
    } catch {}
  }, [])

  const addFarm = useCallback((farm: TripFarm) => {
    setPendingFarms(prev => {
      if (prev.some(f => f.osmId === farm.osmId)) return prev
      const next = [...prev, farm]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const removeFarm = useCallback((osmId: string) => {
    setPendingFarms(prev => {
      const next = prev.filter(f => f.osmId !== osmId)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const reorder = useCallback((from: number, to: number) => {
    setPendingFarms(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setPendingFarms([])
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  const hasFarm = useCallback((osmId: string) => {
    return pendingFarms.some(f => f.osmId === osmId)
  }, [pendingFarms])

  return (
    <TripContext.Provider value={{ pendingFarms, addFarm, removeFarm, reorder, clear, hasFarm }}>
      {children}
    </TripContext.Provider>
  )
}
