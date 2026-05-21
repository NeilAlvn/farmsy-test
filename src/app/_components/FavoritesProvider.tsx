'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface FavoritesCtx {
  favorites: Set<string>
  isLoggedIn: boolean
  toggle: (osmId: string) => Promise<void>
}

const FavoritesContext = createContext<FavoritesCtx>({
  favorites: new Set(),
  isLoggedIn: false,
  toggle: async () => {},
})

export function useFavorites() {
  return useContext(FavoritesContext)
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  async function loadFavorites(uid: string) {
    const { data, error } = await supabase
      .from('favorites')
      .select('farm_osm_id')
      .eq('user_id', uid)
    if (!error && data) {
      setFavorites(new Set(data.map((r: { farm_osm_id: string }) => r.farm_osm_id)))
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        loadFavorites(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        loadFavorites(session.user.id)
      } else {
        setUserId(null)
        setFavorites(new Set())
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const toggle = useCallback(async (osmId: string) => {
    if (!userId) return

    const isFaved = favorites.has(osmId)

    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev)
      if (isFaved) next.delete(osmId)
      else next.add(osmId)
      return next
    })

    if (isFaved) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('farm_osm_id', osmId)
      // Roll back on error
      if (error) setFavorites(prev => { const next = new Set(prev); next.add(osmId); return next })
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, farm_osm_id: osmId })
      if (error) setFavorites(prev => { const next = new Set(prev); next.delete(osmId); return next })
    }
  }, [userId, favorites])

  return (
    <FavoritesContext.Provider value={{ favorites, isLoggedIn: !!userId, toggle }}>
      {children}
    </FavoritesContext.Provider>
  )
}
