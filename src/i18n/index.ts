import { createI18n } from 'vue-i18n'
import { en, type LocaleMessages } from './locales/en'
import { vi } from './locales/vi'
import { zh } from './locales/zh'
import { hi } from './locales/hi'
import { es } from './locales/es'
import { ar } from './locales/ar'
import { fr } from './locales/fr'
import { ja } from './locales/ja'
import { pt } from './locales/pt'
import { ko } from './locales/ko'
import { ca } from './locales/ca'
import { de } from './locales/de'
import { it } from './locales/it'
import { nl } from './locales/nl'
import { pl } from './locales/pl'
import { ru } from './locales/ru'
import { sl } from './locales/sl'
import { th } from './locales/th'
import { tr } from './locales/tr'

export const SUPPORTED_LOCALES = ['vi', 'en', 'zh', 'hi', 'es', 'ar', 'fr', 'ja', 'pt', 'ko', 'ca', 'de', 'it', 'nl', 'pl', 'ru', 'sl', 'th', 'tr'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

const localeOptionsBase: { code: SupportedLocale; englishName: string; dir: 'ltr' | 'rtl'; flagCode: string }[] = [
  { code: 'vi', englishName: 'Vietnamese', dir: 'ltr', flagCode: 'vn' },
  { code: 'en', englishName: 'English', dir: 'ltr', flagCode: 'gb' },
  { code: 'zh', englishName: 'Chinese', dir: 'ltr', flagCode: 'cn' },
  { code: 'hi', englishName: 'Hindi', dir: 'ltr', flagCode: 'in' },
  { code: 'es', englishName: 'Spanish', dir: 'ltr', flagCode: 'es' },
  { code: 'ar', englishName: 'Arabic', dir: 'rtl', flagCode: 'sa' },
  { code: 'fr', englishName: 'French', dir: 'ltr', flagCode: 'fr' },
  { code: 'ja', englishName: 'Japanese', dir: 'ltr', flagCode: 'jp' },
  { code: 'pt', englishName: 'Portuguese', dir: 'ltr', flagCode: 'pt' },
  { code: 'ko', englishName: 'Korean', dir: 'ltr', flagCode: 'kr' },
  { code: 'ca', englishName: 'Catalan', dir: 'ltr', flagCode: 'es-ct' },
  { code: 'de', englishName: 'German', dir: 'ltr', flagCode: 'de' },
  { code: 'it', englishName: 'Italian', dir: 'ltr', flagCode: 'it' },
  { code: 'nl', englishName: 'Dutch', dir: 'ltr', flagCode: 'nl' },
  { code: 'pl', englishName: 'Polish', dir: 'ltr', flagCode: 'pl' },
  { code: 'ru', englishName: 'Russian', dir: 'ltr', flagCode: 'ru' },
  { code: 'sl', englishName: 'Slovenian', dir: 'ltr', flagCode: 'si' },
  { code: 'th', englishName: 'Thai', dir: 'ltr', flagCode: 'th' },
  { code: 'tr', englishName: 'Turkish', dir: 'ltr', flagCode: 'tr' },
]

export const messages: Record<SupportedLocale, LocaleMessages> = {
  en,
  vi,
  zh,
  hi,
  es,
  ar,
  fr,
  ja,
  pt,
  ko,
  ca,
  de,
  it,
  nl,
  pl,
  ru,
  sl,
  th,
  tr,
}

export const localeOptions: { code: SupportedLocale; nativeName: string; englishName: string; dir: 'ltr' | 'rtl'; flagCode: string }[] = localeOptionsBase.map(opt => ({
  ...opt,
  nativeName: messages[opt.code].language.nativeName as unknown as string
}))

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

export function normalizeLocale(tag: string | undefined | null): SupportedLocale | null {
  if (!tag) return null
  const normalized = tag.toLowerCase().replace('_', '-')
  const base = normalized.split('-')[0]
  if (isSupportedLocale(normalized)) return normalized
  if (isSupportedLocale(base)) return base
  if (base === 'zh' || normalized.startsWith('zh-')) return 'zh'
  if (base === 'pt' || normalized.startsWith('pt-')) return 'pt'
  return null
}

export function detectLocaleFromNavigator(): SupportedLocale {
  if (typeof navigator === 'undefined') return 'en'
  const candidates = [navigator.language, ...(navigator.languages ?? [])]
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate)
    if (locale) return locale
  }
  return 'en'
}

export function isRtlLocale(locale: SupportedLocale): boolean {
  return locale === 'ar'
}

export function applyLocaleToDocument(locale: SupportedLocale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr'
  document.documentElement.dataset.locale = locale
}

export function setI18nLocale(locale: SupportedLocale) {
  const global = i18n.global as unknown as { locale: { value: SupportedLocale } }
  global.locale.value = locale
  applyLocaleToDocument(locale)
}

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: false,
  messages,
})
