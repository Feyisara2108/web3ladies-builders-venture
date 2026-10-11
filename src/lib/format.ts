export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

/** A timestamp as a local-time "YYYY-MM-DDTHH:mm" string for <input type="datetime-local">. */
export function toDateTimeInput(iso: string | Date) {
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function nowForDateTimeInput() {
  return toDateTimeInput(new Date())
}

export function todayForDateInput() {
  return nowForDateTimeInput().slice(0, 10)
}

export const stageLabels: Record<string, string> = {
  ideation: 'Ideation',
  validation: 'Validation',
  building: 'Building',
  testing: 'Testing',
  launch: 'Launch',
}

export const stageOrder = ['ideation', 'validation', 'building', 'testing', 'launch']
