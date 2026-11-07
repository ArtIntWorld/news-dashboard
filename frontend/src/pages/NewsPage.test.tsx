import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../mocks/server'
import NewsPage from './NewsPage'

let location = ''
function LocationSpy() {
  const { search } = useLocation()
  useEffect(() => {
    location = search
  }, [search])
  return null
}

function renderAt(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <NewsPage />
        <LocationSpy />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('NewsPage', () => {
  it('loads headlines for the country and section in the URL', async () => {
    renderAt('/?country=IN&section=nature')
    const panel = await screen.findByRole('tabpanel')
    expect(await within(panel).findAllByRole('link')).not.toHaveLength(0)
    expect(screen.getByRole('tab', { name: 'Nature' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/India — Nature News/)).toBeInTheDocument()
  })

  it('rewrites an invalid URL to defaults', async () => {
    renderAt('/?country=ZZ&section=sports')
    await screen.findByText(/United States — Technology News/)
    await waitFor(() => expect(location).toBe('?country=US&section=technology'))
  })

  it("starts at the visitor's location when the URL has no country", async () => {
    server.use(http.get('*/api/geo', () => HttpResponse.json({ country: 'IN' })))
    renderAt('/')
    await screen.findByText(/India — Technology News/)
    await waitFor(() => expect(location).toBe('?country=IN&section=technology'))
  })

  it('a country the reader picked wins over their location', async () => {
    window.localStorage.setItem('news.country.chosen', 'DE')
    server.use(http.get('*/api/geo', () => HttpResponse.json({ country: 'IN' })))
    renderAt('/')
    await screen.findByText(/Germany — Technology News/)
  })

  it('still loads when the location lookup fails', async () => {
    server.use(http.get('*/api/geo', () => HttpResponse.json({}, { status: 500 })))
    renderAt('/')
    await screen.findByText(/United States — Technology News/)
  })

  it('switches section with the arrow keys', async () => {
    renderAt('/?country=GB&section=technology')
    const tab = await screen.findByRole('tab', { name: 'Technology' })
    tab.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Society' })).toHaveAttribute('aria-selected', 'true')
    expect(location).toContain('section=society')
  })

  it('filters headlines with the search box', async () => {
    renderAt('/?country=IN&section=nature')
    const panel = await screen.findByRole('tabpanel')
    const links = await within(panel).findAllByRole('link')
    const firstTitle = links[0].textContent!.replace(' (opens in a new tab)', '')
    await userEvent.click(screen.getAllByRole('button', { name: 'Search headlines' })[0])
    await userEvent.type(screen.getByLabelText('Search these headlines'), firstTitle.slice(0, 18))
    const filtered = within(panel).getAllByRole('link')
    expect(filtered.length).toBeLessThanOrEqual(links.length)
    expect(filtered[0]).toHaveTextContent(firstTitle.slice(0, 18))
    await userEvent.clear(screen.getByLabelText('Search these headlines'))
    await userEvent.type(screen.getByLabelText('Search these headlines'), 'zzzz-no-match')
    expect(within(panel).getByText(/No headlines match/)).toBeInTheDocument()
  })

  it('shows the error view when the request fails', async () => {
    renderAt('/?country=AQ&section=technology')
    expect(await screen.findByRole('alert')).toHaveTextContent(/Failed to load news/)
  })
})
