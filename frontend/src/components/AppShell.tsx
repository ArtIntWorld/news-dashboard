import { Dialog, DialogPanel } from '@headlessui/react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { SECTIONS, type Section } from '../api/types'
import { parseSection, SECTION_LABELS } from '../lib/section'
import { SECTION_ICONS } from '../lib/sectionIcons'
import { EarthPhoto } from './Artwork'
import { BookmarkIcon, CloseIcon, CompassIcon, HomeIcon, MenuIcon, NewspaperIcon } from './icons'
import ThemeToggle from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/explore', label: 'Explore', Icon: CompassIcon },
  { to: '/saved', label: 'Saved', Icon: BookmarkIcon },
] as const

/** Keep the chosen country when moving between pages. */
function useCarry() {
  const [params] = useSearchParams()
  const country = params.get('country')
  return (path: string, section?: Section) => {
    const next = new URLSearchParams()
    if (country) next.set('country', country)
    if (section) next.set('section', section)
    const q = next.toString()
    return q ? `${path}?${q}` : path
  }
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 text-white shadow-[0_0_20px_rgb(139_92_246/0.45)]">
        <NewspaperIcon className="size-5" />
      </span>
      <span className={`font-bold tracking-tight text-ink ${compact ? 'text-base' : 'text-lg'}`}>
        News Dashboard
      </span>
    </span>
  )
}

const navItem = (active: boolean) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
    active
      ? 'border border-accent/50 bg-accent-soft text-ink shadow-[0_0_24px_rgb(139_92_246/0.18)]'
      : 'border border-transparent text-muted hover:bg-accent-soft hover:text-ink'
  }`

/** Sidebar contents, shared by the desktop sidebar and the mobile drawer. */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const carry = useCarry()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const currentSection = parseSection(params.get('section'))

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ to, label, Icon }) => (
        <NavLink key={to} to={carry(to)} end onClick={onNavigate} className={({ isActive }) => navItem(isActive)}>
          <Icon className="size-5" />
          {label}
        </NavLink>
      ))}
      <div className="my-4 border-t border-line" />
      <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-faint uppercase">Sections</p>
      {SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section]
        const active = pathname === '/' && currentSection === section
        return (
          <Link
            key={section}
            to={carry('/', section)}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              active ? 'text-ink' : 'text-muted hover:bg-accent-soft hover:text-ink'
            }`}
          >
            <Icon className="size-5" />
            {SECTION_LABELS[section]}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarFooter() {
  return (
    <div className="relative mt-auto h-52 shrink-0 overflow-hidden">
      <EarthPhoto className="absolute inset-0" />
      <div className="absolute bottom-5 left-5">
        <p className="text-lg leading-tight font-semibold text-white drop-shadow">
          Daily News
          <br />
          Across the World
        </p>
        <span className="mt-3 block h-1 w-10 rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400" />
      </div>
    </div>
  )
}

function BottomNav() {
  const carry = useCarry()
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 rounded-2xl border border-line bg-panel-solid/90 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur-lg lg:hidden"
    >
      {NAV.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={carry(to)}
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent ${
              isActive ? 'text-accent-ink' : 'text-muted hover:text-ink'
            }`
          }
        >
          <Icon className="size-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function AppShell({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh lg:p-6">
      <div className="mx-auto max-w-[90rem] lg:grid lg:h-[calc(100dvh-3rem)] lg:grid-cols-[15rem_1fr] lg:overflow-hidden lg:rounded-3xl lg:border lg:border-line lg:bg-panel lg:backdrop-blur-xl">
        {/* Desktop sidebar */}
        <aside className="hidden overflow-y-auto border-r border-line lg:flex lg:flex-col">
          <div className="p-5 pb-6">
            <Link to="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
              <Logo />
            </Link>
          </div>
          <div className="px-4">
            <SidebarNav />
          </div>
          <SidebarFooter />
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-canvas/80 px-3 py-2.5 backdrop-blur-lg lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <MenuIcon className="size-6" />
          </button>
          <Link to="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
            <Logo compact />
          </Link>
          <ThemeToggle />
        </header>

        <div className="min-w-0 pb-28 lg:overflow-y-auto lg:pb-0">{children ?? <Outlet />}</div>
      </div>

      <BottomNav />

      {/* Mobile drawer */}
      <Dialog open={menuOpen} onClose={setMenuOpen} className="relative z-50 lg:hidden">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        <DialogPanel className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-panel-solid">
          <div className="flex items-center justify-between p-4">
            <Logo compact />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
          <div className="px-3">
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
          </div>
          <SidebarFooter />
        </DialogPanel>
      </Dialog>
    </div>
  )
}
