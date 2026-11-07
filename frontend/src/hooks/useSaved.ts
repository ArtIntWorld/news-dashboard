import { useSyncExternalStore } from 'react'
import { readSaved, subscribeSaved } from '../lib/saved'

/** Saved articles, kept in sync across components and browser tabs. */
export function useSaved() {
  return useSyncExternalStore(subscribeSaved, readSaved, () => [])
}
