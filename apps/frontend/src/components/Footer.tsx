import { Github } from 'lucide-react'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-border bg-bg/60 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand + tagline */}
          <div className="max-w-sm">
            <p className="mt-3 text-sm text-muted">
              Guess the historical figure from where their life began and ended. A new
              challenge every day.
            </p>
          </div>

          {/* Resources */}
          <nav className="flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-wide text-muted">About</div>
            <a
              href="https://github.com/progkiryu/Geobioguessr"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
            >
              <Github className="size-3.5" /> Source
            </a>
            <p className="text-sm text-muted">Developed by <a href="https://github.com/progkiryu" target="_blank" rel="noreferrer" className="text-sky hover:underline">progkiryu</a></p>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} geobioguessr</span>
          <span>
            Figure data from{' '}
            <a
              href="https://www.wikipedia.org"
              target="_blank"
              rel="noreferrer"
              className="text-sky hover:underline"
            >
              Wikipedia
            </a>{' '}
            &amp;{' '}
            <a
              href="https://www.wikidata.org"
              target="_blank"
              rel="noreferrer"
              className="text-sky hover:underline"
            >
              Wikidata
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
