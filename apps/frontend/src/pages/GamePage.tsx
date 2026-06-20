import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarClock, Shuffle, ClipboardList, BarChart3 } from 'lucide-react'
import type { GameMode } from '@/types'
import { useGameStore } from '@/store/gameStore'
import { MapView } from '@/components/MapView'
import { SearchBar } from '@/components/SearchBar'
import { HintGrid } from '@/components/HintGrid'
import { AttemptTracker } from '@/components/AttemptTracker'
import { ResultScreen } from '@/components/ResultScreen'
import { StatsPanel } from '@/components/StatsPanel'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

export function GamePage({ mode }: { mode: GameMode }) {
  const { status, error, game, guesses, ensureGame, startGame } = useGameStore()
  const startedMode = useRef<GameMode | null>(null)
  const [resultDismissed, setResultDismissed] = useState(false)
  const [showStats, setShowStats] = useState(false)

  useEffect(() => {
    if (startedMode.current === mode) return
    const isModeSwitch = startedMode.current !== null
    startedMode.current = mode
    setResultDismissed(false)
    setShowStats(false)
    void ensureGame(mode).then(() => {
      // Switching between Play and Daily shouldn't re-pop the result card for a
      // game that's already finished — keep it dismissed. (Finishing live leaves
      // the mode unchanged, so this effect doesn't fire and the card still shows.)
      if (isModeSwitch && useGameStore.getState().game?.over) {
        setResultDismissed(true)
      }
    })
  }, [mode, ensureGame])

  function newFigure() {
    setResultDismissed(false)
    void startGame(mode)
  }

  if (status === 'loading' || (status === 'idle' && !game)) {
    return (
      <CenterMessage>
        <Spinner className="size-8 text-accent" />
        <p className="mt-3 text-muted">Summoning a historical figure…</p>
      </CenterMessage>
    )
  }

  if (status === 'error') {
    return (
      <CenterMessage>
        <AlertTriangle className="size-8 text-danger" />
        <p className="mt-3 text-text">{error ?? 'Something went wrong.'}</p>
        <p className="mb-4 mt-1 max-w-sm text-sm text-muted">
          Make sure the backend is running on port 4000 and the database has been seeded.
        </p>
        <Button onClick={() => startGame(mode)}>Try again</Button>
      </CenterMessage>
    )
  }

  if (!game) return null

  const gameOver = game.over

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mode === 'daily' ? (
            <Badge tone="sky">
              <CalendarClock className="size-3.5" /> Daily Challenge {game.date}
            </Badge>
          ) : (
            <Badge tone="accent">
              <Shuffle className="size-3.5" /> Random
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Statistics show the Daily score distribution — only relevant in Daily mode. */}
          {gameOver && mode === 'daily' && (
            <Button variant="ghost" size="sm" onClick={() => setShowStats(true)}>
              <BarChart3 className="size-4" /> Statistics
            </Button>
          )}
          {gameOver && resultDismissed && (
            <Button variant="ghost" size="sm" onClick={() => setResultDismissed(false)}>
              <ClipboardList className="size-4" /> Show result
            </Button>
          )}
          {/* Daily is one fixed puzzle per day — no reshuffling it. */}
          {mode !== 'daily' && (
            <Button variant="ghost" size="sm" onClick={newFigure}>
              <Shuffle className="size-4" /> New figure
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Map + search */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="relative h-[58vh] min-h-[360px] overflow-hidden">
            <MapView
              birth={game.birthCoordinates}
              death={game.deathCoordinates}
              birthPlace={gameOver ? game.answer?.birthPlace : undefined}
              deathPlace={gameOver ? game.answer?.deathPlace : undefined}
            />
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex gap-3 rounded-lg border border-border bg-bg/80 px-3 py-2 text-xs backdrop-blur">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-success" /> Birth
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-danger" /> Death
              </span>
            </div>
          </Card>
          <SearchBar />
        </div>

        {/* Clues sidebar */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="p-4">
              <AttemptTracker game={game} guesses={guesses} />
            </div>
          </Card>
          <HintGrid revealed={game.revealedHints} />
        </div>
      </div>

      {gameOver && !resultDismissed && (
        <ResultScreen
          game={game}
          guesses={guesses}
          onClose={() => setResultDismissed(true)}
          onShowStats={() => setShowStats(true)}
          onNewGame={newFigure}
        />
      )}

      {showStats && (
        <StatsPanel
          date={game.date}
          highlightScore={mode === 'daily' && game.over ? game.score : undefined}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  )
}

function CenterMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      {children}
    </div>
  )
}
