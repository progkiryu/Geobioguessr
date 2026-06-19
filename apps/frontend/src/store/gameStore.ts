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
  notice: string | null
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
  notice: null,
  mode: 'random',
  game: null,
  guesses: [],
  submitting: false,

  startGame: async (mode) => {
    set({ status: 'loading', error: null, notice: null, mode, game: null, guesses: [] })
    try {
      const game = mode === 'daily' ? await api.startDaily() : await api.startRandom()
      set({ game, status: 'playing' })
    } catch (err) {
      set({ status: 'error', error: (err as Error).message })
    }
  },

  submitGuess: async (name) => {
    const { game, submitting, guesses } = get()
    if (!game || game.over || submitting) return
    const text = name.trim()
    if (!text) return

    // Block re-using a guess already made (case/diacritic-insensitive).
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[._'`’-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (guesses.some((g) => norm(g.text) === norm(text))) {
      set({ notice: `You already guessed "${text}".` })
      return
    }

    set({ submitting: true, error: null, notice: null })
    try {
      const result = await api.submitGuess(game.gameId, text)

      // Server also guards against repeats (e.g. an alias of a prior guess).
      if (result.duplicate) {
        set({ submitting: false, notice: `You already guessed "${text}".` })
        return
      }

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

  reset: () =>
    set({ status: 'idle', error: null, notice: null, game: null, guesses: [], submitting: false }),
}))
