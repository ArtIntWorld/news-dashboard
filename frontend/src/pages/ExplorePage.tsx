import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SECTIONS, type Section } from '../api/types'
import ArticleCard from '../components/ArticleCard'
import CountrySelect from '../components/CountrySelect'
import { ArrowRightIcon } from '../components/icons'
import PageHero from '../components/PageHero'
import { ErrorState, LoadingList } from '../components/states'
import { useCountries } from '../hooks/useCountries'
import { useGeo } from '../hooks/useGeo'
import { newsQueryOptions } from '../hooks/useNews'
import { useSelection } from '../hooks/useSelection'
import { SECTION_LABELS } from '../lib/section'
import { SECTION_ICONS, SECTION_TINT } from '../lib/sectionIcons'
import { panelClass } from '../lib/ui'

const PER_SECTION = 5

function SectionColumn({ country, section }: { country: string | null; section: Section }) {
  const news = useQuery({ ...newsQueryOptions(country ?? '', section), enabled: !!country })
  const Icon = SECTION_ICONS[section]
  const articles = news.data?.articles.slice(0, PER_SECTION)

  return (
    <section aria-labelledby={`explore-${section}`} className={`${panelClass} flex flex-col p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={`explore-${section}`} className="flex items-center gap-2.5 text-lg font-semibold text-ink">
          <Icon className={`size-5 ${SECTION_TINT[section]}`} />
          {SECTION_LABELS[section]}
        </h2>
        {news.data && <span className="text-xs text-muted">{news.data.articles.length} articles</span>}
      </div>

      <div className="flex-1">
        {news.isError ? (
          <ErrorState onRetry={() => news.refetch()} />
        ) : !articles ? (
          <LoadingList rows={3} />
        ) : articles.length === 0 ? (
          <p className="rounded-2xl border border-line bg-panel-2 px-4 py-8 text-center text-sm text-muted">
            No stories right now.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {articles.map((a) => (
              <li key={a.id}>
                <ArticleCard article={a} country={country ?? ''} section={section} compact />
              </li>
            ))}
          </ul>
        )}
      </div>

      {country && (
        <Link
          to={`/?country=${country}&section=${section}`}
          className="mt-4 inline-flex items-center gap-1.5 self-start rounded-lg px-1 text-sm font-medium text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          See all {SECTION_LABELS[section]} news
          <ArrowRightIcon className="size-4" />
        </Link>
      )}
    </section>
  )
}

/** Top headlines from every section of one country, side by side. */
export default function ExplorePage() {
  const countries = useCountries()
  const geo = useGeo()
  const { country, setCountry } = useSelection(countries.data, {
    settled: !geo.isPending,
    country: geo.data ?? null,
  })
  const countryName = countries.data?.find((c) => c.code === country)?.name ?? ''

  return (
    <>
      <PageHero
        title={
          <>
            Explore{' '}
            <span className="bg-linear-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-300 dark:to-fuchsia-300">
              {countryName || 'the World'}
            </span>
          </>
        }
        subtitle="The top stories from every section at a glance."
      >
        <div className="mt-6 max-w-xs">
          <CountrySelect
            value={country}
            onChange={setCountry}
            countries={countries.data ?? []}
            disabled={!countries.data}
          />
        </div>
      </PageHero>

      <div className="grid gap-4 px-3 pt-6 pb-10 sm:px-8 lg:grid-cols-3 lg:pb-12">
        {SECTIONS.map((s) => (
          <SectionColumn key={s} country={country} section={s} />
        ))}
      </div>
    </>
  )
}
