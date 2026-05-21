/** Maps OSM day abbreviations to JS Date.getDay() values (0 = Sunday) */
const DAY_JS: Record<string, number> = {
  Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0,
}

/**
 * Mon-based index (Mo=0 … Su=6) so range comparisons work correctly
 * for ranges that don't wrap the week boundary (Mo-Fr, Sa-Su, etc.)
 */
const DAY_MON: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }

export function isOpenToday(opening_hours: string | null | undefined): boolean {
  if (!opening_hours) return false
  const raw = opening_hours.trim()
  if (raw === '24/7') return true

  const todayMon = DAY_MON[new Date().getDay()]

  for (const segment of raw.split(/[\n;]/)) {
    const s = segment.trim()
    if (!s) continue

    // Skip explicit "off" entries like "PH off", "Su off"
    if (/\boff\b/i.test(s)) continue

    // Day part is everything before the first time-like token (HH:MM)
    const dayPart = s.split(/\s+\d{1,2}:\d{2}/)[0].trim()
    if (!dayPart) continue

    for (const group of dayPart.split(',')) {
      const g = group.trim()
      if (g.includes('-')) {
        // Range: "Mo-Fr", "Sa-Su"
        const [a, b] = g.split('-')
        const startMon = DAY_MON[DAY_JS[a]]
        const endMon   = DAY_MON[DAY_JS[b]]
        if (startMon === undefined || endMon === undefined) continue

        if (startMon <= endMon) {
          if (todayMon >= startMon && todayMon <= endMon) return true
        } else {
          // Wrap-around range e.g. "Fr-Mo"
          if (todayMon >= startMon || todayMon <= endMon) return true
        }
      } else {
        // Single day: "Sa"
        const js = DAY_JS[g]
        if (js !== undefined && DAY_MON[js] === todayMon) return true
      }
    }
  }

  return false
}
