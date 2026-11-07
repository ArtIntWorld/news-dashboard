import { useRef, type KeyboardEvent } from 'react'
import { SECTIONS, type Section } from '../api/types'
import { SECTION_LABELS, tabId } from '../lib/section'
import { SECTION_ICONS } from '../lib/sectionIcons'

interface Props {
  value: Section
  onChange: (section: Section) => void
  /** Called on hover/focus so the section can be fetched before the click. */
  onPrefetch?: (section: Section) => void
  panelId: string
}

export default function SectionTabs({ value, onChange, onPrefetch, panelId }: Props) {
  const refs = useRef<Partial<Record<Section, HTMLButtonElement | null>>>({})

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const index = SECTIONS.indexOf(value)
    let next: number
    switch (e.key) {
      case 'ArrowRight':
        next = (index + 1) % SECTIONS.length
        break
      case 'ArrowLeft':
        next = (index - 1 + SECTIONS.length) % SECTIONS.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = SECTIONS.length - 1
        break
      default:
        return
    }
    e.preventDefault()
    const section = SECTIONS[next]
    onChange(section)
    refs.current[section]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel p-1 backdrop-blur"
    >
      {SECTIONS.map((section) => {
        const active = section === value
        const Icon = SECTION_ICONS[section]
        return (
          <button
            key={section}
            ref={(el) => {
              refs.current[section] = el
            }}
            type="button"
            role="tab"
            id={tabId(section)}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(section)}
            onKeyDown={onKeyDown}
            onMouseEnter={() => onPrefetch?.(section)}
            onFocus={() => onPrefetch?.(section)}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-[13px] font-medium transition-[color,background-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm ${
              active
                ? 'border border-violet-400/70 bg-linear-to-b from-violet-500 to-indigo-600 text-white shadow-[0_0_22px_rgb(139_92_246/0.55)]'
                : 'border border-transparent text-muted hover:bg-accent-soft hover:text-ink'
            }`}
          >
            <Icon className="size-4 shrink-0 sm:size-[18px]" />
            <span className="truncate">{SECTION_LABELS[section]}</span>
          </button>
        )
      })}
    </div>
  )
}
