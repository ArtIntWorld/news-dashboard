import type { Section } from '../api/types'
import { CpuIcon, LeafIcon, UsersIcon, type IconProps } from '../components/icons'

export const SECTION_ICONS: Record<Section, (p: IconProps) => React.JSX.Element> = {
  nature: LeafIcon,
  society: UsersIcon,
  technology: CpuIcon,
}

/** Icon colour per section, used in lists and the snapshot card. */
export const SECTION_TINT: Record<Section, string> = {
  nature: 'text-emerald-500 dark:text-emerald-400',
  society: 'text-sky-500 dark:text-sky-400',
  technology: 'text-violet-500 dark:text-violet-300',
}
