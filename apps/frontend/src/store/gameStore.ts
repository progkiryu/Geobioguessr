import { create } from 'zustand'
import { api } from '@/lib/api'
import type { GameMode, GameState, Hint } from '@/types'

export interface GuessRecord {
  text: string
  correct: boolean
}

type Status = 'idle' | 'loading' | 'playing' | 'finished' | 'error'

interface GameStore {
  status: Status
  error: string | null
  mode: GameMode
  game: GameState | null
  guesses: GuessRecord[]
  submitting: boolean

  startGame: (mode: GameMode) => Promise<void>
  submitGuess: (name: string) => Promise<void>
  reset: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  error: null,
  mode: 'random',
  game: null,
  guesses: [],
  submitting: false,

  startGame: async (mode) => {
    set({ status: 'loading', error: null, mode, game: null, guesses: [] })
    try {
      const game = mode === 'daily' ? await api.startDaily() : await api.startRandom()
      set({ game, status: 'playing' })
    } catch (err) {
      set({ status: 'error', error: (err as Error).message })
    }
  },

  submitGuess: async (name) => {
    const { game, submitting } = get()
    if (!game || game.over || submitting) return
    const text = name.trim()
    if (!text) return

    set({ submitting: true, error: null })
    try {
      const result = await api.submitGuess(game.gameId, text)

      const revealedHints: Hint[] = result.newHint
        ? [...game.revealedHints, result.newHint]
        : game.revealedHints

      const updated: GameState = {
        ...game,
        attempt: result.attempt,
        wrongGuesses: result.wrongGuesses,
        remainingAttempts: result.remainingAttempts,
        over: result.over,
        solved: result.solved,
        score: result.score,
        answer: result.answer ?? game.answer,
        revealedHints,
      }

      set({
        game: updated,
        guesses: [...get().guesses, { text, correct: result.correct }],
        status: result.over ? 'finished' : 'playing',
        submitting: false,
      })
    } catch (err) {
      set({ submitting: false, error: (err as Error).message })
    }
  },

  reset: () => set({ status: 'idle', error: null, game: null, guesses: [], submitting: false }),
}))
