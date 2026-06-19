import { useState } from 'react'
import { Trophy, Frown, Share2, RotateCcw, ExternalLink, Check } from 'lucide-react'
import type { GameState } from '@/types'
import type { GuessRecord } from '@/store/gameStore'
import { api } from '@/lib/api'
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
  onNewGame,
}: {
  game: GameState
  guesses: GuessRecord[]
  onNewGame: () => void
}) {
  const answer = game.answer
  const [name, setName] = useState('')
  const [rank, setRank] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
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

  async function submitScore() {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await api.submitScore(game.gameId, name.trim())
      setRank(res.rank)
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-fade-up w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-2xl">
        {/* Banner */}
        <div
          className={
            game.solved
              ? 'flex items-center gap-3 bg-success/15 px-6 py-4 text-success'
              : 'flex items-center gap-3 bg-danger/15 px-6 py-4 text-danger'
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

          {/* Leaderboard submission (solved games only) */}
          {game.solved && (
            <div className="mt-5 rounded-lg border border-border bg-surface-2 p-3">
              {rank === null ? (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide text-muted">
                      Add to leaderboard
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={24}
                      placeholder="Your name"
                      className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none"
                    />
                  </div>
                  <Button onClick={submitScore} disabled={!name.trim() || submitting}>
                    Submit
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-success">
                  <Check className="size-4" /> Submitted! You ranked #{rank} on this board.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-border p-4">
          <Button variant="secondary" className="flex-1" onClick={share}>
            {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
            {copied ? 'Copied!' : 'Share'}
          </Button>
          <Button className="flex-1" onClick={onNewGame}>
            <RotateCcw className="size-4" /> New game
          </Button>
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
