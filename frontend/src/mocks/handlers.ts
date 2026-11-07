import { delay, http, HttpResponse } from 'msw'
import type { NewsResponse } from '../api/types'
import { isSection } from '../lib/section'
import { COUNTRIES, FAILING_COUNTRY, makeArticles } from './data'

/** Simulated network latency in the browser; 0 in tests. */
const LATENCY = import.meta.env.MODE === 'test' ? 0 : 500

export const handlers = [
  // Like the real backend running locally: no CDN header, so the app uses the time zone.
  http.get('*/api/geo', () => HttpResponse.json({ country: null })),

  http.get('*/api/countries', async () => {
    await delay(LATENCY)
    return HttpResponse.json(COUNTRIES)
  }),

  http.get('*/api/news', async ({ request }) => {
    await delay(LATENCY)
    const params = new URL(request.url).searchParams
    const country = (params.get('country') ?? '').toUpperCase()
    const section = params.get('section')

    if (!COUNTRIES.some((c) => c.code === country) || !isSection(section)) {
      return HttpResponse.json({ error: 'Unknown country or section' }, { status: 400 })
    }
    if (country === FAILING_COUNTRY) {
      return HttpResponse.json({ error: 'Upstream source unavailable' }, { status: 500 })
    }

    const body: NewsResponse = {
      country,
      section,
      fetchedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
      articles: makeArticles(country, section),
    }
    return HttpResponse.json(body)
  }),
]
