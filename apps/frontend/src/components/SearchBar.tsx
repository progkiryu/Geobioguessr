import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, CornerDownLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { useGameStore } from '@/store/gameStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SearchBar() {
  const submitGuess = useGameStore((s) => s.submitGuess)
  const submitting = useGameStore((s) => s.submitting)
  const over = useGameStore((s) => s.game?.over ?? false)

  const [value, setValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 180)
    return () => clearTimeout(t)
  }, [value])

  const { data: suggestions = [] } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length >= 1 && !over,
  })

  // Close dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function guess(name: string) {
    if (!name.trim() || submitting || over) return
    void submitGuess(name)
    setValue('')
    setDebounced('')
    setOpen(false)
    setHighlight(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') guess(value)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      guess(highlight >= 0 ? suggestions[highlight].name : value)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && suggestions.length > 0 && !over

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={value}
            disabled={over}
            placeholder={over ? 'Game over' : 'Who is this historical figure?'}
            onChange={(e) => {
              setValue(e.target.value)
              setOpen(true)
              setHighlight(-1)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(
              'h-12 w-full rounded-lg border border-border bg-surface-2 pl-10 pr-3 text-text',
              'placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40',
              'disabled:opacity-60',
            )}
            autoComplete="off"
          />
        </div>
        <Button size="lg" onClick={() => guess(value)} disabled={over || submitting || !value.trim()}>
          {submitting ? '...' : 'Guess'}
          <CornerDownLeft className="size-4" />
        </Button>
      </div>

      {showDropdown && (
        <ul className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface shadow-2xl">
          {suggestions.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => guess(s.name)}
                className={cn(
                  'flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors',
                  i === highlight ? 'bg-accent/15 text-accent' : 'text-text hover:bg-surface-2',
                )}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
