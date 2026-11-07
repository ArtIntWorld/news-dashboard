import { describe, expect, it } from 'vitest'
import { filterCountries, regionFromLanguage, regionFromTimeZone, resolveDefaultCountry } from './country'

const countries = [
  { code: 'US', name: 'United States' },
  { code: 'IN', name: 'India' },
  { code: 'CI', name: 'Côte d’Ivoire' },
  { code: 'DE', name: 'Germany' },
]

describe('resolveDefaultCountry', () => {
  const base = { urlCode: null, savedCode: null, languages: [], countries }

  it('prefers a valid URL code, case-insensitively', () => {
    expect(resolveDefaultCountry({ ...base, urlCode: 'in', savedCode: 'DE' })).toBe('IN')
  })

  it('falls back to the saved country when the URL code is unknown', () => {
    expect(resolveDefaultCountry({ ...base, urlCode: 'ZZ', savedCode: 'DE' })).toBe('DE')
  })

  it('uses the browser language region next', () => {
    expect(resolveDefaultCountry({ ...base, languages: ['en', 'de-DE'] })).toBe('DE')
  })

  it('uses the server-side location before the time zone and language', () => {
    expect(
      resolveDefaultCountry({ ...base, geoCode: 'in', timeZone: 'Europe/Berlin', languages: ['en-US'] }),
    ).toBe('IN')
  })

  it('uses the device time zone before the browser language', () => {
    expect(resolveDefaultCountry({ ...base, timeZone: 'Asia/Kolkata', languages: ['en-US'] })).toBe('IN')
    expect(resolveDefaultCountry({ ...base, timeZone: 'Asia/Calcutta', languages: ['en-US'] })).toBe('IN')
  })

  it('skips time zones without a country', () => {
    expect(resolveDefaultCountry({ ...base, timeZone: 'UTC', languages: ['de-DE'] })).toBe('DE')
  })

  it('keeps an explicit pick over the location', () => {
    expect(resolveDefaultCountry({ ...base, savedCode: 'DE', geoCode: 'IN', timeZone: 'Asia/Kolkata' })).toBe('DE')
  })

  it('ends at US', () => {
    expect(resolveDefaultCountry({ ...base, languages: ['fr-FR'] })).toBe('US')
  })
})

describe('regionFromLanguage', () => {
  it('extracts the region', () => {
    expect(regionFromLanguage('en-IN')).toBe('IN')
    expect(regionFromLanguage('en')).toBeNull()
    expect(regionFromLanguage('not a tag')).toBeNull()
  })
})

describe('regionFromTimeZone', () => {
  it('maps zones to countries', () => {
    expect(regionFromTimeZone('Asia/Kolkata')).toBe('IN')
    expect(regionFromTimeZone('America/Toronto')).toBe('CA')
    expect(regionFromTimeZone('Asia/Tokyo')).toBe('JP')
    expect(regionFromTimeZone('Etc/UTC')).toBeNull()
    expect(regionFromTimeZone(null)).toBeNull()
  })
})

describe('filterCountries', () => {
  it('matches ignoring case and accents', () => {
    expect(filterCountries(countries, 'COTE').map((c) => c.code)).toEqual(['CI'])
    expect(filterCountries(countries, 'ind').map((c) => c.code)).toEqual(['IN'])
  })

  it('returns everything for an empty query', () => {
    expect(filterCountries(countries, '  ')).toHaveLength(4)
  })
})
