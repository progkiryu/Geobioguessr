import { useQuery } from '@tanstack/react-query'
import { BarChart3, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/**
 * Score distribution for the day's Daily challenge — how many people achieved
 * each score. Opened from the game page once a game is finished.
 */
export function StatsPanel({
  date,
  highlightScore,
  onClose,
}: {
  /** Daily date to show; falls back to today's Daily on the server. */
  date?: string
  /** The player's own score, highlighted in the chart (Daily only). */
  highlightScore?: number
  onClose: () => void
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['daily-stats', date ?? 'today'],
    queryFn: () => api.getDailyStats(date),
  })

  const maxCount = data ? Math.max(1, ...data.distribution.map((b) => b.count)) : 1
  const solveRate = data && data.total > 0 ? Math.round((data.solved / data.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-fade-up relative w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close statistics"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-md text-text/70 transition-colors hover:bg-black/20 hover:text-text"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-border bg-sky/10 py-4 pl-6 pr-14 text-sky">
          <BarChart3 className="size-6" />
          <div>
            <div className="text-lg font-bold">Daily Statistics</div>
            <div className="text-xs opacity-90">Score distribution{data?.date ? ` · ${data.date}` : ''}</div>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="size-6 text-accent" />
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-muted">Couldn’t load statistics right now.</p>
          ) : !data || data.total === 0 ? (
            <p className="py-12 text-center text-sm text-muted">
              No one has finished today’s Daily yet — be the first!
            </p>
          ) : (
            <>
              <div className="mb-5 flex gap-3">
                <Summary label="Players" value={data.total.toLocaleString()} />
                <Summary label="Solved" value={data.solved.toLocaleString()} />
                <Summary label="Solve rate" value={`${solveRate}%`} />
              </div>

              <div className="flex items-end gap-2" style={{ height: 180 }}>
                {data.distribution.map((b) => {
                  const isMine = highlightScore != null && b.score === highlightScore
                  const barPx = Math.round((b.count / maxCount) * 140)
                  return (
                    <div key={b.score} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <span
                        className={cn(
                          'text-[11px] tabular-nums',
                          isMine ? 'font-bold text-accent' : 'text-muted',
                        )}
                      >
                        {b.count}
                      </span>
                      <div
                        className={cn(
                          'w-full rounded-t transition-all',
                          isMine ? 'bg-accent' : 'bg-sky/60',
                        )}
                        style={{ height: Math.max(b.count > 0 ? 4 : 1, barPx) }}
                      />
                      <span
                        className={cn(
                          'mt-1 text-[10px] tabular-nums',
                          isMine ? 'font-bold text-accent' : 'text-muted',
                        )}
                      >
                        {b.score}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 text-center text-[11px] text-muted">
                Score{highlightScore != null ? ' · your result is highlighted' : ''}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-surface-2 p-2.5 text-center">
      <div className="text-lg font-bold text-text">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  )
}
