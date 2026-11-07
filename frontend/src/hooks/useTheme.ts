import { useCallback, useEffect, useState } from 'react'
import {
  applyTheme,
  onSystemThemeChange,
  readStoredTheme,
  storeTheme,
  systemTheme,
  type Theme,
} from '../lib/theme'

/** Light or dark: the reader's choice if they made one, otherwise the system setting. */
export function useTheme() {
  const [chosen, setChosen] = useState<Theme | null>(readStoredTheme)
  const [system, setSystem] = useState<Theme>(systemTheme)

  useEffect(() => onSystemThemeChange(setSystem), [])

  const theme = chosen ?? system
  useEffect(() => applyTheme(theme), [theme])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    storeTheme(next)
    setChosen(next)
  }, [theme])

  return { theme, toggle }
}
