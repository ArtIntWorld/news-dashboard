import type { Article, Section } from '../api/types'

/** An article the reader bookmarked. Stored only in this browser. */
export interface SavedArticle {
  article: Article
  country: string
  section: Section
  savedAt: string
}

export const SAVED_KEY = 'news.saved'
const MAX_SAVED = 200
const EVENT = 'news-saved-change'

let cacheRaw: string | null = null
let cacheValue: SavedArticle[] = []

/** Stable snapshot for useSyncExternalStore: same array until storage changes. */
export function readSaved(): SavedArticle[] {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(SAVED_KEY)
  } catch {
    return cacheValue
  }
  if (raw === cacheRaw) return cacheValue
  cacheRaw = raw
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    cacheValue = Array.isArray(parsed)
      ? parsed.filter((s): s is SavedArticle => !!s?.article?.id && !!s?.article?.url)
      : []
  } catch {
    cacheValue = []
  }
  return cacheValue
}

function write(list: SavedArticle[]) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, MAX_SAVED)))
  } catch {
    // Storage blocked or full: the bookmark just doesn't stick.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function isSaved(list: readonly SavedArticle[], id: string) {
  return list.some((s) => s.article.id === id)
}

export function toggleSaved(article: Article, country: string, section: Section) {
  const list = readSaved()
  if (isSaved(list, article.id)) {
    write(list.filter((s) => s.article.id !== article.id))
  } else {
    write([{ article, country, section, savedAt: new Date().toISOString() }, ...list])
  }
}

export function subscribeSaved(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_KEY) onChange()
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage) // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}
