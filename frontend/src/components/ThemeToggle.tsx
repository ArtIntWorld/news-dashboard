import { useTheme } from '../hooks/useTheme'
import { iconButtonClass } from '../lib/ui'
import { MoonIcon, SunIcon } from './icons'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`${iconButtonClass} ${className}`}
    >
      {dark ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
    </button>
  )
}
