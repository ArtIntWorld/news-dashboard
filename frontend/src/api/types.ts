export const SECTIONS = ['nature', 'society', 'technology'] as const

export type Section = (typeof SECTIONS)[number]

/** ISO 3166-1 alpha-2 code and display name. */
export interface Country {
  code: string
  name: string
}

export interface Article {
  id: string
  title: string
  source: string
  url: string
  /** ISO 8601 */
  publishedAt: string
  summary?: string
  /** Publisher's site, e.g. "techradar.com"; used to show its logo. */
  sourceDomain?: string
  /** Story picture, when the news source provides one. */
  imageUrl?: string
}

export interface NewsResponse {
  country: string
  section: Section
  /** ISO 8601, when the backend last refreshed */
  fetchedAt: string
  articles: Article[]
}

/** The visitor's country as the backend's CDN sees it; null when unknown (e.g. locally). */
export interface GeoResponse {
  country: string | null
}
