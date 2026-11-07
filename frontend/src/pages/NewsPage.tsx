import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SECTIONS } from '../api/types'
import ArticleList from '../components/ArticleList'
import CountrySelect from '../components/CountrySelect'
import HomeAside from '../components/HomeAside'
import { BookmarkIcon, CloseIcon, RefreshIcon, SearchIcon } from '../components/icons'
import PageHero from '../components/PageHero'
import SectionTabs from '../components/SectionTabs'
import ThemeToggle from '../components/ThemeToggle'
import { useCountries } from '../hooks/useCountries'
import { useGeo } from '../hooks/useGeo'
import { useNews, usePrefetchNews } from '../hooks/useNews'
import { useSelection } from '../hooks/useSelection'
import { normalizeForSearch } from '../lib/country'
import { timeAgo } from '../lib/date'
import { SECTION_LABELS, tabId } from '../lib/section'
import { iconButtonClass } from '../lib/ui'

const PANEL_ID = 'news-panel'

const today = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function NewsPage() {
  const countries = useCountries()
  const geo = useGeo()
  const { country, section, setCountry, setSection } = useSelection(countries.data, {
    settled: !geo.isPending,
    country: geo.data ?? null,
  })
  const news = useNews(country, section)
  const prefetch = usePrefetchNews(country)
  const [params] = useSearchParams()

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const countryName = countries.data?.find((c) => c.code === country)?.name ?? country ?? ''
  const sectionLabel = SECTION_LABELS[section]

  // Countries must load before news can; fold both into one list status.
  const status = countries.isError
    ? 'error'
    : countries.isPending || !country
      ? 'pending'
      : news.status
  const retry = countries.isError ? () => countries.refetch() : () => news.refetch()

  const articles = useMemo(() => {
    const list = news.data?.articles
    const q = normalizeForSearch(query.trim())
    if (!list || !q) return list
    return list.filter((a) =>
      normalizeForSearch(`${a.title} ${a.source} ${a.summary ?? ''}`).includes(q),
    )
  }, [news.data, query])

  const settled = news.isSuccess && !news.isPlaceholderData && !news.isFetching
  const count = news.data?.articles.length ?? 0
  const announcement = settled
    ? `${count} ${count === 1 ? 'article' : 'articles'} for ${countryName}, ${sectionLabel}`
    : ''

  let updated = ''
  if (news.isPlaceholderData || (news.isFetching && !news.data)) updated = 'Updating…'
  else if (news.data) updated = `Updated ${timeAgo(news.data.fetchedAt)}`

  const title = countryName ? `${countryName} — ${sectionLabel} News` : 'News Dashboard'
  const nextSection = () => setSection(SECTIONS[(SECTIONS.indexOf(section) + 1) % SECTIONS.length])
  const refresh = () => void news.refetch()

  function toggleSearch() {
    if (searchOpen) {
      setSearchOpen(false)
      setQuery('')
    } else {
      setSearchOpen(true)
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }

  const searchButton = (
    <button
      type="button"
      onClick={toggleSearch}
      aria-label={searchOpen ? 'Close search' : 'Search headlines'}
      aria-expanded={searchOpen}
      aria-controls="headline-search"
      className={iconButtonClass}
    >
      {searchOpen ? <CloseIcon className="size-5" /> : <SearchIcon className="size-5" />}
    </button>
  )

  return (
    <>
      <PageHero
        title={
          <>
            News from{' '}
            <span className="bg-linear-to-r from-violet-500 via-fuchsia-500 to-violet-400 bg-clip-text text-transparent dark:from-violet-300 dark:via-fuchsia-300 dark:to-violet-400">
              Around the World
            </span>
          </>
        }
        subtitle="Choose a country and a section to see today’s top headlines."
        actions={
          <>
            {searchButton}
            <Link to={`/saved?${params}`} aria-label="Saved articles" title="Saved" className={iconButtonClass}>
              <BookmarkIcon className="size-5" />
            </Link>
            <ThemeToggle className="max-lg:hidden" />
          </>
        }
      />

      <div className="px-3 pt-6 pb-10 sm:px-8 lg:pb-12 xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-6">
        <div className="min-w-0">
          <div className="grid gap-3 px-1 sm:px-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-4">
            <CountrySelect
              value={country}
              onChange={setCountry}
              countries={countries.data ?? []}
              disabled={!countries.data}
            />
            <SectionTabs value={section} onChange={setSection} onPrefetch={prefetch} panelId={PANEL_ID} />
          </div>

          <div className="mt-6 mb-4 flex items-end justify-between gap-3 px-1 sm:mt-8 sm:px-0">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-3xl">
                {countryName ? (
                  <>
                    {countryName} — {sectionLabel} News
                  </>
                ) : (
                  <span className="inline-block h-7 w-56 max-w-full rounded-full bg-accent-soft align-middle motion-safe:animate-pulse" />
                )}
              </h2>
              <p className="mt-1 text-sm text-muted sm:text-base">Today, {today()}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-xs text-muted sm:text-sm">
              <span className="sm:hidden">{searchButton}</span>
              <button
                type="button"
                onClick={refresh}
                disabled={news.isFetching || !country}
                aria-label="Refresh headlines"
                title="Refresh"
                className="inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
              >
                <RefreshIcon className={`size-[18px] ${news.isFetching ? 'motion-safe:animate-spin' : ''}`} />
              </button>
              {updated && <span className="hidden sm:inline">{updated}</span>}
            </div>
          </div>

          {searchOpen && (
            <div id="headline-search" className="relative mb-4">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-5 -translate-y-1/2 text-muted" />
              <label htmlFor="headline-search-input" className="sr-only">
                Search these headlines
              </label>
              <input
                id="headline-search-input"
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && toggleSearch()}
                placeholder={`Search ${sectionLabel.toLowerCase()} headlines`}
                className="w-full rounded-xl border border-line bg-panel py-2.5 pr-4 pl-11 text-[15px] text-ink placeholder:text-faint focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40"
              />
            </div>
          )}

          <section
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={tabId(section)}
            aria-busy={status === 'pending' || news.isFetching}
            className={news.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}
          >
            {query.trim() && articles?.length === 0 ? (
              <p className="rounded-2xl border border-line bg-panel-2 px-6 py-10 text-center text-sm text-muted">
                No headlines match “{query.trim()}”.
              </p>
            ) : (
              <ArticleList
                status={status}
                articles={articles}
                onRetry={retry}
                countryName={countryName}
                countryCode={country ?? ''}
                section={section}
                onTryAnotherSection={nextSection}
              />
            )}
          </section>
        </div>

        <aside className="mt-8 hidden xl:mt-0 xl:block" aria-label="Overview">
          <HomeAside
            country={country}
            section={section}
            onSection={setSection}
            onRefresh={refresh}
            refreshing={news.isFetching}
            shareTitle={title}
          />
        </aside>
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </>
  )
}
