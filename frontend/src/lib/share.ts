/** Native share sheet where available (phones); otherwise copy the link. */
export async function shareOrCopy(title: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
