import type { SupportedLocale } from './index'

export function formatRelativeTime(timestamp: number, locale: SupportedLocale): string {
  if (!timestamp) return ''
  const diffSeconds = Math.round((timestamp - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const absSeconds = Math.abs(diffSeconds)

  if (absSeconds < 60) return formatter.format(diffSeconds, 'second')
  const diffMinutes = Math.round(diffSeconds / 60)
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, 'minute')
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, 'hour')
  return formatter.format(Math.round(diffHours / 24), 'day')
}

export function formatDate(value: number | Date, locale: SupportedLocale, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options ?? { month: 'short', day: 'numeric', year: 'numeric' }).format(value)
}

export function formatDateTime(value: number | Date, locale: SupportedLocale, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

export function formatNumber(value: number, locale: SupportedLocale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value)
}
