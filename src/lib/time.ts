export function timeUntilLabel(isoDate: string): { label: string; withinThreeDays: boolean } {
  const ms = new Date(isoDate).getTime() - Date.now()
  if (ms <= 0) return { label: 'trial has ended', withinThreeDays: true }

  const totalMinutes = Math.floor(ms / 60000)
  const totalHours   = Math.floor(ms / 3600000)
  const days         = Math.floor(ms / 86400000)
  const hours        = totalHours % 24
  const minutes      = totalMinutes % 60

  const withinThreeDays = days < 3

  let label: string
  if (days >= 1) {
    let extra = ''
    if (hours > 0)        extra = `, ${hours} hr${hours === 1 ? '' : 's'}`
    else if (minutes > 0) extra = `, ${minutes} min`
    label = `${days} day${days === 1 ? '' : 's'}${extra}`
  } else if (totalHours >= 1) {
    label = `${totalHours} hr${totalHours === 1 ? '' : 's'}${minutes > 0 ? `, ${minutes} min` : ''}`
  } else {
    label = `${totalMinutes} min`
  }

  return { label, withinThreeDays }
}
