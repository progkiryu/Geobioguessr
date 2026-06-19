import { XCircle } from 'lucide-react'
import type { GameState } from '@/types'
import type { GuessRecord } from '@/store/gameStore'
import { cn } from '@/lib/utils'

/** Live potential score if solved on the next guess. Mirrors the backend rules. */
export function potentialScore(wrongGuesses: number): number {
  const base = 1000 - 150 * wrongGuesses
  const withBonus = wrongGuesses === 0 ? base + 500 : base
  return Math.max(0, withBonus)
}

export function AttemptTracker({ game, guesses }: { game: GameState; guesses: GuessRecord[] }) {
  const pips = Array.from({ length: game.maxAttempts }, (_, i) => i <= game.wrongGuesses)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted">Attempts</div>
          <div className="text-sm text-text">
            {game.wrongGuesses} / {game.maxAttempts} used
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted">
            {game.over ? 'Final score' : 'Score if solved now'}
          </div>
          <div className="text-lg font-bold text-accent">
            {game.over ? (game.score ?? 0) : potentialScore(game.wrongGuesses)}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5">
        {pips.map((used, i) => (
          <div
            key={i}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              used ? 'bg-danger' : 'bg-border',
            )}
          />
        ))}
      </div>

      {guesses.length > 0 && (
        <ul className="space-y-1">
          {guesses.map((g, i) => (
            <li
              key={i}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm',
                g.correct ? 'bg-success/10 text-success' : 'bg-surface-2 text-muted',
              )}
            >
              {!g.correct && <XCircle className="size-3.5 shrink-0" />}
              <span className="truncate">{g.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
