import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Crown, Medal } from 'lucide-react'
import type { GameMode } from '@/types'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function LeaderboardPage() {
  const [tab, setTab] = useState<GameMode>('daily')
  const date = todayKey()

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard', tab, tab === 'daily' ? date : 'all'],
    queryFn: () => api.getLeaderboard(tab, tab === 'daily' ? date : undefined, 50),
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Leaderboard</h1>
      <p className="mt-1 text-muted">Top scores from players around the world.</p>

      <div className="mt-5 inline-flex rounded-lg border border-border bg-surface p-1">
        {(['daily', 'random'] as GameMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setTab(m)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === m ? 'bg-accent text-[#1a1404]' : 'text-muted hover:text-text',
            )}
          >
            {m === 'daily' ? `Today's Daily` : 'Random (all-time)'}
          </button>
        ))}
      </div>

      <Card className="mt-4">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="size-6 text-accent" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-16 text-center text-muted">
              No scores yet — be the first to make the board!
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {entries.map((e, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-3">
                  <span className="flex w-8 shrink-0 justify-center">
                    {i === 0 ? (
                      <Crown className="size-5 text-accent" />
                    ) : i < 3 ? (
                      <Medal className="size-5 text-muted" />
                    ) : (
                      <span className="text-sm text-muted">{i + 1}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-text">{e.name}</div>
                    <div className="truncate text-xs text-muted">
                      {e.figureName} · {e.attempts} wrong {e.attempts === 1 ? 'guess' : 'guesses'}
                    </div>
                  </div>
                  <div className="text-right font-bold text-accent">{e.score}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>
    </div>
  )
}
