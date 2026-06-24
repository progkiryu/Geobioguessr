import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const links = [
  { to: '/', label: 'Daily', end: true }, { to: '/random', label: 'Play' },
]

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <NavLink to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Geobioguessr logo" className="size-9 rounded-lg bg-accent/15 text-accent object-contain" />
          <span className="font-display text-xl font-bold tracking-tight">
            <span className="text-success">geo</span><span className="text-danger">bio</span>
            <span className="text-accent">guessr</span>
          </span>
        </NavLink>

        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-surface-2 text-accent' : 'text-muted hover:text-text',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
