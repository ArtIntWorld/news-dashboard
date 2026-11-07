import { SECTIONS, type Section } from '../api/types'

export const DEFAULT_SECTION: Section = 'technology'

export const SECTION_LABELS: Record<Section, string> = {
  nature: 'Nature',
  society: 'Society',
  technology: 'Technology',
}

export function isSection(value: unknown): value is Section {
  return typeof value === 'string' && (SECTIONS as readonly string[]).includes(value)
}

/** Anything that isn't a known section falls back to technology. */
export function parseSection(value: string | null | undefined): Section {
  return isSection(value) ? value : DEFAULT_SECTION
}

/** DOM id of a section's tab, used for aria-labelledby on the panel. */
export const tabId = (section: Section) => `tab-${section}`
