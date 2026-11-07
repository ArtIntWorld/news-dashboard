import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { getCountries } from '../api/endpoints'

/** Network errors and 5xx retry once; 4xx go straight to the error state. */
export function retryOnce(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.isClientError) return false
  return failureCount < 1
}

/** Fetched once per session and never goes stale. */
export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: getCountries,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: retryOnce,
  })
}
