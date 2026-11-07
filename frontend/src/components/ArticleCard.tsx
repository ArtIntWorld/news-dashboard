import type { Article, Section } from '../api/types'
import { useSaved } from '../hooks/useSaved'
import { formatExact, timeAgo } from '../lib/date'
import { isSaved, toggleSaved } from '../lib/saved'
import { BookmarkIcon, ExternalLinkIcon } from './icons'

interface Props {
  article: Article
  country: string
  section: Section
  /** Smaller type and no summary, for side-by-side columns. */
  compact?: boolean
}

/** Text-first headline card. The headline link is stretched over the whole card. */
export default function ArticleCard({ article, country, section, compact = false }: Props) {
  const saved = isSaved(useSaved(), article.id)

  return (
    <article
      className={`group relative rounded-2xl border border-line bg-panel-2 transition-[border-color,background-color,box-shadow] focus-within:ring-2 focus-within:ring-accent hover:border-accent/50 hover:bg-accent-soft hover:shadow-[0_0_30px_rgb(139_92_246/0.12)] ${
        compact ? 'py-3 pr-20 pl-6' : 'py-4 pr-24 pl-7 sm:py-5 sm:pl-8'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute w-1 rounded-full bg-linear-to-b from-violet-400 to-fuchsia-500 ${
          compact ? 'top-3.5 bottom-3.5 left-3' : 'top-5 bottom-5 left-3.5 sm:left-4'
        }`}
      />
      <h3
        className={`leading-snug font-semibold text-ink ${
          compact ? 'line-clamp-3 text-sm' : 'line-clamp-3 text-base sm:line-clamp-2 sm:text-lg'
        }`}
      >
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
        >
          {article.title}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </h3>
      <p className={`mt-1 truncate text-muted ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>
        {article.source} ·{' '}
        <time dateTime={article.publishedAt} title={formatExact(article.publishedAt)}>
          {timeAgo(article.publishedAt)}
        </time>
      </p>
      {article.summary && !compact && (
        <p className="mt-2 hidden text-sm leading-relaxed text-muted sm:line-clamp-2">
          {article.summary}
        </p>
      )}

      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-0.5 sm:top-3 sm:right-3">
        <button
          type="button"
          onClick={() => toggleSaved(article, country, section)}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save article'}
          title={saved ? 'Saved' : 'Save'}
          className={`inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent ${
            saved ? 'text-accent-ink' : 'text-faint hover:text-ink'
          }`}
        >
          <BookmarkIcon className="size-[18px]" fill={saved ? 'currentColor' : 'none'} />
        </button>
        <span className="pointer-events-none inline-flex size-9 items-center justify-center text-faint transition-colors group-hover:text-accent-ink">
          <ExternalLinkIcon className="size-[18px]" />
        </span>
      </div>
    </article>
  )
}
