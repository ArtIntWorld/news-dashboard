import { useQuery } from '@tanstack/react-query'
import { getGeo } from '../api/endpoints'

/** Give up on the location lookup after this long; the time zone is used instead. */
const GEO_TIMEOUT_MS = 1500

/**
 * The visitor's country as seen by the backend's CDN, or null. Only used to choose the
 * starting country, so any failure simply resolves to null and never shows an error.
 */
export function useGeo() {
  return useQuery({
    queryKey: ['geo'],
    queryFn: async () => {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), GEO_TIMEOUT_MS))
      try {
        const res = await Promise.race([getGeo(), timeout])
        return res?.country ?? null
      } catch {
        return null
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
}
