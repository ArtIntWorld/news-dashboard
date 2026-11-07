import { apiGet } from './client'
import type { Country, GeoResponse, NewsResponse, Section } from './types'

export function getCountries() {
  return apiGet<Country[]>('/api/countries')
}

export function getNews(country: string, section: Section) {
  return apiGet<NewsResponse>('/api/news', { country, section })
}

export function getGeo() {
  return apiGet<GeoResponse>('/api/geo')
}
