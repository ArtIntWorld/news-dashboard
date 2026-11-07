import { keepPreviousData, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getNews } from '../api/endpoints'
import type { Section } from '../api/types'
import { retryOnce } from './useCountries'

const MINUTE = 60_000

export function newsQueryOptions(country: string, section: Section) {
  return queryOptions({
    queryKey: ['news', country, section] as const,
    queryFn: () => getNews(country, section),
    staleTime: 10 * MINUTE,
    gcTime: 30 * MINUTE,
    retry: retryOnce,
  })
}

export function useNews(country: string | null, section: Section) {
  return useQuery({
    ...newsQueryOptions(country ?? '', section),
    enabled: !!country,
    // Keep the previous list on screen while the next one loads, so the page doesn't flash.
    placeholderData: keepPreviousData,
  })
}

/** Returns a function that warms the cache for a section, used on tab hover. */
export function usePrefetchNews(country: string | null) {
  const queryClient = useQueryClient()
  return useCallback(
    (section: Section) => {
      if (country) void queryClient.prefetchQuery(newsQueryOptions(country, section))
    },
    [country, queryClient],
  )
}
