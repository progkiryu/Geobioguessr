import { useState } from 'react'
import { Trophy, Frown, Share2, RotateCcw, ExternalLink, Check, X, BarChart3 } from 'lucide-react'
import type { GameState } from '@/types'
import type { GuessRecord } from '@/store/gameStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { initialsOf } from '@/lib/format'

function buildShare(game: GameState, guesses: GuessRecord[]): string {
  const label = game.mode === 'daily' ? `Daily ${game.date ?? ''}`.trim() : 'Random'
  const line = guesses.map((g) => (g.correct ? '🟩' : '🟥')).join('')
  const pad = '⬜'.repeat(Math.max(0, game.maxAttempts - guesses.length))
  const outcome = game.solved
    ? `Solved in ${game.wrongGuesses + 1}/${game.maxAttempts}`
    : `Stumped (${game.maxAttempts}/${game.maxAttempts})`
  return `geobioguessr — ${label}\n🗺️ ${outcome} · ${game.score ?? 0} pts\n${line}${pad}`
}

export function ResultScreen({
  game,
  guesses,
  onClose,
  onShowStats,
  onNewGame,
}: {
  game: GameState
  guesses: GuessRecord[]
  onClose: () => void
  onShowStats: () => void
  onNewGame: () => void
}) {
  const answer = game.answer
  const [copied, setCopied] = useState(false)

  if (!answer) return null

  async function share() {
    try {
      await navigator.clipboard.writeText(buildShare(game, guesses))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-fade-up relative w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-2xl">
        {/* Close — dismiss the board to inspect the map & hints underneath */}
        <button
          onClick={onClose}
          aria-label="Close result"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-md text-text/70 transition-colors hover:bg-black/20 hover:text-text"
        >
          <X className="size-5" />
        </button>
        {/* Banner */}
        <div
          className={
            game.solved
              ? 'flex items-center gap-3 bg-success/15 py-4 pl-6 pr-14 text-success'
              : 'flex items-center gap-3 bg-danger/15 py-4 pl-6 pr-14 text-danger'
          }
        >
          {game.solved ? <Trophy className="size-6" /> : <Frown className="size-6" />}
          <div>
            <div className="text-lg font-bold">{game.solved ? 'Correct!' : 'Out of guesses'}</div>
            <div className="text-xs opacity-90">
              {game.solved
                ? `Identified in ${game.wrongGuesses + 1} attempt${game.wrongGuesses === 0 ? '' : 's'}`
                : 'Better luck next time'}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[11px] uppercase tracking-wide opacity-80">Score</div>
            <div className="text-2xl font-extrabold">{game.score ?? 0}</div>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          <div className="flex gap-4">
            {answer.imageUrl ? (
              <img
                src={answer.imageUrl}
                alt={answer.name}
                className="h-24 w-24 shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-2xl font-bold text-accent">
                {initialsOf(answer.name)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-2xl leading-tight">{answer.name}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone="accent">{answer.difficulty}</Badge>
                {answer.nationality && <Badge>{answer.nationality}</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted">
                {answer.occupation.join(' · ')}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Born" value={`${answer.birthDate}`} sub={answer.birthPlace} />
            <Stat label="Died" value={`${answer.deathDate}`} sub={answer.deathPlace} />
            <Stat label="Lifespan" value={`${answer.birthYear} – ${answer.deathYear}`} />
            <Stat label="Attempts" value={`${game.wrongGuesses + (game.solved ? 1 : 0)} / ${game.maxAttempts}`} />
          </dl>

          {answer.summary && (
            <p className="mt-4 rounded-lg border border-border bg-surface-2 p-3 text-sm leading-relaxed text-muted">
              {answer.summary}
            </p>
          )}

          <a
            href={answer.wikipediaUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-sky hover:underline"
          >
            Read more on Wikipedia <ExternalLink className="size-3.5" />
          </a>
        </div>

        <div className="flex gap-3 border-t border-border p-4">
          <Button variant="secondary" className="flex-1" onClick={share}>
            {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
            {copied ? 'Copied!' : 'Share'}
          </Button>
          {/* Statistics show the Daily score distribution — only relevant in Daily mode. */}
          {game.mode === 'daily' && (
            <Button variant="secondary" className="flex-1" onClick={onShowStats}>
              <BarChart3 className="size-4" /> Statistics
            </Button>
          )}
          {/* Daily is a single fixed puzzle per day — no "next game" to start. */}
          {game.mode !== 'daily' && (
            <Button className="flex-1" onClick={onNewGame}>
              <RotateCcw className="size-4" /> New game
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  )
}
