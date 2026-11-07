const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/** Thrown for any failed request. `status` is 0 for network errors. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  get isClientError() {
    return this.status >= 400 && this.status < 500
  }
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const query = params ? `?${new URLSearchParams(params)}` : ''
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}${query}`, { headers: { Accept: 'application/json' } })
  } catch {
    throw new ApiError(0, 'Network error')
  }
  if (!res.ok) throw new ApiError(res.status, `Request failed with status ${res.status}`)
  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError(res.status, 'Invalid JSON in response')
  }
}
