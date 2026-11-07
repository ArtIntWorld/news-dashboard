import { Link, useSearchParams } from 'react-router-dom'
import ArticleCard from '../components/ArticleCard'
import { BookmarkIcon } from '../components/icons'
import PageHero from '../components/PageHero'
import { useCountries } from '../hooks/useCountries'
import { useSaved } from '../hooks/useSaved'
import { SECTION_LABELS } from '../lib/section'

/** Articles bookmarked in this browser, newest first. */
export default function SavedPage() {
  const saved = useSaved()
  const countries = useCountries()
  const [params] = useSearchParams()
  const nameOf = (code: string) => countries.data?.find((c) => c.code === code)?.name ?? code

  return (
    <>
      <PageHero
        title={
          <>
            Saved{' '}
            <span className="bg-linear-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-300 dark:to-fuchsia-300">
              Articles
            </span>
          </>
        }
        subtitle="Stories you bookmarked. They are kept in this browser only."
      />

      <div className="px-3 pt-6 pb-10 sm:px-8 lg:pb-12">
        {saved.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-line bg-panel-2 px-6 py-12 text-center">
            <BookmarkIcon className="size-10 text-accent-ink" />
            <p className="mt-4 text-lg font-semibold text-ink">Nothing saved yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Tap the bookmark on any headline to keep it here for later.
            </p>
            <Link
              to={`/?${params}`}
              className="mt-5 rounded-xl border border-accent/60 bg-accent-soft px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Browse headlines
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 px-1 text-sm text-muted">
              {saved.length} saved {saved.length === 1 ? 'article' : 'articles'}
            </p>
            <ul className="max-w-4xl space-y-3">
              {saved.map((s) => (
                <li key={s.article.id}>
                  <p className="mb-1.5 px-1 text-xs font-medium tracking-wide text-faint uppercase">
                    {nameOf(s.country)} · {SECTION_LABELS[s.section]}
                  </p>
                  <ArticleCard article={s.article} country={s.country} section={s.section} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}
