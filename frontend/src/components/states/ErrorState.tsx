import { AlertIcon, RefreshIcon } from '../icons'

export default function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-2xl border border-line bg-panel-2 px-6 py-10 text-center"
    >
      <AlertIcon className="size-10 text-rose-500 dark:text-rose-400" />
      <p className="mt-4 text-lg font-semibold text-ink">Failed to load news</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Something went wrong while fetching the latest news. Please try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-accent/60 bg-accent-soft px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <RefreshIcon className="size-4" />
        Retry
      </button>
    </div>
  )
}
