import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Country, Section } from '../api/types'
import { currentTimeZone, readSavedCountry, resolveDefaultCountry, saveCountry } from '../lib/country'
import { parseSection } from '../lib/section'

/**
 * Country and section live in the URL. Invalid or missing values are resolved to defaults
 * and the URL is rewritten in place; user changes push a new history entry.
 *
 * `geo` is the location lookup: the country stays null until it has settled, so the
 * first news request already goes to the right country.
 */
export function useSelection(
  countries: readonly Country[] | undefined,
  geo: { settled: boolean; country: string | null } = { settled: true, country: null },
) {
  const [params, setParams] = useSearchParams()
  const rawCountry = params.get('country')
  const rawSection = params.get('section')
  const section = parseSection(rawSection)

  const country = useMemo(() => {
    if (!countries) return null
    const urlCode = rawCountry
    const savedCode = readSavedCountry()
    const decided = [urlCode, savedCode].some((c) => c && countries.some((k) => k.code === c.toUpperCase()))
    if (!decided && !geo.settled) return null
    return resolveDefaultCountry({
      urlCode,
      savedCode,
      geoCode: geo.country,
      timeZone: currentTimeZone(),
      languages: typeof navigator === 'undefined' ? [] : navigator.languages ?? [],
      countries,
    })
  }, [countries, rawCountry, geo.settled, geo.country])

  // Normalise the URL so every view is shareable as-is.
  useEffect(() => {
    if (!country) return
    if (rawCountry !== country || rawSection !== section) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('country', country)
          next.set('section', section)
          return next
        },
        { replace: true },
      )
    }
  }, [country, section, rawCountry, rawSection, setParams])

  const update = useCallback(
    (key: 'country' | 'section', value: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set(key, value)
        return next
      })
    },
    [setParams],
  )

  // Only an explicit pick is remembered, so automatic defaults never mask location detection.
  const setCountry = useCallback(
    (code: string) => {
      saveCountry(code)
      update('country', code)
    },
    [update],
  )
  const setSection = useCallback((s: Section) => update('section', s), [update])

  return { country, section, setCountry, setSection }
}
