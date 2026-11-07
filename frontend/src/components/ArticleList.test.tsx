import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Article } from '../api/types'
import ArticleList from './ArticleList'

const article = (i: number): Article => ({
  id: String(i),
  title: `Headline ${i}`,
  source: 'Global Wire',
  url: `https://example.com/${i}`,
  publishedAt: new Date().toISOString(),
})

const props = { onRetry: () => {}, countryName: 'India', section: 'technology' as const }

describe('ArticleList', () => {
  it('shows placeholders while loading', () => {
    render(<ArticleList status="pending" articles={undefined} {...props} />)
    expect(screen.getByTestId('loading-list')).toBeInTheDocument()
  })

  it('shows the empty state naming country and section, with a way out', async () => {
    const onTryAnotherSection = vi.fn()
    render(<ArticleList status="success" articles={[]} {...props} onTryAnotherSection={onTryAnotherSection} />)
    expect(screen.getByText('No articles found')).toBeInTheDocument()
    expect(screen.getByText(/no news articles for India in the Technology section/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try another section' }))
    expect(onTryAnotherSection).toHaveBeenCalledOnce()
  })

  it('saves and unsaves an article with the bookmark button', async () => {
    render(<ArticleList status="success" articles={[1, 2, 3, 4, 5].map(article)} {...props} countryCode="IN" />)
    const [first] = screen.getAllByRole('button', { name: 'Save article' })
    await userEvent.click(first)
    expect(screen.getByRole('button', { name: 'Remove from saved' })).toHaveAttribute('aria-pressed', 'true')
    const stored = JSON.parse(window.localStorage.getItem('news.saved') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ country: 'IN', section: 'technology', article: { id: '1' } })
    await userEvent.click(screen.getByRole('button', { name: 'Remove from saved' }))
    expect(JSON.parse(window.localStorage.getItem('news.saved') ?? '[]')).toHaveLength(0)
  })

  it('shows the thin-coverage note under fewer than five articles', () => {
    render(<ArticleList status="success" articles={[1, 2].map(article)} {...props} />)
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByText(/Coverage for this country is limited/)).toBeInTheDocument()
  })

  it('opens links safely in a new tab', () => {
    render(<ArticleList status="success" articles={[1, 2, 3, 4, 5].map(article)} {...props} />)
    const link = screen.getAllByRole('link')[0]
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByText(/limited/)).not.toBeInTheDocument()
  })

  it('retries from the error state', async () => {
    const onRetry = vi.fn()
    render(<ArticleList status="error" articles={undefined} {...props} onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
