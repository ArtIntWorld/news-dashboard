import { useQueries } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { SECTIONS, type Section } from '../api/types'
import { newsQueryOptions } from '../hooks/useNews'
import { SECTION_LABELS } from '../lib/section'
import { SECTION_ICONS, SECTION_TINT } from '../lib/sectionIcons'
import { shareOrCopy } from '../lib/share'
import { panelClass } from '../lib/ui'
import { WaveArt } from './Artwork'
import { CalendarIcon, ChartIcon, CheckIcon, ChevronRightIcon, LinkIcon, RefreshIcon, ZapIcon } from './icons'

interface Props {
  country: string | null
  section: Section
  onSection: (s: Section) => void
  onRefresh: () => void
  refreshing: boolean
  shareTitle: string
}

function Snapshot({ country, section, onSection }: Pick<Props, 'country' | 'section' | 'onSection'>) {
  // Same queries the tabs use, so this warms the other sections too.
  const results = useQueries({
    queries: SECTIONS.map((s) => ({ ...newsQueryOptions(country ?? '', s), enabled: !!country })),
  })
  return (
    <section aria-labelledby="snapshot-title" className={`${panelClass} p-4`}>
      <h2 id="snapshot-title" className="flex items-center gap-2.5 px-1 pb-3 text-base font-semibold text-ink">
        <ChartIcon className="size-5 text-accent-ink" />
        Today’s Snapshot
      </h2>
      <ul className="space-y-1 border-t border-line pt-2">
        {SECTIONS.map((s, i) => {
          const Icon = SECTION_ICONS[s]
          const n = results[i].data?.articles.length
          const active = s === section
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => onSection(s)}
                aria-current={active ? 'true' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  active ? 'border border-accent/50 bg-accent-soft' : 'border border-transparent hover:bg-accent-soft'
                }`}
              >
                <Icon className={`size-[18px] ${SECTION_TINT[s]}`} />
                <span className="flex-1 font-medium text-ink">{SECTION_LABELS[s]}</span>
                <span className="text-xs text-muted">
                  {n === undefined ? '…' : `${n} ${n === 1 ? 'article' : 'articles'}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function DateCard() {
  const now = new Date()
  return (
    <section className={`${panelClass} relative overflow-hidden p-4`} aria-label="Today’s date">
      <div className="flex items-center gap-3.5">
        <CalendarIcon className="size-8 text-accent-ink" />
        <div>
          <p className="text-lg font-semibold text-ink">
            {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-sm text-muted">{now.toLocaleDateString('en-US', { weekday: 'long' })}</p>
        </div>
      </div>
      <WaveArt className="pointer-events-none absolute right-0 bottom-0 h-14 w-2/3" />
    </section>
  )
}

function QuickActions({ onRefresh, refreshing, shareTitle }: Pick<Props, 'onRefresh' | 'refreshing' | 'shareTitle'>) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const row =
    'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60'
  const badge = 'flex size-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted'

  return (
    <section aria-labelledby="actions-title" className={`${panelClass} p-4`}>
      <h2 id="actions-title" className="flex items-center gap-2.5 px-1 pb-3 text-base font-semibold text-ink">
        <ZapIcon className="size-5 text-accent-ink" />
        Quick Actions
      </h2>
      <div className="space-y-1 border-t border-line pt-2">
        <button
          type="button"
          className={row}
          onClick={async () => {
            if ((await shareOrCopy(shareTitle, window.location.href)) === 'copied') setCopied(true)
          }}
        >
          <span className={badge}>
            {copied ? <CheckIcon className="size-5 text-emerald-500" /> : <LinkIcon className="size-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">{copied ? 'Link copied' : 'Share this view'}</span>
            <span className="block text-xs text-muted">Copy a link to this news selection</span>
          </span>
          <ChevronRightIcon className="size-4 text-faint" />
        </button>
        <button type="button" className={row} onClick={onRefresh} disabled={refreshing}>
          <span className={badge}>
            <RefreshIcon className={`size-5 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">Refresh news</span>
            <span className="block text-xs text-muted">Check for the latest updates</span>
          </span>
          <ChevronRightIcon className="size-4 text-faint" />
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </section>
  )
}

/** Right-hand column on wide screens. */
export default function HomeAside(props: Props) {
  return (
    <div className="space-y-4">
      <Snapshot country={props.country} section={props.section} onSection={props.onSection} />
      <DateCard />
      <QuickActions onRefresh={props.onRefresh} refreshing={props.refreshing} shareTitle={props.shareTitle} />
    </div>
  )
}
