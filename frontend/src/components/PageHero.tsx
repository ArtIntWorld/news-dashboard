import type { ReactNode } from 'react'
import { HeroPhoto } from './Artwork'

interface Props {
  title: ReactNode
  subtitle: string
  /** Icon buttons in the top-right corner. */
  actions?: ReactNode
  children?: ReactNode
}

/** Page header with the mountain photo behind it. */
export default function PageHero({ title, subtitle, actions, children }: Props) {
  return (
    <div className="relative">
      {/* Top-right only, fading out to the left and bottom so headings stay readable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 h-48 w-full sm:h-56 md:w-3/4 lg:h-64"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 20%, black 70%), linear-gradient(to bottom, black 45%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 20%, black 70%), linear-gradient(to bottom, black 45%, transparent 100%)',
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
      >
        <HeroPhoto className="h-full w-full opacity-75 dark:opacity-90" />
      </div>
      <div className="relative px-4 pt-6 sm:px-8 sm:pt-8 lg:pt-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-bold tracking-tight text-ink sm:text-4xl lg:text-[44px]">
              {title}
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted sm:text-base">{subtitle}</p>
          </div>
          {actions && <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}
