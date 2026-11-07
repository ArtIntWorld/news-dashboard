import type { Article, Section } from '../api/types'
import ArticleCard from './ArticleCard'
import { EmptyState, ErrorState, LoadingList } from './states'

export const THIN_THRESHOLD = 5

interface Props {
  status: 'pending' | 'error' | 'success'
  articles: Article[] | undefined
  onRetry: () => void
  countryName: string
  countryCode?: string
  section: Section
  onTryAnotherSection?: () => void
}

/** Picks between the loading, error, empty, thin and results views. */
export default function ArticleList({
  status,
  articles,
  onRetry,
  countryName,
  countryCode = '',
  section,
  onTryAnotherSection,
}: Props) {
  if (status === 'error') return <ErrorState onRetry={onRetry} />
  if (status === 'pending' || !articles) return <LoadingList />
  if (articles.length === 0)
    return <EmptyState country={countryName} section={section} onTryAnother={onTryAnotherSection} />

  return (
    <>
      <ul className="space-y-3">
        {articles.map((article) => (
          <li key={article.id}>
            <ArticleCard article={article} country={countryCode} section={section} />
          </li>
        ))}
      </ul>
      {articles.length < THIN_THRESHOLD && (
        <p className="mt-5 text-center text-sm text-muted">Coverage for this country is limited.</p>
      )}
    </>
  )
}
