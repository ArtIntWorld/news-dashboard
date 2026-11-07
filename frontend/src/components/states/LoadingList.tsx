/** Placeholder cards while the first load runs. Shimmer respects reduced motion. */
export default function LoadingList({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="space-y-3" aria-hidden="true" data-testid="loading-list">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex gap-4 rounded-2xl border border-line bg-panel-2 p-4 sm:p-5">
          <div className="size-12 shrink-0 rounded-xl bg-accent-soft motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2.5 py-1 motion-safe:animate-pulse">
            <div className="h-3.5 w-11/12 rounded-full bg-accent-soft" />
            <div className="h-3.5 w-1/2 rounded-full bg-accent-soft" />
          </div>
        </li>
      ))}
    </ul>
  )
}
