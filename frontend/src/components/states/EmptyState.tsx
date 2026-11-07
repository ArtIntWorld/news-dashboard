import type { Section } from '../../api/types'
import { SECTION_LABELS } from '../../lib/section'
import { FileSearchIcon } from '../icons'

interface Props {
  country: string
  section: Section
  onTryAnother?: () => void
}

export default function EmptyState({ country, section, onTryAnother }: Props) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line bg-panel-2 px-6 py-10 text-center">
      <FileSearchIcon className="size-10 text-accent-ink" />
      <p className="mt-4 text-lg font-semibold text-ink">No articles found</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        There are no news articles for {country} in the {SECTION_LABELS[section]} section today.
      </p>
      {onTryAnother && (
        <button
          type="button"
          onClick={onTryAnother}
          className="mt-5 rounded-xl border border-accent/60 bg-accent-soft px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try another section
        </button>
      )}
    </div>
  )
}
