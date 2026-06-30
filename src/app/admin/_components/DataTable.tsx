'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Loader2, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortValue?: (row: T) => string | number | null
  thClass?: string
  tdClass?: string
}

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  searchText?: (row: T) => string
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  toolbarRight?: ReactNode
  emptyText?: string
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
}

export default function DataTable<T>({
  rows, columns, rowKey, loading = false, searchText, searchPlaceholder = 'Search…',
  onRowClick, toolbarRight, emptyText = 'Nothing to show',
  defaultSort,
}: Props<T>) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(defaultSort ?? null)

  const visible = useMemo(() => {
    let list = rows
    const query = q.trim().toLowerCase()
    if (query && searchText) list = list.filter(r => searchText(r).toLowerCase().includes(query))

    if (sort) {
      const col = columns.find(c => c.key === sort.key)
      if (col?.sortValue) {
        const dir = sort.dir === 'asc' ? 1 : -1
        list = [...list].sort((a, b) => {
          const av = col.sortValue!(a), bv = col.sortValue!(b)
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
          return String(av).localeCompare(String(bv)) * dir
        })
      }
    }
    return list
  }, [rows, q, sort, columns, searchText])

  function toggleSort(key: string) {
    setSort(cur => cur?.key === key
      ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {(searchText || toolbarRight) && (
        <div className="flex flex-wrap items-center gap-3 shrink-0 mb-3">
          {searchText && (
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              />
            </div>
          )}
          {toolbarRight}
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* Fills the remaining height; the scrollbar lives inside, and the
            header always renders (even with no rows). */}
        <div className="h-full overflow-auto flex flex-col">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {columns.map(col => {
                  const sortable = !!col.sortValue
                  const active = sort?.key === col.key
                  return (
                    <th
                      key={col.key}
                      onClick={sortable ? () => toggleSort(col.key) : undefined}
                      className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${sortable ? 'cursor-pointer select-none' : ''} ${col.thClass ?? ''}`}
                      style={{ color: 'var(--muted-foreground)', backgroundColor: 'var(--cream)' }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {sortable && (active
                          ? (sort!.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
                          : <ChevronsUpDown size={12} className="opacity-40" />)}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            {!loading && visible.length > 0 && (
              <tbody>
                {visible.map(row => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    className={`hover:bg-black/[0.02] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {columns.map(col => (
                      <td key={col.key} className={`px-4 py-3 ${col.tdClass ?? ''}`}>{col.render(row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {/* Loading / empty states centered in the remaining space */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} /></div>
          ) : visible.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10 text-sm" style={{ color: 'var(--muted-foreground)' }}>{emptyText}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
