export type Theme = 'light' | 'dark'

export const THEME_KEY = 'news.theme'

/** The theme the reader chose, or null to follow the system setting. */
export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}

const darkQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

export function systemTheme(): Theme {
  return darkQuery()?.matches ? 'dark' : 'light'
}

/** Follow system changes while the reader has not picked a theme. Returns an unsubscribe. */
export function onSystemThemeChange(listener: (theme: Theme) => void): () => void {
  const query = darkQuery()
  if (!query) return () => {}
  const handler = () => listener(query.matches ? 'dark' : 'light')
  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}

/** Same effect as the inline script in index.html, which runs before first paint. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
