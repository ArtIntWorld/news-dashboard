import type { Country } from '../api/types'
import { TIMEZONE_COUNTRY } from './timezones'

export const FALLBACK_COUNTRY = 'US'
/** Only a country the reader picked is saved. (The old 'news.country' key also held
 * automatic defaults, which would have hidden location detection, so it is ignored.) */
export const STORAGE_KEY = 'news.country.chosen'

export function readSavedCountry(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveCountry(code: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // Storage can be blocked (private mode, site settings). Nothing to do.
  }
}

/** Region part of a BCP 47 tag, e.g. "en-IN" -> "IN". */
export function regionFromLanguage(tag: string): string | null {
  try {
    const region = new Intl.Locale(tag).region
    return region && /^[A-Z]{2}$/.test(region) ? region : null
  } catch {
    return null
  }
}

/** Country of an IANA time zone, e.g. "Asia/Kolkata" -> "IN". Null for UTC and unknowns. */
export function regionFromTimeZone(timeZone: string | null | undefined): string | null {
  return (timeZone && TIMEZONE_COUNTRY[timeZone]) || null
}

/** The device's time zone, or null when the browser does not say. */
export function currentTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

interface DefaultCountryInput {
  urlCode: string | null
  savedCode: string | null
  /** Country the backend saw via the CDN, if any. */
  geoCode?: string | null
  timeZone?: string | null
  languages: readonly string[]
  countries: readonly Country[]
}

/**
 * URL, then the country the reader picked before, then where they are (server-side
 * location, then device time zone), then browser language region, then US.
 */
export function resolveDefaultCountry({
  urlCode,
  savedCode,
  geoCode = null,
  timeZone = null,
  languages,
  countries,
}: DefaultCountryInput): string {
  const known = new Set(countries.map((c) => c.code))
  const valid = (code: string | null | undefined): code is string =>
    !!code && known.has(code.toUpperCase())

  if (valid(urlCode)) return urlCode.toUpperCase()
  if (valid(savedCode)) return savedCode.toUpperCase()
  if (valid(geoCode)) return geoCode.toUpperCase()
  const tzRegion = regionFromTimeZone(timeZone)
  if (valid(tzRegion)) return tzRegion
  for (const lang of languages) {
    const region = regionFromLanguage(lang)
    if (valid(region)) return region
  }
  return FALLBACK_COUNTRY
}

/** Lowercase and strip accents so "cote" matches "Côte d’Ivoire". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function filterCountries(countries: readonly Country[], query: string): Country[] {
  const q = normalizeForSearch(query.trim())
  if (!q) return [...countries]
  return countries.filter((c) => normalizeForSearch(c.name).includes(q))
}
